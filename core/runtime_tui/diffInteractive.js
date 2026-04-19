/**
 * Side-by-Side Interactive Diff Viewer
 */
import readline from "readline";

export function renderSideBySide(oldStr, newStr) {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");

  const MAX_LINES = 200;
  const max = Math.min(Math.max(oldLines.length, newLines.length), MAX_LINES);

  console.log("\n📄 Side-by-Side Diff Preview (Max 200 lines):");
  console.log("─".repeat(110));
  console.log(`${"OLD".padEnd(52)} | ${"NEW"}`);
  console.log("─".repeat(110));

  for (let i = 0; i < max; i++) {
    let left = (oldLines[i] || "");
    let right = (newLines[i] || "");

    // Basic +/- prefixing and color hint (without libraries)
    if (left !== right) {
      if (left && !right) left = `- ${left}`;
      else if (!left && right) right = `+ ${right}`;
      else {
        left = `- ${left}`;
        right = `+ ${right}`;
      }
    } else {
      left = `  ${left}`;
      right = `  ${right}`;
    }

    console.log(`${left.slice(0, 50).padEnd(52)} | ${right.slice(0, 50)}`);
  }
  console.log("─".repeat(110));
  
  if (oldLines.length > MAX_LINES || newLines.length > MAX_LINES) {
    console.log(`... (truncated ${Math.max(oldLines.length, newLines.length) - MAX_LINES} lines)`);
  }
}

export async function interactiveApprove() {
  const rl = readline.createInterface({


    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log("\n[y] Approve | [n] Reject");

    rl.question("> ", (key) => {
      rl.close();
      resolve(key.trim().toLowerCase() === "y");
    });
  });
}
