import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { log } from "./logger.js";
import { loadConfig } from "./config.js";
import { loadStack } from "./loadStack.js";

/**
 * Pattern Engine for Xentari E3 — Structure Enforcement.
 */

export async function loadPattern(name) {
  const config = loadConfig();
  const stack = await loadStack(config.stack || "node-basic");

  // E10: Check if stack provides the pattern
  if (stack && stack.patterns && stack.patterns[name]) {
    return stack.patterns[name];
  }

  // Fallback to legacy path
  const patternPath = join(process.cwd(), "context/patterns", `${name}.pattern.js`);
  if (!existsSync(patternPath)) {
    throw new Error(`PATTERN_REQUIRED: ${name}`);
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

  // Forbidden: Classes (E3 — Structure Enforcement requirement: Function-based structure)
  if (/\bclass\b/.test(cleanContent)) {
    throw new Error("FORBIDDEN_CLASS: Classes are not allowed. Use the function-based pattern.");
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
