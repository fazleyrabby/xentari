import { theme } from "./colors.js";

const WIDTH = 45;

function pad(str) {
  const raw = str.slice(0, WIDTH);
  return raw + " ".repeat(Math.max(0, WIDTH - raw.length));
}

export function renderDiff({ left, right }) {
  console.log(theme.info("\n🧩 Side-by-Side Diff View:"));
  
  const header = pad("OLD (Current)") + " | " + "NEW (Proposed)";
  console.log(theme.highlight(header));
  console.log(theme.muted("─".repeat(WIDTH) + "-+-" + "─".repeat(WIDTH)));

  const maxLines = Math.min(left.length, 100); // Safety limit for display
  
  for (let i = 0; i < maxLines; i++) {
    const l = left[i] || "";
    const r = right[i] || "";

    let lOut = l;
    let rOut = r;

    if (l && !r) {
      lOut = theme.error(l);
    } else if (!l && r) {
      rOut = theme.success(r);
    } else if (l !== r) {
      lOut = theme.error(l);
      rOut = theme.success(r);
    } else {
      lOut = theme.muted(l);
      rOut = theme.muted(r);
    }

    console.log(pad(lOut) + " | " + pad(rOut));
  }

  if (left.length > 100) {
    console.log(theme.warn(`\n... (${left.length - 100} more lines hidden) ...`));
  }
}
