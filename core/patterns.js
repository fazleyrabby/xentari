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

  // Strip strings and comments to avoid false positives in literal values or documentation
  const cleanContent = content
    .replace(/['"`](?:\\.|[^'"`])*['"`]/g, "")
    .replace(/\/\/.*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Forbidden: ES modules in CJS patterns
  if (cleanContent.includes("export default") || cleanContent.includes("import ")) {
    throw new Error("FORBIDDEN_ES_MODULES: Pattern must remain CommonJS");
  }

  // Pattern Specific Checks
  if (patternName === "controller") {
    if (!/\breq\b/.test(cleanContent) || !/\bres\b/.test(cleanContent)) {
      throw new Error("INVALID_CONTROLLER_STRUCTURE: missing req/res usage");
    }
    if (!/\bservice\b/.test(cleanContent)) {
      throw new Error("MISSING_SERVICE_USAGE: controller should use service");
    }
  }

  if (patternName === "routes") {
    if (!cleanContent.includes("express.Router()")) {
      throw new Error("INVALID_ROUTES_STRUCTURE: missing express.Router()");
    }
  }

  return true;
}
