import { theme } from "../tui/colors.js";
import { clamp, getWidth } from "./width.js";
import { normalize } from "./normalize.js";

/**
 * Renders a safe, single-line action indicator.
 */
export function renderAction(type, target, status) {
  const width = getWidth();
  const max = width - 12; // Enough space for icon and type

  const icons = {
    active: "▶",
    success: theme.success("✔"),
    error: theme.error("✖"),
    pending: "○"
  };

  const typeMap = {
    success: theme.success(type.toUpperCase()),
    error: theme.error(type.toUpperCase()),
    active: theme.primary(type.toUpperCase()),
    pending: theme.muted(type.toUpperCase())
  };

  const safeTarget = clamp(normalize(target), max);
  const icon = icons[status] || " ";
  const coloredType = typeMap[status] || type.toUpperCase();

  console.log(`${icon} ${coloredType} ${safeTarget}`);
}
