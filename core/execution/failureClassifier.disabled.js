/**
 * E12 — Failure Classification System
 * Maps error messages to failure types and retry eligibility.
 */
export function classifyFailure(result) {
  const msg = result.error || result.stderr || "";

  if (msg.includes("not found") || msg.includes("ENOENT")) {
    return { type: "ENVIRONMENT", retry: false };
  }

  if (msg.includes("permission")) {
    return { type: "PERMISSION", retry: false };
  }

  if (msg.includes("syntax")) {
    return { type: "CODE", retry: true };
  }

  if (msg.includes("validation")) {
    return { type: "VALIDATION", retry: true };
  }

  return { type: "UNKNOWN", retry: false };
}
