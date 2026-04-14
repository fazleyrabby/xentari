/**
 * E11 — Exploit-Resistant Command Parser
 * Normalizes and tokenizes commands into structures.
 */
export function tokenize(command) {
  if (typeof command !== "string") {
    throw new Error("Command must be string");
  }

  // Normalization (NFKC) prevents unicode bypasses (e.g. using full-width ampersands)
  const normalizedText = command.normalize("NFKC");
  
  // Normalize whitespace
  const normalized = normalizedText.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return { valid: false, reason: "Empty command" };
  }

  // Reject dangerous characters early (Command Injection Prevention)
  const forbiddenChars = ["&", "|", ";", ">", "<", "`", "$", "(", ")"];
  for (const char of forbiddenChars) {
    if (normalized.includes(char)) {
      return { valid: false, reason: `Forbidden character detected: ${char}` };
    }
  }

  const parts = normalized.split(" ");

  return {
    valid: true,
    command: parts[0],
    args: parts.slice(1),
    raw: normalized
  };
}
