import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import crypto from "node:crypto";
import { log } from "../logger.js";

/**
 * 🧠 XENTARI — PHASE 8: CONSISTENCY ENGINE
 */

export type FileSnapshot = {
  hash: string;
  exports: string[];
};

export type SystemSnapshot = {
  files: Record<string, FileSnapshot>;
  relations: Record<string, string[]>;
};

const DEFAULT_RELATIONS: Record<string, string[]> = {
  "controller": ["service"],
  "service": ["model"],
  "routes": ["controller"]
};

/**
 * 1. SNAPSHOT CAPTURE
 */
export function captureFileSnapshot(filePath: string, content: string): FileSnapshot {
  return {
    hash: crypto.createHash("sha1").update(content).digest("hex"),
    exports: extractExports(content)
  };
}

/**
 * 2. EXPORT EXTRACTOR
 */
export function extractExports(content: string): string[] {
  // Support both CommonJS and ES Modules exports (basic detection)
  const cjsMatch = content.match(/module\.exports\s*=\s*{([^}]*)}/);
  if (cjsMatch) {
    return cjsMatch[1]
      .split(',')
      .map(s => s.trim().split(':')[0].split(/\s+/).pop() || "")
      .filter(s => s.length > 0);
  }

  const esmMatches = [...content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)];
  if (esmMatches.length > 0) {
    return esmMatches.map(m => m[1]);
  }

  const constMatches = [...content.matchAll(/export\s+const\s+(\w+)/g)];
  return constMatches.map(m => m[1]);
}

/**
 * 3. CONTRACT VALIDATION
 */
export function validateContracts(targetFile: { path: string, content: string, role?: string }, snapshot: SystemSnapshot) {
  if (!targetFile.role) return;

  const dependencies = DEFAULT_RELATIONS[targetFile.role] || [];
  
  // Find which files in the snapshot match the required roles
  // For simplicity in Phase 8, we look at files that contain the role name in their path
  for (const role of dependencies) {
    const relatedFiles = Object.keys(snapshot.files).filter(f => f.includes(role));
    
    for (const depPath of relatedFiles) {
      const expected = snapshot.files[depPath]?.exports || [];
      const used = extractUsedFunctions(targetFile.content, role);

      for (const fn of used) {
        if (!expected.includes(fn)) {
           log.warn(`[CONSISTENCY] Contract mismatch: '${fn}' not found in ${depPath} exports.`);
           throw new Error(`CONTRACT_MISMATCH: '${fn}' is used but not exported by ${depPath}`);
        }
      }
    }
  }
}

/**
 * Extract functions used from a specific dependency/module
 */
function extractUsedFunctions(content: string, moduleName: string): string[] {
  // Look for patterns like moduleName.functionName()
  const regex = new RegExp(`${moduleName}\\.(\\w+)`, 'g');
  const matches = [...content.matchAll(regex)];
  return [...new Set(matches.map(m => m[1]))];
}

/**
 * 4. STALE CONTEXT CHECK
 */
export function checkStale(filePath: string, content: string, recordedHash: string) {
  const currentHash = crypto.createHash("sha1").update(content).digest("hex");
  if (currentHash !== recordedHash) {
    throw new Error("STALE_CONTEXT: File changed since snapshot was taken.");
  }
}

/**
 * Persistence for Snapshots
 */
export function loadSnapshot(projectDir: string): SystemSnapshot {
  const path = join(projectDir, ".xentari", "snapshot.json");
  if (!existsSync(path)) return { files: {}, relations: DEFAULT_RELATIONS };
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { files: {}, relations: DEFAULT_RELATIONS };
  }
}

export function saveSnapshot(projectDir: string, snapshot: SystemSnapshot) {
  const path = join(projectDir, ".xentari", "snapshot.json");
  writeFileSync(path, JSON.stringify(snapshot, null, 2));
}

/**
 * 6. POST-STEP VALIDATION
 */
export function updateSnapshotAfterStep(projectDir: string, filePath: string, content: string) {
  const snapshot = loadSnapshot(projectDir);
  snapshot.files[filePath] = captureFileSnapshot(filePath, content);
  saveSnapshot(projectDir, snapshot);
}
