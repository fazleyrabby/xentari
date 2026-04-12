/**
 * Dashboard Renderer for Xentari TUI.
 */
import { updateDuration } from "./metrics.js";
function formatTokens(n) {
    if (n > 1000)
        return (n / 1000).toFixed(1) + "k";
    return n;
}
export function renderDashboard(metrics, summary) {
    if (metrics) {
        updateDuration(metrics);
    }
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║                XENTARI DASHBOARD                 ║");
    console.log("╠══════════════════════════════════════════════════╣");
    if (metrics) {
        console.log(`║ MODEL:   ${(metrics.model || "N/A").padEnd(10)} Tier: ${(metrics.tier || "N/A").toUpperCase().padEnd(20)}║`);
        console.log(`║ TOKENS:  ${formatTokens(metrics.tokens).toString().padEnd(10)} (In: ${formatTokens(metrics.inputTokens).toString().padEnd(6)} Out: ${formatTokens(metrics.outputTokens).toString().padEnd(6)}) ║`);
        console.log(`║ TIME:    ${((metrics.duration || 0) / 1000).toFixed(2).toString().padEnd(10)}s                             ║`);
        console.log(`║ FILES:   ${(metrics.filesUsed || 0).toString().padEnd(10)} CHUNKS: ${(metrics.chunksUsed || 0).toString().padEnd(17)} ║`);
        console.log(`║ RETRIES: ${(metrics.retries || 0).toString().padEnd(40)} ║`);
    }
    else {
        console.log("║ (No current session metrics)                     ║");
    }
    if (summary) {
        console.log("╠══════════════════════════════════════════════════╣");
        console.log(`║ SUCCESS RATE:  ${((summary.successRate || 0) * 100).toFixed(0).toString().padEnd(3)}%                             ║`);
        console.log(`║ AVG TIME:      ${(summary.avgTime || 0).toString().padEnd(10)}s                            ║`);
        console.log(`║ TASKS:         ${(summary.totalTasks || 0).toString().padEnd(10)}                            ║`);
    }
    console.log("╚══════════════════════════════════════════════════╝\n");
}
