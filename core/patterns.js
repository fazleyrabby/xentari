import { loadConfig } from "./config.js";
import { loadStack } from "./loadStack.js";
import { log } from "./logger.js";

/**
 * Pattern Engine for Xentari E3 — Structure Enforcement.
 * 
 * E10: Fully Stack-Agnostic. Loads patterns ONLY from the active stack.
 */

function validatePatterns(patterns, stackName) {
  if (!patterns || typeof patterns !== "object") {
    throw new Error(`[PATTERN ERROR] Invalid patterns for stack: ${stackName}`);
  }

  if (Object.keys(patterns).length === 0) {
    throw new Error(`[PATTERN ERROR] Empty patterns for stack: ${stackName}`);
  }

  return true;
}

export async function loadPattern(name) {
  const config = loadConfig();
  const stack = await loadStack(config.stack || "node-basic");

  if (!stack || !stack.patterns) {
    log.error("[PATTERNS] INVALID_STACK_ADAPTER: Missing patterns");
    throw new Error("INVALID_STACK_ADAPTER: Missing patterns");
  }

  validatePatterns(stack.patterns, config.stack || "node-basic");

  // E10: Check if stack provides the pattern
  if (stack.patterns[name]) {
    return stack.patterns[name];
  }

  throw new Error(`PATTERN_REQUIRED_BUT_MISSING_IN_STACK: ${name} (Stack: ${config.stack || "node-basic"})`);
}

/**
 * Validates the structure of the generated code against stack-defined rules.
 */
export function validateStructure(content, role, patternName, stack = null) {
  if (!content) {
    throw new Error("EMPTY_CONTENT");
  }

  // If stack is provided, use its validator
  if (stack && stack.validator) {
    const result = stack.validator(content, role, patternName);
    if (!result.valid) {
      throw new Error(result.reason || "STACK_VALIDATION_FAILED");
    }
    return true;
  }

  // Minimal baseline validation if stack validator is missing (should not happen in E10)
  if (!content.includes("module.exports") && !content.includes("export ")) {
    throw new Error("INVALID_EXPORT: Missing exports");
  }

  return true;
}
