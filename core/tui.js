import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { log } from "./logger.js";
import { runAgent } from "./agents/executor.agent.js";
import { indexProject } from "./indexer.js";
import { getContext } from "./context.js";
import { undo } from "./patcher.js";
import { updateDuration } from "./metrics.js";
import { loadPlugins, buildCommandRegistry } from "./plugins.js";
import { loadConfig } from "./config.js";
import { renderDashboard } from "./dashboard.js";
import { loadSummary } from "./analytics.js";

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

async function handleCommand(input, rl) {
  const [cmdName, ...args] = input.slice(1).trim().split(/\s+/);
  
  // Hardcoded core commands (backward compatibility)
  if (cmdName === "exit" || cmdName === "quit") {
    process.exit(0);
  }
  
  if (cmdName === "undo") {
    if (!existsSync(".git")) {
      log.error("Not a git repository. Undo unavailable.");
      return true;
    }
    log.warn("This will run: git reset --hard HEAD");
    const answer = await rl.question("  Are you sure? (y/n) ");
    if (answer.trim().toLowerCase() === 'y') {
      try {
        undo(process.cwd());
        log.ok("Reverted to last commit.");
      } catch (err) {
        log.error(`Undo failed: ${err.message}`);
      }
    } else {
      log.info("Aborted.");
    }
    return true;
  }
  
  if (cmdName === "context") {
    const { context, stack } = getContext("");
    log.section("DYNAMIC CONTEXT");
    log.info(`Stack: ${stack}`);
    console.log("\n" + context);
    return true;
  }
  
  if (cmdName === "index") {
    await indexProject(process.cwd());
    return true;
  }

  // Plugin commands
  if (state.registry && state.registry[cmdName]) {
    try {
      const context = {
        projectDir: process.cwd(),
        lastTask: state.lastTask,
        metrics: state.metrics,
        registry: state.registry
      };
      await state.registry[cmdName].fn({ args, context });
    } catch (err) {
      log.error(`[PLUGIN] Command /${cmdName} failed: ${err.message}`);
    }
    return true;
  }
  
  log.error(`Unknown command: /${cmdName}. Type /help for available commands.`);
  return true;
}

export async function startTUI() {
  const config = loadConfig();
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  // Initialize plugins
  const plugins = await loadPlugins(config.root);
  state.registry = buildCommandRegistry(plugins);
  
  console.clear();
  log.header("Xentari Interactive Mode");
  console.log("Type your task or /help for commands.");
  
  while (true) {
    try {
      const input = await rl.question("\nXentari > ");
      
      if (!input.trim()) continue;
      
      if (input.startsWith("/")) {
        const handled = await handleCommand(input, rl);
        if (handled) continue;
      }
      
      state.lastTask = input;
      
      const result = await runAgent({
        task: input,
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
