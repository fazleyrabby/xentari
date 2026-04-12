/**
 * TUI Status Bar
 */
export function renderStatusBar(state) {
  const line = [
    `Task: ${state.task || "-"}`,
    `Stage: ${state.stage || "-"}`,
    `Tokens: ${state.tokens || 0}`,
    `Time: ${state.time || 0}s`,
    `Retries: ${state.retries || 0}`,
  ].join(" | ");

  console.log("\n" + "─".repeat(line.length));
  console.log(line);
  console.log("─".repeat(line.length));
}
