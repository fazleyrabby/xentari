import { writeFileSync, unlinkSync, existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { loadConfig } from "./config.js";
import { getTierProfile } from "./tier.js";
import { askApproval } from "./approval/approver.ts";
import { APPROVAL_TYPES } from "./approval/approvalTypes.ts";
import { diffInteractive } from "./tui/index.js";
import { safePath } from "./project/guard.js";
import { interactiveDiff, simpleDiffPreview } from "./tui/diffViewerInteractive.js";
import { splitDiff, rebuildDiff } from "./patch/partial.js";
import { parseDiff } from "./diff/parser.js";
import { alignDiff } from "./diff/align.js";
import { renderDiff } from "./tui/diffView.js";
import { confirm } from "./prompt.js";
import { log } from "./logger.js";
import { resolveFileLocation } from "./project/autoPlacement.js";
import readline from "node:readline";



function tmpPatchPath() {
  const id = randomBytes(6).toString("hex");
  return join(tmpdir(), `xentari-${id}.patch`);
}

function extractFilesFromPatch(patch) {
  const files = [];
  const matches = patch.matchAll(/^diff --git a\/(.+?) b\//gm);
  for (const match of matches) {
    files.push(match[1]);
  }
  return files;
}

export function validatePatch(patch) {
  const config = loadConfig();
  const profile = getTierProfile();
  const errors = [];

  if (!patch || typeof patch !== "string") {
    return { valid: false, errors: ["Patch is empty or not a string"] };
  }
  if (!patch.includes("@@")) {
    errors.push('Missing "@@" hunk markers');
  }

  const diffCount = (patch.match(/^diff --git/gm) || []).length;
  if (diffCount > profile.maxPatchFiles) {
    errors.push(`Too many files in patch: ${diffCount} files, max allowed: ${profile.maxPatchFiles}`);
  }
  if (patch.length > profile.maxPatchChars) {
    errors.push(`Patch too large (${patch.length} chars, max ${profile.maxPatchChars})`);
  }

  return { valid: errors.length === 0, errors };
}

async function handleMissingFile(projectDir, errorPath) {
  const fileName = errorPath.split("/").pop();
  try {
    const { path: solvedPath, confidence } = resolveFileLocation(fileName, projectDir);
    let selectedRelativePath = null;

    if (confidence === "HIGH") {
      log.ok(`[PLACEMENT] Auto-selected: ${solvedPath} (Confidence: HIGH)`);
      selectedRelativePath = join(solvedPath, fileName);
    } else if (confidence === "MEDIUM") {
      log.info(`[PLACEMENT] Suggestion: ${solvedPath} (Confidence: MEDIUM)`);
      selectedRelativePath = join(solvedPath, fileName);
    } else {
      const shouldCreate = await confirm(`File '${fileName}' does not exist. Create it?`);
      if (!shouldCreate) return null;

      const projectDirs = readdirSync(projectDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith('.'))
        .map(dirent => dirent.name);
      
      const options = [...projectDirs, "root"];

      console.log("\nWhere do you want to create this file?");
      options.forEach((opt, idx) => console.log(`${idx + 1}. ${opt}/`));

      const choice = await new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        process.stdout.write(`Select option (1-${options.length}): `);
        rl.on("line", (line) => {
          rl.close();
          resolve(parseInt(line.trim()) - 1);
        });
      });





      const selectedDir = options[choice] !== undefined ? options[choice] : "root";
      selectedRelativePath = selectedDir === "root" ? fileName : join(selectedDir, fileName);
    }

    const fullPath = join(projectDir, selectedRelativePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, "");
    console.log(`\n✅ Created: ${selectedRelativePath}`);
    
    return { retry: true, filePath: selectedRelativePath, errorPath };
  } catch (err) {
    console.error(`Failed to handle missing file: ${err.message}`);
    return null;
  }
}


