import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { loadConfig } from "./config.js";
import { getTierProfile } from "./tier.js";

function tmpPatchPath() {
  const id = randomBytes(6).toString("hex");
  return join(tmpdir(), `ai-tool-${id}.patch`);
}

export function validatePatch(patch) {
  const config = loadConfig();
  const profile = getTierProfile();
  const errors = [];

  if (!patch || typeof patch !== "string") {
    return { valid: false, errors: ["Patch is empty or not a string"] };
  }
  if (!patch.includes("diff --git")) {
    errors.push('Missing "diff --git" header');
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

export function applyPatch(projectDir, patch, dryRun = false) {
  const patchPath = tmpPatchPath();
  writeFileSync(patchPath, patch, "utf-8");

  try {
    execSync(`git apply --check --ignore-whitespace "${patchPath}"`, {
      cwd: projectDir,
      stdio: "pipe",
    });

    if (dryRun) {
      return { applied: false, reason: "dry-run", valid: true };
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
