import { getState } from "./state.js";
import { splitPanels } from "./layout.js";
import { normalize } from "./normalize.js";

/**
 * Padds a string with spaces to a fixed width
 */
function pad(str, width) {
  const norm = normalize(str);
  if (norm.length >= width) {
    return norm.slice(0, width - 1) + "…";
  }
  return norm + " ".repeat(Math.max(0, width - norm.length));
}

/**
 * Renders the side-by-side panel regions
 */
function renderPanels() {
  const state = getState();
  const { leftWidth, rightWidth } = splitPanels();

  // LEFT: Actions / History
  const left = state.actions.map(a =>
    pad(`${a.icon} ${a.type.toUpperCase()} ${a.target}`, leftWidth)
  );

  // RIGHT: Diff / Details
  const right = state.diff
    ? [
        pad(`FILE: ${state.diff.file}`, rightWidth),
        pad(`+ ${state.diff.after}`, rightWidth),
        pad(`- ${state.diff.before || ""}`, rightWidth)
      ]
    : [pad("No changes", rightWidth)];

  const maxLines = Math.max(left.length, right.length);
  let output = "";

  for (let i = 0; i < maxLines; i++) {
    const l = left[i] || " ".repeat(leftWidth);
    const r = right[i] || "";

    output += `${l} │ ${r}\n`;
  }

  return output;
}

/**
 * Renders a full TUI frame
 */
export function renderFrame() {
  const state = getState();

  // Clean terminal and move to top (non-flicker method)
  process.stdout.write('\x1B[2J\x1B[3J\x1B[H');

  console.log(`🧠 XENTARI | ${state.header.stack} | ${state.header.phase}`);
  console.log("─".repeat(process.stdout.columns || 80));
  process.stdout.write(renderPanels());
  console.log("─".repeat(process.stdout.columns || 80));
  console.log(`STATUS: ${state.status.text}`);
}
