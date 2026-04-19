export function isNoiseFile(path: string) {
  const p = path.toLowerCase();

  return (
    p.includes('node_modules') ||
    p.includes('vendor/') ||
    p.includes('dist/') ||
    p.includes('build/') ||
    p.includes('.git/') ||
    p.includes('public/') ||
    p.endsWith('.min.js') ||
    p.endsWith('.map') ||
    p.endsWith('.lock')
  );
}

export function isTooLarge(content: string) {
  return content.length > 20000; // ~20KB
}

export function hasLowSignal(content: string, terms: string[]) {
  if (terms.length === 0) return false;
  
  // Broad queries like "analyze project" shouldn't filter by signal
  const broadTerms = ['analyze', 'project', 'structure', 'architecture', 'overview'];
  if (terms.some(t => broadTerms.includes(t))) return false;

  let matches = 0;
  const lowerContent = content.toLowerCase();

  for (const term of terms) {
    if (lowerContent.includes(term.toLowerCase())) matches++;
  }

  // If we only have 1-2 search terms, be very lenient
  if (terms.length <= 2) return matches === 0;
  
  // Otherwise require at least a small signal
  return matches === 0;
}

export function extractQueryTerms(input: string): string[] {
  // Simple term extraction: words longer than 3 chars, ignoring common stops
  const stops = new Set(['this', 'that', 'with', 'from', 'here', 'there', 'code', 'file', 'project']);
  return input
    .toLowerCase()
    .split(/\W+/)
    .filter(word => word.length > 3 && !stops.has(word));
}

export function boostImportant(path: string): number {
  const p = path.toLowerCase();

  if (p.includes('routes')) return 3;
  if (p.includes('controller')) return 3;
  if (p.includes('service')) return 2;
  if (p.includes('config')) return 2;

  return 0;
}
