import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { diffLines } from "diff";

function buildNewFileDiff(newContent, filePath) {
  const lines = newContent.split("\n").filter(l => l !== "");
  const lineCount = lines.length;
  
  const hunkLines = lines.map(line => "+" + line);
  
  return `diff --git a/${filePath} b/${filePath}
new file mode 100644
--- /dev/null
+++ b/${filePath}
@@ -0,0 +1,${lineCount} @@
${hunkLines.join("\n")}
`;
}

function buildUnifiedDiff(oldContent, newContent, filePath) {
  const changes = diffLines(oldContent, newContent);
  
  let oldLines = 0;
  let newLines = 0;
  const hunkLines = [];
  
  for (const change of changes) {
    const lines = change.value.split("\n");
    const lineCount = lines[lines.length - 1] === "" ? lines.length - 1 : lines.length;
    
    for (let i = 0; i < lineCount; i++) {
      const line = lines[i];
      if (change.added) {
        hunkLines.push("+" + line);
        newLines++;
      } else if (change.removed) {
        hunkLines.push("-" + line);
        oldLines++;
      } else {
        hunkLines.push(" " + line);
        oldLines++;
        newLines++;
      }
    }
  }

  const hasChanges = oldLines !== newLines || hunkLines.some(l => l.startsWith("+") || l.startsWith("-"));
  if (!hasChanges) {
    return null;
  }

  const hunkHeader = `@@ -1,${oldLines || 1} +1,${newLines || 1} @@`;
  
  return `diff --git a/${filePath} b/${filePath}
--- a/${filePath}
+++ b/${filePath}
${hunkHeader}
${hunkLines.join("\n")}
`;
}

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

  const isNewFile = !fileExists || (oldContent.trim() === "" && !fileExists);

  let patch;
  if (isNewFile) {
    patch = buildNewFileDiff(newContent, filePath);
  } else {
    patch = buildUnifiedDiff(oldContent, newContent, filePath);
  }
  
  if (!patch) {
    throw new Error(`No changes detected for ${filePath}`);
  }
  
  return patch;
}

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
    diffs.push(diff);
  }

  return diffs.join("\n");
}