/**
 * PHASE 1 — INPUT NORMALIZATION
 * Rules: lowercase, trim whitespace, collapse multiple spaces, remove trailing punctuation.
 */
export function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .replace(/[!.?]+$/, ''); // remove trailing punctuation
}
