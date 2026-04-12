import path from "path";
import fs from "fs";

export function resolveProjectRoot(inputPath) {
  if (inputPath) {
    return path.resolve(inputPath);
  }

  let dir = process.cwd();

  while (dir !== path.dirname(dir)) {
    if (
      fs.existsSync(path.join(dir, "package.json")) ||
      fs.existsSync(path.join(dir, ".git"))
    ) {
      return dir;
    }

    dir = path.dirname(dir);
  }

  return process.cwd();
}
