import { log } from "../logger.js";

/**
 * 🧠 XENTARI — PHASE 9: INTENT ENGINE
 */

export type IntentType = "modify" | "refactor" | "add" | "remove";
export type IntentScope = "file" | "module" | "system";

export type Intent = {
  type: IntentType;
  scope: IntentScope;
  description: string;
  target?: string;
  module?: string;
};

/**
 * 1. INTENT CHECKER
 * Determines if a contract break is allowed based on intent.
 */
export function intentAllowsContractBreak(intent: Intent): boolean {
  if (intent.type === "refactor") return true;
  if (intent.type === "remove") return true;
  return false;
}

/**
 * 2. SCOPE ENFORCER
 * Ensures the target file is within the intended scope.
 */
export function isWithinScope(targetPath: string, intent: Intent): boolean {
  if (intent.scope === "file") {
    return targetPath === intent.target;
  }
  if (intent.scope === "module" && intent.module) {
    // Check if path contains the module name or is in the module directory
    return targetPath.includes(intent.module);
  }
  // System scope allows anything
  return true;
}

/**
 * 5. MINIMAL CHANGE ENFORCER (Heuristic)
 * Checks if the diff size is reasonable for the intent.
 */
export function validateChangeSize(oldContent: string, newContent: string, intent: Intent): { valid: boolean; reason?: string } {
  const oldLines = oldContent.split("\n").length;
  const newLines = newContent.split("\n").length;
  const lineDiff = Math.abs(oldLines - newLines);
  
  // Refactors and removals can have large diffs
  if (intent.type === "refactor" || intent.type === "remove") {
    return { valid: true };
  }
  
  // For simple modifications, we expect the file size to not explode
  const MAX_GROWTH_RATIO = 1.5;
  if (newLines > oldLines * MAX_GROWTH_RATIO && newLines > 50) {
    return { valid: false, reason: "OVER_MODIFICATION: File size increased significantly beyond intent." };
  }
  
  return { valid: true };
}
