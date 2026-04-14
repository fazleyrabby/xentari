/**
 * E11 — Exploit-Resistant Argument Validator
 * Blocks path traversal and absolute paths in command arguments.
 */
export function validateArgs(command, args) {
  for (const arg of args) {
    // Block path traversal (..)
    if (arg.includes("..")) {
      return {
        valid: false,
        reason: "Exploit detected: Path traversal in arguments"
      };
    }

    // Block absolute paths
    if (arg.startsWith("/")) {
      return {
        valid: false,
        reason: "Exploit detected: Absolute paths not allowed"
      };
    }
  }

  return { valid: true };
}
