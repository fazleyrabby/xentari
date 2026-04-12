import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPatch } from "diff";

/**
 * Generates a standard unified diff patch for a file.
 * Handles both new file creation and modifications to existing files.
 */
export function generateDiff(projectDir, filePath, newContent) {
  if (typeof newContent !== "string" || newContent.length === 0) {
    throw new Error(`Invalid generated file content for ${filePath}`);
  }

  const fullPath = join(projectDir, filePath);
  const fileExists = existsSync(fullPath);

  let oldContent = "";
  if (fileExists) {
    try {
      oldContent = readFileSync(fullPath, "utf-8");
    } catch (err) {
      throw new Error(`Cannot read file ${filePath}: ${err.message}`);
    }
  }

  // Use the diff library's createPatch for robust hunk management
  const patch = createPatch(filePath, oldContent, newContent, "", "", { context: 3 });

  // Post-process the patch to match Zentari's expected git diff format
  const lines = patch.split("\n");
  const header = `diff --git a/${filePath} b/${filePath}`;
  
  const resultLines = [header];
  if (!fileExists) {
    resultLines.push("new file mode 100644");
    resultLines.push("--- /dev/null");
  } else {
    resultLines.push(`--- a/${filePath}`);
  }
  resultLines.push(`+++ b/${filePath}`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("@@")) {
      resultLines.push(...lines.slice(i));
      break;
    }
  }

  const finalPatch = resultLines.join("\n").trim() + "\n";

  if (!finalPatch.includes("@@")) {
    return null; 
  }

  return finalPatch;
}

/**
 * Converts multiple file updates into a single unified diff string.
 */
export function patchToUnified(projectDir, fileUpdates) {
  if (!fileUpdates || fileUpdates.length === 0) {
    throw new Error("No file updates provided");
  }

  const diffs = [];

  for (const { file, content } of fileUpdates) {
    if (!file) {
      throw new Error("Cannot generate diff: file path missing from content");
    }

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
