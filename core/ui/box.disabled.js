import { getWidth, clamp } from "./width.js";
import { normalize } from "./normalize.js";

/**
 * Renders a safe, width-aware box with borders.
 * Degrades to minimal mode if terminal is too small (< 60 cols).
 */
export function renderBox(title, lines = []) {
  const width = getWidth();
  
  if (width < 60) {
    // Minimal mode degradation
    console.log(`\n--- ${title.toUpperCase()} ---`);
    for (let line of lines) {
      console.log(normalize(line));
    }
    console.log("------------------\n");
    return;
  }

  const innerWidth = width - 4;
  const normalizedTitle = normalize(title);

  // Top border with title
  const topTitle = clamp(normalizedTitle, innerWidth - 2);
  const remainingBorder = Math.max(0, width - topTitle.length - 5);
  const top = `┌─ ${topTitle} ${"─".repeat(remainingBorder)}┐`;
  
  const bottom = `└${"─".repeat(width - 2)}┘`;

  console.log(top);

  for (let line of lines) {
    const safe = clamp(normalize(line), innerWidth);
    const padding = " ".repeat(Math.max(0, innerWidth - safe.length));
    console.log(`│ ${safe}${padding} │`);
  }

  console.log(bottom);
}
