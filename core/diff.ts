import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPatch } from "diff";

export type DiffChunk = {
  file: string;
  additions: number;
  deletions: number;
  content?: string;
};

/**
 * Generates a standard unified diff patch for a file.
 * Handles both new file creation and modification.
 */
export function generateDiff(projectDir: string, filePath: string, newContent: string): string {
  const fullPath = join(projectDir, filePath);
  let oldContent = "";
  let isNew = true;

  if (existsSync(fullPath)) {
    try {
      oldContent = readFileSync(fullPath, "utf-8");
      isNew = false;
    } catch (err) {
      console.warn(`Could not read file for diff: ${filePath}`);
    }
  }

  // Normalize line endings for consistent diffing
  const normalizedOld = oldContent.replace(/\r\n/g, "\n");
  const normalizedNew = newContent.replace(/\r\n/g, "\n");

  if (normalizedOld === normalizedNew) {
    return "";
  }

  const oldHeader = isNew ? "/dev/null" : "a/" + filePath;
  const newHeader = "b/" + filePath;

  let patch = createPatch(filePath, normalizedOld, normalizedNew, oldHeader, newHeader);
  
  // Remove the 'Index: ...' and '====' lines added by `diff` package
  patch = patch.replace(/^Index: [^\n]+\n=+\n/gm, "");

  // Fix the --- and +++ headers to be Git-compatible
  const oldPathHeader = isNew ? "/dev/null" : "a/" + filePath;
  const newPathHeader = "b/" + filePath;
  
  patch = patch.replace(/^--- [^\n]+\n/m, `--- ${oldPathHeader}\n`);
  patch = patch.replace(/^\+\+\+ [^\n]+\n/m, `+++ ${newPathHeader}\n`);

  // Add git headers
  const gitHeader = `diff --git a/${filePath} b/${filePath}\n` +
                    (isNew ? `new file mode 100644\n` : `index 0000000..0000000 100644\n`);

  return gitHeader + patch;
}


/**
 * Higher level function to generate a multi-file unified patch.
 */
export function patchToUnified(projectDir: string, fileUpdates: { file: string; content: string }[]): string {
  const diffs: string[] = [];

  for (const update of fileUpdates) {
    const { file, content } = update;
    const diff = generateDiff(projectDir, file, content);
    if (diff) {
      diffs.push(diff);
    }
  }

  if (diffs.length === 0) {
    throw new Error("No changes detected in any of the provided files");
  }

  return diffs.join("\n");
}
