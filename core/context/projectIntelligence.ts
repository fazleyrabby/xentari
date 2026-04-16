import fs from "fs";
import path from "path";
import crypto from "crypto";

const CACHE_FILE = ".xentari/project.json";

export type Signal = {
  key: string;
  type: 'config' | 'extension' | 'dependency' | 'structure';
  value: string;
  weight: number;
};

export type ProjectIntelligence = {
  primary: string;
  secondary: string[];
  confidence: number;
  signals: Signal[];
  hash: string;
};

function normalizeKey(key: string): string {
  const k = key.toLowerCase();
  if (k.includes('astro')) return 'astro';
  if (k.includes('vite')) return 'vite';
  if (k.includes('react')) return 'react';
  if (k.includes('next')) return 'nextjs';
  if (k.includes('vue')) return 'vue';
  if (k.includes('svelte')) return 'svelte';
  if (k.includes('tailwind')) return 'tailwind';
  if (k.includes('typescript') || k === 'ts') return 'typescript';
  if (k.includes('laravel')) return 'laravel';
  if (k.includes('php')) return 'php';
  return k;
}

function collectSignals(projectDir: string, files: string[]): Signal[] {
  const signals: Signal[] = [];

  files.forEach(filePath => {
    const name = path.basename(filePath).toLowerCase();

    // CONFIG FILES (Strongest)
    if (name.includes('.config.')) {
      const key = normalizeKey(name.split('.config.')[0]);
      signals.push({ key, type: 'config', value: filePath, weight: 5 });
    }

    // LARAVEL / PHP SIGNALS
    if (name === 'artisan') signals.push({ key: 'laravel', type: 'config', value: 'artisan', weight: 10 });
    if (name.endsWith('.php')) signals.push({ key: 'php', type: 'extension', value: '.php', weight: 1 });

    // EXTENSIONS
    if (name.endsWith('.astro')) signals.push({ key: 'astro', type: 'extension', value: '.astro', weight: 4 });
    if (name.endsWith('.vue')) signals.push({ key: 'vue', type: 'extension', value: '.vue', weight: 4 });
    if (name.endsWith('.svelte')) signals.push({ key: 'svelte', type: 'extension', value: '.svelte', weight: 4 });
    if (name.endsWith('.tsx') || name.endsWith('.jsx')) signals.push({ key: 'react', type: 'extension', value: 'jsx/tsx', weight: 2 });

    // STRUCTURE
    if (filePath.includes('/pages/')) signals.push({ key: 'pages', type: 'structure', value: 'pages directory', weight: 1 });
    if (filePath.includes('/content/')) signals.push({ key: 'content', type: 'structure', value: 'content directory', weight: 1 });
    if (filePath.includes('/app/Http/Controllers/')) signals.push({ key: 'laravel', type: 'structure', value: 'Laravel Controllers', weight: 5 });
  });

  // PACKAGE.JSON
  const pkgPath = path.join(projectDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      Object.keys(allDeps).sort().forEach(dep => {
        const key = normalizeKey(dep);
        signals.push({ key, type: 'dependency', value: dep, weight: 3 });
      });
    } catch (e) {}
  }

  // COMPOSER.JSON (PHP/Laravel)
  const composerPath = path.join(projectDir, "composer.json");
  if (fs.existsSync(composerPath)) {
    try {
      const composer = JSON.parse(fs.readFileSync(composerPath, "utf-8"));
      const allDeps = { ...composer.require, ...composer['require-dev'] };
      Object.keys(allDeps).sort().forEach(dep => {
        const key = normalizeKey(dep);
        signals.push({ key, type: 'dependency', value: dep, weight: 3 });
      });
    } catch (e) {}
  }

  return signals;
}

function aggregateSignals(signals: Signal[]): Record<string, number> {
  const scores: Record<string, number> = {};
  signals.forEach(s => {
    scores[s.key] = (scores[s.key] || 0) + s.weight;
  });
  return scores;
}

function computeConfidence(sorted: [string, number][]): number {
  if (sorted.length === 0) return 0;
  const top = sorted[0][1];
  const second = sorted[1]?.[1] || 0;
  return Math.min(1, (top - second) / (top || 1));
}

function hashFiles(files: string[]): string {
  return crypto.createHash("md5").update(files.slice(0, 100).join("|")).digest("hex");
}

export function getCachedProject(projectDir: string): ProjectIntelligence | null {
  const p = path.join(projectDir, CACHE_FILE);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    // TTL Check DISABLED for determinism
    // if (Date.now() - data.timestamp > 10 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveProjectCache(projectDir: string, data: any): void {
  const dir = path.join(projectDir, ".xentari");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, CACHE_FILE), JSON.stringify({ ...data, timestamp: Date.now() }, null, 2));
}

export async function detectProject({
  files,
  projectDir,
}: {
  files: string[];
  projectDir: string;
  provider?: any;
  model?: any;
}): Promise<ProjectIntelligence> {
  const hash = hashFiles(files);
  const cached = getCachedProject(projectDir);
  if (cached && cached.hash === hash) return cached;

  const signals = collectSignals(projectDir, files);
  const scores = aggregateSignals(signals);
  const ranked = Object.entries(scores).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]); // Deterministic tie-breaker
  });

  const confidence = computeConfidence(ranked);
  const primary = ranked[0]?.[0] || 'unknown';
  const secondary = ranked.slice(1, 4).map(r => r[0]).filter(s => s !== primary);

  const result: ProjectIntelligence = {
    primary,
    secondary,
    confidence,
    signals,
    hash
  };

  saveProjectCache(projectDir, result);
  return result;
}
