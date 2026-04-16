/**
 * E11 — Exploit-Resistant Policy Engine
 * Enforces structured command restrictions.
 */
export function validatePolicy(parsed) {
  if (!parsed.valid) {
    return { allowed: false, reason: parsed.reason };
  }

  // System-level dangerous commands
  const blockedCommands = [
    "rm",
    "dd",
    "mkfs",
    "shutdown",
    "reboot",
    "poweroff",
    "sudo",
    "chmod",
    "chown",
    "apt",
    "yum",
    "brew",
    "dnf",
    "pacman"
  ];

  if (blockedCommands.includes(parsed.command)) {
    return {
      allowed: false,
      reason: `Blocked by system policy: command '${parsed.command}' is forbidden.`
    };
  }

  return { allowed: true };
}
