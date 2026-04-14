import fs from "fs";
import path from "path";

export function resolveSafePath(projectPath, targetPath) {
  if (!targetPath) throw new Error("Target path is required");
  
  const absProject = path.resolve(projectPath);
  const absTarget = path.resolve(projectPath, targetPath);

  if (!absTarget.startsWith(absProject)) {
    throw new Error("Security Violation: Path traversal detected");
  }

  // Handle symlinks: ensure realpath also stays within project boundary
  if (fs.existsSync(absTarget)) {
    const realTarget = fs.realpathSync(absTarget);
    if (!realTarget.startsWith(absProject)) {
      throw new Error("Security Violation: Symlink points outside project boundary");
    }
  }

  return absTarget;
}

export function listFiles(projectPath, currentPath = "", depth = 0, maxDepth = 5) {
  if (depth > maxDepth) return [];

  const absCurrent = path.join(projectPath, currentPath);
  if (!fs.existsSync(absCurrent)) return [];

  const ignore = ["node_modules", ".git", ".xentari", "dist", ".DS_Store"];
  const entries = fs.readdirSync(absCurrent, { withFileTypes: true });

  const results = [];

  for (const entry of entries) {
    if (ignore.includes(entry.name)) continue;

    const relPath = path.join(currentPath, entry.name);
    
    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        path: relPath,
        type: "dir"
      });
      // Recurse
      results.push(...listFiles(projectPath, relPath, depth + 1, maxDepth));
    } else {
      results.push({
        name: entry.name,
        path: relPath,
        type: "file"
      });
    }
  }

  return results;
}

export function readFile(projectPath, relativePath) {
  const safePath = resolveSafePath(projectPath, relativePath);

  if (!fs.existsSync(safePath) || fs.lstatSync(safePath).isDirectory()) {
    throw new Error("File not found or is a directory");
  }

  const stats = fs.statSync(safePath);
  if (stats.size > 1024 * 1024) { // 1MB limit
    throw new Error("File too large (limit 1MB)");
  }

  const content = fs.readFileSync(safePath, "utf-8");
  return {
    content,
    path: relativePath
  };
}

export function writeFile(projectPath, relativePath, content) {
  const safePath = resolveSafePath(projectPath, relativePath);

  const dir = path.dirname(safePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(safePath, content, "utf-8");
  return true;
}
