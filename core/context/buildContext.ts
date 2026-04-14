import fs from "fs";
import path from "path";
import { globSync } from "glob";

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
