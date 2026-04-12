/**
 * TUI Status Bar
 */
export function renderStatus(state) {
  const line = [
    `🧠 ${state.model || "local"}`,
    `📦 ${state.stack || "-"}`,
    `⚙ ${state.stage || "-"}`,
    `🔁 ${state.retries || 0}`,
    `⏱ ${state.time || 0}s`,
    `📊 ${state.tokens || 0} tokens`
  ].join(" | ");

  console.log("\n" + "─".repeat(line.length));
  console.log(line);
  console.log("─".repeat(line.length));
}

// Keep backward compatibility if needed
export function renderStatusBar(state) {
  renderStatus(state);
}
