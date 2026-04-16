import { theme } from "../tui/colors.js";
import { getWidth, clamp } from "./width.js";
import { normalize } from "./normalize.js";

/**
 * Renders a width-aware, colorized diff preview.
 */
export function renderDiff(file, changes) {
  const width = getWidth();
  const max = width - 6;

  console.log(`\nFILE: ${theme.primary(normalize(file))}`);

  changes.forEach((c) => {
    const normalizedValue = normalize(c.value);
    if (c.type === "remove") {
      console.log(theme.error(`- ${clamp(normalizedValue, max)}`));
    } else if (c.type === "add") {
      console.log(theme.success(`+ ${clamp(normalizedValue, max)}`));
    } else {
      console.log(theme.muted(`  ${clamp(normalizedValue, max)}`));
    }
  });
}
