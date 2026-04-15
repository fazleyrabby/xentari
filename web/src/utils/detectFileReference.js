export function detectFileReference(input) {
  // Regex to match file paths with optional line numbers (e.g., src/main.js:32 or path/to/file.ts)
  const match = input.match(/([\w\/\.-]+\.(js|ts|jsx|tsx|astro|vue|py|php|css|html))(?::?(\d+))?/i);

  if (!match) return null;

  return {
    path: match[1],
    line: match[3] ? parseInt(match[3]) : null,
  };
}
