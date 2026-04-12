import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { log } from "./logger.js";

/**
 * Pattern Engine for Xentari Phase 4: Structure Enforcement.
 */

export function loadPattern(name) {
  const patternPath = join(process.cwd(), "context/patterns", `${name}.pattern.cjs`);
  if (!existsSync(patternPath)) {
    log.warn(`[PATTERN] Pattern not found: ${name}`);
    return null;
  }
  return readFileSync(patternPath, "utf-8");
}

export function validateStructure(content, role, patternName) {
  if (!content) {
    throw new Error("EMPTY_CONTENT");
  }

  // CommonJS Export Check
  if (!content.includes("module.exports")) {
    throw new Error("INVALID_EXPORT: module.exports is required for patterns");
  }

  // Pattern Specific Checks
  if (patternName === "controller") {
    if (!content.includes("req") || !content.includes("res")) {
      throw new Error("INVALID_CONTROLLER_STRUCTURE: missing req/res usage");
    }
    if (!content.includes("service")) {
      throw new Error("MISSING_SERVICE_USAGE: controller should use service");
    }
  }

  if (patternName === "routes") {
    if (!content.includes("express.Router()")) {
      throw new Error("INVALID_ROUTES_STRUCTURE: missing express.Router()");
    }
  }

  // Forbidden: ES modules in CJS patterns
  if (content.includes("export default") || content.includes("import ")) {
    throw new Error("FORBIDDEN_ES_MODULES: Pattern must remain CommonJS");
  }

  return true;
}
