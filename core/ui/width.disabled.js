/**
 * Xentari UI Width Engine
 */

export function getWidth() {
  return process.stdout.columns || 80;
}

/**
 * Clamps text to a maximum width, adding an ellipsis if truncated.
 */
export function clamp(text, maxWidth) {
  if (!text) return "";
  if (text.length <= maxWidth) return text;
  if (maxWidth <= 1) return "…";

  return text.slice(0, maxWidth - 1) + "…";
}

/**
 * Smart truncation for file paths (truncates middle/start to keep context).
 */
export function truncatePath(filePath, maxWidth) {
  if (!filePath) return "";
  if (filePath.length <= maxWidth) return filePath;

  const parts = filePath.split(/[\\/]/);
  if (parts.length < 2) return clamp(filePath, maxWidth);

  const filename = parts.pop();
  const parent = parts.pop();
  
  const candidate = `.../${parent}/${filename}`;
  if (candidate.length <= maxWidth) return candidate;

  const minimal = `.../${filename}`;
  if (minimal.length <= maxWidth) return minimal;

  return "..." + filename.slice(-(maxWidth - 3));
}