export async function applyPatch(projectDir, patch, dryRun = false, newContent = null) {
  let currentPatch = patch;
  // Task 4: Safe Path Guard & Directory Creation
  const files = extractFilesFromPatch(currentPatch);

  for (const file of files) {
    try {
      const fullPath = safePath(projectDir, file);
      const dir = dirname(fullPath);
      // Ensure directory exists before applying patch
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      return { applied: false, valid: false, reason: `Safety Error: ${err.message} (${file})` };
    }
  }

  const patchPath = tmpPatchPath();
  writeFileSync(patchPath, currentPatch, "utf-8");

  try {
    try {
      execSync(`git apply --check --ignore-whitespace "${patchPath}"`, {
        cwd: projectDir,
        stdio: "pipe",
      });
    } catch (err) {
      const stderr = err.stderr?.toString().trim() || err.message;
      if (stderr.includes("No such file or directory")) {
        const match = stderr.match(/([^:\s]+): No such file or directory/);
        if (match) {
          const res = await handleMissingFile(projectDir, match[1]);
          if (res && res.retry) {
            // Update patch and return retry signal
            const updatedPatch = currentPatch.split(res.errorPath).join(res.filePath);
            return { applied: false, valid: false, retry: true, patch: updatedPatch };
          }
        }
      }
      throw err;
    }



    if (dryRun) {
      return { applied: false, reason: "dry-run", valid: true };
    }

    // Try to extract old content for side-by-side preview
    const oldFileMatch = currentPatch.match(/^--- a\/(.+)$/m);
    const newFileMatch = currentPatch.match(/^\+\+\+ b\/(.+)$/m);
    let oldContent = "";
    let targetPath = "Unknown File";
    
    if (oldFileMatch) {
      targetPath = oldFileMatch[1];
    } else if (newFileMatch) {
      targetPath = newFileMatch[1];
    } else if (files.length > 0) {
      targetPath = files[0];
    }

    if (targetPath !== "Unknown File" && targetPath !== "/dev/null") {
      const originalPath = safePath(projectDir, targetPath);
      if (existsSync(originalPath)) {
        try {
          oldContent = readFileSync(originalPath, "utf-8");
        } catch {}
      }
    }

    let approved = false;
    let finalPatch = currentPatch;

    try {


      // Phase 51: Side-by-Side Diff Viewer (Colored)
      const parsed = parseDiff(currentPatch);
      const aligned = alignDiff(parsed);
      renderDiff(aligned);

      // Use the new interactive diff viewer
      if (newContent) {
        approved = await interactiveDiff(oldContent, newContent, targetPath);
      } else {
        diffInteractive.renderSideBySide(oldContent.slice(0, 5000), currentPatch.slice(0, 5000));
        approved = await diffInteractive.interactiveApprove();
      }

      // Phase 28: Partial Apply logic
      if (approved) {
        const hunks = splitDiff(currentPatch);

        if (hunks.length > 1) {
          console.log(`\nDetected ${hunks.length} changes (hunks).`);
          const wantPartial = await new Promise(res => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question("Apply all changes? (y) or select specific hunks? (s): ", (ans) => {
              rl.close();
              res(ans.trim().toLowerCase() === 's');
            });
          });

          if (wantPartial) {
            hunks.forEach((h, i) => {
              console.log(`\n[${i}] ------------------`);
              console.log(h.content.slice(0, 300) + (h.content.length > 300 ? "..." : ""));
            });

            const selectedIds = await new Promise(res => {
              const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
              rl.question("\nSelect hunk IDs to apply (comma separated, e.g. 0,2): ", (ans) => {
                rl.close();
                res(ans.split(",").map(n => parseInt(n.trim())).filter(n => !isNaN(n)));
              });
            });

            const selectedHunks = hunks.filter(h => selectedIds.includes(h.id));
            if (selectedHunks.length > 0) {
              finalPatch = rebuildDiff(selectedHunks);
              // Save the new partial patch
              writeFileSync(patchPath, finalPatch, "utf-8");
            } else {
              console.log("No hunks selected. Aborting.");
              return { applied: false, valid: true, reason: "user_rejected_all_hunks" };
            }
          }
        }
      }
    } catch (e) {
      console.warn("Fallback to simple diff");
      simpleDiffPreview(oldContent, newContent || currentPatch);

      approved = await askApproval({
        type: APPROVAL_TYPES.PATCH,
        message: "Apply changes?"
      });
    }

    if (!approved) {
      return { applied: false, valid: true, reason: "user_rejected_patch" };
    }

    execSync(`git apply --ignore-whitespace "${patchPath}"`, { cwd: projectDir, stdio: "pipe" });
    return { applied: true, valid: true };
  } catch (err) {
    const stderr = err.stderr?.toString().trim() || err.message;
    return { applied: false, valid: false, reason: stderr };
  } finally {
    try { unlinkSync(patchPath); } catch {}
  }
}

export function undo(projectDir) {
  execSync("git reset --hard HEAD", { cwd: projectDir, stdio: "pipe" });
}
