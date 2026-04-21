/**
 * PHASE 2 — DETERMINISTIC SPLITTING
 * Split tokens: " and ", ",", " then ", " & "
 */
export function splitInstructions(input: string): string[] {
  // Use a regex to split by any of the specified tokens
  const tokens = [" and ", ",", " then ", " & "];
  const regex = new RegExp(tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
  
  return input
    .split(regex)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}
