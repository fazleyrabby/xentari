export function isBlockedCommand(command) {
  const blockedPatterns = [
    /&&/,
    /\|\|/,
    /\|/,
    />/,
    />>/,
    /;/,
    /\bsudo\b/,
    /\brm\b/,
    /\bmkfs\b/,
    /\bdd\b/,
    /\bshutdown\b/,
    /\breboot\b/,
  ];

  return blockedPatterns.some((pattern) => pattern.test(command));
}

export function validatePolicy(command) {
  if (!command || typeof command !== "string") {
    throw new Error("Invalid command");
  }

  if (isBlockedCommand(command)) {
    return {
      allowed: false,
      reason: "Blocked by execution policy",
    };
  }

  return { allowed: true };
}
