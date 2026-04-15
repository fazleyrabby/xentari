import fs from "fs";
import path from "path";
import { globSync } from "glob";

export function scoreFile(file: { path: string; content: string }, input: string, project?: { type?: string }): number {
  let score = 0;
  const p = file.path.toLowerCase();
  const c = file.content.toLowerCase();

  for (const k of input.toLowerCase().split(/\s+/)) {
    if (p.includes(k)) score += 3;
    if (c.includes(k)) score += 1;
  }

  if (p.split("/").length <= 2) score += 2;

  if (p.includes("index") || p.includes("main") || p.includes("app") || p.includes("server")) score += 3;
  if (p.includes("config") || p.includes("routes") || p.includes("package") || p.includes("composer") || p.endsWith(".php")) score += 2;
  
  // Noise Penalties
  if (p.includes('/public/')) score -= 4;
  if (p.includes('/vendor/')) score -= 4;
  if (p.includes('/node_modules/')) score -= 5;

  // Core Boosts
  if (p.includes('/routes/')) score += 3;
  if (p.includes('/app/')) score += 3;
  if (p.includes('/src/')) score += 2;

  if (project?.type?.includes("backend")) {
    if (p.includes("routes")) score += 2;
    if (p.includes("config")) score += 2;
  }

  return score;
}

const structureCache = new Map<string, { files: string[], ts: number }>();
const STRUCTURE_TTL = 30 * 1000; // 30 seconds structure cache

export function buildContext(projectDir) {
  const absProjectDir = path.resolve(projectDir);
  
  // 1. Get structure from cache or scan
  let allFiles: string[] = [];
  const cached = structureCache.get(absProjectDir);
  if (cached && (Date.now() - cached.ts < STRUCTURE_TTL)) {
    allFiles = cached.files;
  } else {
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
    });
    structureCache.set(absProjectDir, { files: allFiles, ts: Date.now() });
    console.timeEnd('[XENTARI] SCAN');
    console.log('[XENTARI] FILES FOUND:', allFiles.length);
  }

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
      
      return (bScore - bDepth) - (aScore - aDepth);
    })
    .slice(0, 20); // Top 20 candidate files

  return {
    structure: allFiles.slice(0, 100), // Show more structure (up to 100 files)
    snippets: importantFiles.map(file => {
      const full = path.join(projectDir, file);
      // Only read if it exists and is small enough
      if (fs.existsSync(full)) {
        return {
          path: file,
          content: fs.readFileSync(full, "utf-8").slice(0, 1500) // More content per file
        };
      }
      return null;
    }).filter(Boolean),
    files: importantFiles
  };
}
