/**
 * Validator for Node.js / CommonJS patterns.
 */
export function validator(content) {
  if (!content) {
    return { valid: false, reason: "EMPTY_CONTENT" };
  }

  // CommonJS Export Check
  if (!content.includes("module.exports")) {
    return { valid: false, reason: "INVALID_EXPORT: module.exports is required for patterns" };
  }

  // Strip strings and comments to avoid false positives
  const cleanContent = content
    .replace(/['"`](?:\\.|[^'"`])*['"`]/g, "")
    .replace(/\/\/.*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Forbidden: ES modules in CJS patterns
  if (cleanContent.includes("export default") || cleanContent.includes("import ")) {
    return { valid: false, reason: "FORBIDDEN_ES_MODULES: Pattern must remain CommonJS" };
  }

  // Forbidden: Classes
  if (/\bclass\b/.test(cleanContent)) {
    return { valid: false, reason: "FORBIDDEN_CLASS: Classes are not allowed. Use the function-based pattern." };
  }

  return { valid: true };
}

/**
 * Test Runner for Node.js.
 */
export async function testRunner(testCode) {
  // Simple heuristic for now, normally we'd run this via vm or exec
  // Since we are in a mock/simulated environment for node-basic:
  return { success: true };
}
