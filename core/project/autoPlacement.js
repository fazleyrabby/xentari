import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Deterministically resolves the best location for a new file based on its name and project structure.
 * 
 * @param {string} fileName The name of the file to place.
 * @param {string} projectDir The root directory of the project.
 * @returns {path: string, confidence: "HIGH" | "MEDIUM" | "LOW"}
 */
export function resolveFileLocation(fileName, projectDir) {
  const projectDirs = readdirSync(projectDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
    .map(dirent => dirent.name);

  const mappings = {
    "controller": "src/controllers",
    "route": "src/routes",
    "service": "src/services",
    "model": "src/models",
    "middleware": "src/middleware"
  };

  const lowerFile = fileName.toLowerCase();

  // Step 1: Rule-based mapping (HIGH confidence)
  for (const [key, dir] of Object.entries(mappings)) {
    if (lowerFile.includes(key)) {
      // Check if the specific subdirectory exists
      const fullDir = join(projectDir, dir);
      if (existsSync(fullDir)) {
        return { path: dir, confidence: "HIGH" };
      }
    }
  }

  // Step 2: Fallback to best matching existing directory (MEDIUM confidence)
  for (const [key, dir] of Object.entries(mappings)) {
    if (lowerFile.includes(key)) {
       // Look for any directory that contains the keyword
       const match = projectDirs.find(d => d.toLowerCase().includes(key));
       if (match) {
         return { path: match, confidence: "MEDIUM" };
       }
    }
  }

  // Step 3: Similarity Match on all existing dirs (MEDIUM/LOW)
  // (Simple string match ONLY as per rules)
  const keywords = ["controller", "route", "service", "model", "middleware", "util", "api"];
  for (const kw of keywords) {
    if (lowerFile.includes(kw)) {
      const match = projectDirs.find(d => d.toLowerCase().includes(kw));
      if (match) return { path: match, confidence: "MEDIUM" };
    }
  }

  // Step 4: Fallback to root (LOW confidence)
  return { path: "root", confidence: "LOW" };
}
