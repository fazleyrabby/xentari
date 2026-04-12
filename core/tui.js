import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { log } from "./logger.js";
import { runAgent } from "./agents/index.js";
import { indexProject } from "./indexer.js";
import { getContext } from "./context.js";
import { undo } from "./patcher.js";
import { updateDuration } from "./metrics.js";
import { loadPlugins, buildCommandRegistry } from "./plugins.js";
import { loadConfig } from "./config.js";
import { renderDashboard } from "./dashboard.js";
import { loadSummary } from "./analytics.js";
import { handleCommand } from "./cli/handler.js";
import { palette } from "./cli/palette.js";
import readline from "node:readline";

const state = {
  lastTask: null,
  lastFiles: [],
  lastPatch: null,
  history: [],
  metrics: null,
  registry: null
};

function formatTokens(n) {
  if (n > 1000) return (n / 1000).toFixed(1) + "k";
  return n;
}

export function renderStatus(metrics) {
  if (!metrics) return;
  updateDuration(metrics);

  const line = [
    `MODEL: ${metrics.model} (${metrics.tier.toUpperCase()})`,
    `TOKENS: ${formatTokens(metrics.tokens)}`,
    `TIME: ${(metrics.duration / 1000).toFixed(2)}s`,
    `FILES: ${metrics.filesUsed}`,
    `CHUNKS: ${metrics.chunksUsed || 0}`,
    `RETRIES: ${metrics.retries}`
  ].join(" | ");

  console.log("\n" + "-".repeat(60));
  console.log(line);
  console.log("-".repeat(60));
}

export async function startTUI() {
  const config = loadConfig();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Phase 39: Keypress handling for hotkeys
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (str, key) => {
      if (key && key.ctrl && key.name === "p") {
        process.stdout.write("\n");
        handleCommand("/palette");
        process.stdout.write("xen > ");
      }
    });
  }

  // Initialize plugins
  const plugins = await loadPlugins(config.root);
  state.registry = buildCommandRegistry(plugins);
  
  console.clear();
  log.header("🧠 Xentari CLI");
  console.log("Type your task or /help for commands.\n");
  console.log("Hotkeys: Ctrl+P (Palette)\n");
  
  while (true) {
    try {
      const input = await rl.question("xen > ");
      
      if (!input.trim()) continue;
      
      // Use the new centralized command handler (Phase 27 & 39)
      const handled = handleCommand(input);
      if (handled === true) continue;
      
      // Handle palette logic (Phase 39)
      let task = input;
      const paletteMatch = palette.find(p => input.startsWith(p.key));
      if (paletteMatch) {
        const extra = input.replace(paletteMatch.key, "").trim();
        task = `${paletteMatch.desc}${extra ? ` regarding ${extra}` : ""}`;
        log.info(`[PALETTE] Executing: ${task}`);
      }

      state.lastTask = input;
      
      const result = await runAgent({
        task: task,
        projectDir: process.cwd(),
        dryRun: false,
        autoMode: true
      }, {
        onToken: (token) => {
          process.stdout.write(token);
        },
        rl: rl
      });

      state.metrics = result.metrics;
      const summary = loadSummary();
      renderDashboard(state.metrics, summary);
      
    } catch (err) {
      log.error(`[ERROR] ${err.message}`);
    }
  }
}
