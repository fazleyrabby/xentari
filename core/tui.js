import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { log } from "./logger.js";
import { runAgent } from "./agents/index.js";
import { indexProject } from "./index.ts";
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
import { renderStatus } from "./tui/statusBar.js";
import { renderHeader } from "./tui/header.js";

const state = {
  lastTask: null,
  lastFiles: [],
  lastPatch: null,
  history: [],
  metrics: null,
  registry: null
};

export async function startTUI() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let isClosed = false;
  let keypressHandler;

  function exit() {
    if (isClosed) return;
    isClosed = true;

    console.log("\n✋ Exiting Xentari...");

    if (keypressHandler && process.stdin.isTTY) {
      process.stdin.removeListener("keypress", keypressHandler);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    
    rl.close();
  }

  // Handle Ctrl+C properly
  rl.on("SIGINT", () => {
    exit();
  });

  // Handle stream close
  rl.on("close", () => {
    if (!isClosed) exit();
    process.exit(0);
  });

  // Phase 39: Keypress handling
  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    keypressHandler = (str, key) => {
      if (isClosed) return;

      if (key && key.ctrl && key.name === "c") {
        exit();
        return;
      }

      if (key && key.ctrl && key.name === "p") {
        process.stdout.write("\n");
        handleCommand("/palette");
        process.stdout.write("xen > ");
      }
    };

    process.stdin.on("keypress", keypressHandler);
  }

  // Init plugins
  const config = loadConfig();
  const plugins = await loadPlugins(config.root);
  state.registry = buildCommandRegistry(plugins);

  // Phase 57: Auto-Index Enforce
  const xentariDir = join(process.cwd(), ".xentari");
  if (!existsSync(join(xentariDir, "index.json"))) {
    log.info("Project index missing. Initializing Xentari...");
    await indexProject(process.cwd());
  }

  console.clear();

  renderHeader({ projectRoot: process.cwd(), stack: "node", mode: "normal" });
  console.log("Type your task or /help for commands.\n");
  console.log("Hotkeys: Ctrl+P (Palette)\n");

  // ✅ SAFE LOOP
  async function loop() {
    if (isClosed || rl.closed) return;

    try {
      const input = await rl.question("xen > ");

      if (isClosed || rl.closed) return;

      if (!input.trim()) {
        return loop();
      }

      const handled = handleCommand(input);
      if (handled === true) {
        return loop();
      }

      let task = input;
      const paletteMatch = palette.find(p => input.startsWith(p.key));

      if (paletteMatch) {
        const extra = input.replace(paletteMatch.key, "").trim();
        task = `${paletteMatch.desc}${extra ? ` regarding ${extra}` : ""}`;
        log.info(`[PALETTE] Executing: ${task}`);
      }

      state.lastTask = input;

      const result = await runAgent({
        task,
        projectDir: process.cwd(),
        dryRun: false,
        autoMode: true
      }, {
        onToken: (token) => {
          if (!isClosed) process.stdout.write(token);
        },
        rl
      });

      state.metrics = result.metrics;
      const summary = loadSummary();
      renderDashboard(state.metrics, summary);

    } catch (err) {
      if (isClosed || rl.closed) return;
      log.error(`[ERROR] ${err.message}`);
    }

    if (!isClosed && !rl.closed) {
      loop();
    }
  }

  loop();
}
