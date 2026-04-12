import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createPatch } from "diff";
/**
 * Generates a standard unified diff patch for a file.
 * Handles both new file creation and modification.
 */
export function generateDiff(projectDir, filePath, newContent) {
    const fullPath = join(projectDir, filePath);
    let oldContent = "";
    if (existsSync(fullPath)) {
        try {
            oldContent = readFileSync(fullPath, "utf-8");
        }
        catch (err) {
            console.warn(`Could not read file for diff: ${filePath}`);
        }
    }
    // Normalize line endings for consistent diffing
    const normalizedOld = oldContent.replace(/\r\n/g, "\n");
    const normalizedNew = newContent.replace(/\r\n/g, "\n");
    if (normalizedOld === normalizedNew) {
        return "";
    }
    return createPatch(filePath, normalizedOld, normalizedNew, "a/" + filePath, "b/" + filePath);
}
/**
 * Higher level function to generate a multi-file unified patch.
 */
export function patchToUnified(projectDir, fileUpdates) {
    const diffs = [];
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
