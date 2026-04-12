import fs from "fs";
import path from "path";

export function getChangedFiles(originalRoot, sandboxRoot) {
  const changes = [];

  function walk(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const full = path.join(dir, file);
      const rel = path.relative(sandboxRoot, full);
      const original = path.join(originalRoot, rel);

      // Skip common ignored directories to avoid deep recursion in large projects
      if (file === "node_modules" || file === ".git" || file === "dist" || file === "logs") {
        continue;
      }

      if (fs.statSync(full).isDirectory()) {
        walk(full);
      } else {
        const newContent = fs.readFileSync(full, "utf-8");
        const oldContent = fs.existsSync(original)
          ? fs.readFileSync(original, "utf-8")
          : "";

        if (newContent !== oldContent) {
          changes.push({ file: rel, oldContent, newContent });
        }
      }
    }
  }

  walk(sandboxRoot);
  return changes;
}
