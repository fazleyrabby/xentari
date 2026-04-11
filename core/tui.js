import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { log } from "./logger.js";
import { runAgent } from "./agents/executor.agent.js";
import { indexProject } from "./indexer.js";
import { getContext } from "./context.js";
import { undo } from "./patcher.js";
import { updateDuration } from "./metrics.js";

const state = {
  lastTask: null,
  lastFiles: [],
  lastPatch: null,
  history: []
};

function formatTokens(n) {
  if (n > 1000) return (n / 1000).toFixed(1) + "k";
  return n;
}

export function renderStatus(metrics) {
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

async function handleCommand(command, rl) {
  const cmd = command.trim().toLowerCase();
  
  if (cmd === "/exit" || cmd === "/quit") {
    process.exit(0);
  }
  
  if (cmd === "/help") {
    console.log(`
    Commands:
      /help    - Show this help
      /exit    - Exit Xentari
      /clear   - Clear screen
      /undo    - Undo last git change
      /context - Show current dynamic context
      /index   - Re-index project
    `);
    return true;
  }
  
  if (cmd === "/clear") {
    console.clear();
    return true;
  }
  
  if (cmd === "/undo") {
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
  
  if (cmd === "/context") {
    const { context, stack } = getContext("");
    log.section("DYNAMIC CONTEXT");
    log.info(`Stack: ${stack}`);
    console.log("\n" + context);
    return true;
  }
  
  if (cmd === "/index") {
    await indexProject(process.cwd());
    return true;
  }
  
  return false;
}

export async function startTUI() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
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
      
      const { metrics } = await runAgent({
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

      renderStatus(metrics);
      
    } catch (err) {
      log.error(`[ERROR] ${err.message}`);
    }
  }
}
