import readline from "node:readline";

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m"
};

function colorLine(line, type) {
  if (type === "add") return COLORS.green + line + COLORS.reset;
  if (type === "remove") return COLORS.red + line + COLORS.reset;
  return COLORS.dim + line + COLORS.reset;
}

function classify(oldLine, newLine) {
  if (oldLine === newLine) return "same";
  if (oldLine !== undefined && newLine === undefined) return "remove";
  if (oldLine === undefined && newLine !== undefined) return "add";
  return "change";
}

function renderWindow(oldLines, newLines, offset, height, width = 50) {
  for (let i = 0; i < height; i++) {
    const index = offset + i;
    if (index >= Math.max(oldLines.length, newLines.length)) break;

    const left = oldLines[index];
    const right = newLines[index];

    const type = classify(left, right);

    let leftColored = "";
    let rightColored = "";

    if (type === "remove") {
      leftColored = colorLine(left || "", "remove");
      rightColored = "";
    } else if (type === "add") {
      leftColored = "";
      rightColored = colorLine(right || "", "add");
    } else if (type === "change") {
      leftColored = colorLine(left || "", "remove");
      rightColored = colorLine(right || "", "add");
    } else {
      leftColored = colorLine(left || "", "same");
      rightColored = colorLine(right || "", "same");
    }

    // ANSI escape codes make string.length unreliable for padding
    // We need to pad the raw string
    const rawLeft = (type === "add" ? "" : (left || "")).slice(0, width);
    const leftPadding = " ".repeat(Math.max(0, width - rawLeft.length));
    
    process.stdout.write(`${leftColored}${leftPadding} │ ${rightColored}\n`);
  }
}

export async function interactiveDiff(oldStr, newStr, filePath = "Unknown File") {
  const oldLines = oldStr ? oldStr.split("\n") : [];
  const newLines = newStr ? newStr.split("\n") : [];

  const total = Math.max(oldLines.length, newLines.length);
  let offset = 0;
  const pageSize = Math.min(process.stdout.rows - 10, 30);

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  function render() {
    console.clear();
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📄 FILE: ${filePath}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🧠 XENTARI DIFF VIEW");
    console.log(`${COLORS.yellow}j/k or ↓/↑ to scroll | y = approve | n = reject${COLORS.reset}\n`);

    renderWindow(oldLines, newLines, offset, pageSize);

    console.log(`\n${COLORS.cyan}Lines ${offset + 1} - ${Math.min(offset + pageSize, total)} / ${total}${COLORS.reset}`);
  }

  render();

  return new Promise((resolve) => {
    const onKeypress = (str, key) => {
      if (key.name === "down" || str === "j") {
        offset = Math.min(offset + 1, Math.max(0, total - pageSize));
        render();
      }

      if (key.name === "up" || str === "k") {
        offset = Math.max(offset - 1, 0);
        render();
      }

      if (str === "y") {
        cleanup();
        resolve(true);
      }

      if (str === "n" || (key && key.ctrl && key.name === 'c')) {
        cleanup();
        resolve(false);
      }
    };

    function cleanup() {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      process.stdin.removeListener("keypress", onKeypress);
    }

    process.stdin.on("keypress", onKeypress);
  });
}

export function simpleDiffPreview(oldStr, newStr) {
  const oldLines = oldStr ? oldStr.split("\n") : [];
  const newLines = newStr ? newStr.split("\n") : [];

  const max = Math.min(100, Math.max(oldLines.length, newLines.length));

  console.log("\n--- Simple Diff Preview ---");
  for (let i = 0; i < max; i++) {
    const left = (oldLines[i] || "").slice(0, 50);
    const right = newLines[i] || "";
    console.log(left.padEnd(50) + " | " + right);
  }
}
