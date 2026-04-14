/**
 * Xentari UI Normalization Layer
 */

/**
 * Normalizes unicode characters to NFKC to ensure alignment stability.
 */
export function normalize(text) {
  if (typeof text !== "string") return "";
  return text.normalize("NFKC");
}

/**
 * Forces single-line behavior by replacing newlines with spaces.
 */
export function singleLine(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\n/g, " ").trim();
}
