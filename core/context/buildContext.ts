import fs from "fs";
import path from "path";
import { globSync } from "glob";

export type ScoringResult = {
  score: number;
  steps: { label: string; value: number }[];
};

export function scoreFile(file: { path: string; content: string }, input: string, intelligence?: { primary?: string }): ScoringResult {
  let score = 0;
  const steps: { label: string; value: number }[] = [];
  const p = file.path.toLowerCase();
  const c = file.content.toLowerCase();

  // 1. Term Match
  let termScore = 0;
  for (const k of input.toLowerCase().split(/\s+/)) {
    if (k.length < 3) continue;
    if (p.includes(k)) termScore += 3;
    if (c.includes(k)) termScore += 1;
  }
  if (termScore !== 0) {
    score += termScore;
    steps.push({ label: "Term matches", value: termScore });
  }

  // 2. Depth Penalty/Boost (Favor shallow files)
  const depth = p.split("/").length;
  if (depth <= 2) {
    score += 2;
    steps.push({ label: "Shallow file boost", value: 2 });
  }

  // 3. Structural Boosts (Auditor V2 Weights)
  if (p.includes("controller")) {
    score += 3;
    steps.push({ label: "Controller boost", value: 3 });
  }
  if (p.includes("model") || p.includes("entities") || p.includes("schema")) {
    score += 3;
    steps.push({ label: "Model/Schema boost", value: 3 });
  }
  if (p.includes("service") || p.includes("logic") || p.includes("usecase")) {
    score += 2;
    steps.push({ label: "Domain service boost", value: 2 });
  }
  if (p.includes("index") || p.includes("main") || p.includes("app") || p.includes("server")) {
    score += 2;
    steps.push({ label: "Entry point boost", value: 2 });
  }

  // 4. Noise Penalties
  if (p.includes("provider") || p.includes("adapter")) {
    score -= 2;
    steps.push({ label: "Boilerplate penalty (Provider/Adapter)", value: -2 });
  }
  if (p.includes("config") || p.includes(".json") || p.includes(".yaml")) {
    score -= 1;
    steps.push({ label: "Config noise penalty", value: -1 });
  }
  
  if (p.includes('/public/')) { score -= 4; steps.push({ label: "Public asset penalty", value: -4 }); }
  if (p.includes('/vendor/')) { score -= 4; steps.push({ label: "Vendor penalty", value: -4 }); }
  if (p.includes('/node_modules/')) { score -= 5; steps.push({ label: "Dependency penalty", value: -5 }); }

  // 5. Stack Alignment
  if (intelligence?.primary && p.includes(intelligence.primary.toLowerCase())) {
    score += 2;
    steps.push({ label: `Stack alignment (${intelligence.primary})`, value: 2 });
  }

  return { score, steps };
}

const structureCache = new Map<string, { files: string[], ts: number }>();
const STRUCTURE_TTL = 30 * 1000; // 30 seconds structure cache

export function buildContext(projectDir) {
  const absProjectDir = path.resolve(projectDir);
  
  // 1. Get structure from scan (deterministic ordering)
  let allFiles: string[] = [];
  
  console.log('[XENTARI] SCANNING:', absProjectDir);
  console.time('[XENTARI] SCAN');
  allFiles = globSync("**/*.{js,ts,php,py,go,astro,vue,svelte,css,html}", {
    cwd: absProjectDir,
    ignore: [
      "**/node_modules/**", 
      "**/vendor/**", 
      "**/dist/**", 
      "**/build/**", 
      "**/.*/**",
      "**/storage/**",
      "**/bootstrap/cache/**"
    ],
    nodir: true,
    follow: false
  }).sort((a, b) => a.localeCompare(b)); // Deterministic sort
  
  console.timeEnd('[XENTARI] SCAN');
  console.log('[XENTARI] FILES FOUND:', allFiles.length);

  // Smart selection of important files based on structure and common patterns
  const priorityTerms = ["index", "main", "app", "server", "routes", "api", "service", "model", "controller"];
  
  const importantFiles = allFiles
    .sort((a, b) => {
      const aScore = priorityTerms.reduce((s, term) => {
        return s + (a.toLowerCase().includes(term.toLowerCase()) ? 2 : 0);
      }, 0);
      const bScore = priorityTerms.reduce((s, term) => {
        return s + (b.toLowerCase().includes(term.toLowerCase()) ? 2 : 0);
      }, 0);

      // Favor shallow files
      const aDepth = a.split("/").length;
      const bDepth = b.split("/").length;
      
      const scoreDiff = (bScore - bDepth) - (aScore - aDepth);
      if (scoreDiff !== 0) return scoreDiff;
      
      // Deterministic tie-breaker
      return a.localeCompare(b);
    })
    .slice(0, 20) // Top 20 candidate files
    .sort((a, b) => a.localeCompare(b)); // FINAL STABLE SORT

  return {
    structure: [...allFiles].sort((a, b) => a.localeCompare(b)).slice(0, 100), // Stable structure
    snippets: importantFiles.map(file => {
      const full = path.join(projectDir, file);
      // Only read if it exists and is small enough
      if (fs.existsSync(full)) {
        return {
          path: file,
          content: fs.readFileSync(full, "utf-8").slice(0, 1000) // Reduced from 1500
        };
      }
      return null;
    }).filter(Boolean),
    files: importantFiles
  };
}
