import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve, dirname, isAbsolute } from "node:path";

export interface File {
  path: string;
  content: string;
}

export interface ApplyResult {
  created: string[];
  skipped: string[];
}

export function applyFiles(files: File[], rootPath: string): ApplyResult {
  const absoluteRoot = resolve(rootPath);
  const result: ApplyResult = {
    created: [],
    skipped: []
  };

  for (const file of files) {
    let absolutePath = isAbsolute(file.path) ? resolve(file.path) : resolve(join(absoluteRoot, file.path));

    // Path Safety: Ensure it's inside rootPath
    if (!absolutePath.startsWith(absoluteRoot)) {
      throw new Error(`Unsafe path detected: ${file.path} is outside of ${rootPath}`);
    }

    if (existsSync(absolutePath)) {
      result.skipped.push(file.path);
    } else {
      // Create directory if it doesn't exist
      const dir = dirname(absolutePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(absolutePath, file.content);
      result.created.push(file.path);
    }
  }

  return result;
}
