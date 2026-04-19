/**
 * Static Diff Viewer
 */
export function formatDiff(diff) {
  if (!diff) return "";

  return diff
    .split("\n")
    .slice(0, 200)
    .join("\n");
}
