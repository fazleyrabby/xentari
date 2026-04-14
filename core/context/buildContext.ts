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
  if (p.includes("config") || p.includes("routes") || p.includes("package") || p.includes("composer")) score += 3;
  if (p.includes("node_modules") || p.includes("dist") || p.includes("build") || p.includes("public")) score -= 3;

  if (project?.type?.includes("backend")) {
    if (p.includes("routes")) score += 2;
    if (p.includes("config")) score += 2;
  }

  return score;
}

export function buildContext(projectDir) {
  const allFiles = globSync("**/*.{js,ts}", {
    cwd: projectDir,
    ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.*/**"],
    nodir: true
  });

  // Smart selection of important files
  const priorityTerms = ["runAgent", "index", "app", "server", "pipeline", "executor"];
  
  const importantFiles = allFiles
    .filter(f => f.includes("core/") || f.includes("bin/") || f === "server.js")
    .sort((a, b) => {
      const aScore = priorityTerms.reduce((s, term) => {
        const weight = term === "runAgent" ? 5 : 1; // Heavy weight for runAgent
        return s + (a.toLowerCase().includes(term.toLowerCase()) ? weight : 0);
      }, 0);
      const bScore = priorityTerms.reduce((s, term) => {
        const weight = term === "runAgent" ? 5 : 1;
        return s + (b.toLowerCase().includes(term.toLowerCase()) ? weight : 0);
      }, 0);
      return bScore - aScore;
    })
    .slice(0, 15); // Increase to 15 files for better coverage

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
