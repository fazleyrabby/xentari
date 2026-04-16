import { getWidth } from "./width.js";

/**
 * Xentari TUI Split Layout Logic
 */
export function splitPanels() {
  const width = getWidth();

  // Left panel takes 40% of the screen
  const leftWidth = Math.floor(width * 0.4);
  const rightWidth = width - leftWidth - 1;

  return {
    leftWidth,
    rightWidth
  };
}
