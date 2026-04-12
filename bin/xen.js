#!/usr/bin/env -S node --import=tsx

import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { runAgent, runAgentStep } from "../core/agents/index.js";
import { run, runPlanOnly, runCodeOnly, runReviewOnly } from "../core/pipeline.ts";
import { undo } from "../core/patcher.js";
import { confirm } from "../core/prompt.js";
import { log } from "../core/logger.js";
import { indexProject } from "../core/indexer.js";
import { getContext } from "../core/context.js";
import { startTUI } from "../core/tui/index.js";
import { updateDuration } from "../core/metrics.js";
import { loadPlugins, buildCommandRegistry } from "../core/plugins.js";
import { loadConfig } from "../core/config.js";
import { resolveProjectRoot } from "../core/project/resolver.js";

async function main() {
  const HELP = `
    xen — local AI coding assistant

    Usage:
      xen                     Launch interactive TUI mode
      xen "task"              Full pipeline (plan → code → review → apply)
      xen "task" --project=./path Specify project directory (defaults to cwd)
      xen "task" --sandbox    Run in a temporary sandbox directory
      xen "task" --plan       Only generate plan, print steps
      xen "task" --code       Skip planning, generate patch directly
      xen "task" --review     Review the patch (reads stdin if no task)
      xen "task" --dry        Generate and validate patch, do not apply
      xen "task" --auto       Auto-retry up to 3x using reviewer feedback
      xen "task" --step       Execute single step (no planning, direct execution)
      xen index               Build/update project index
      xen context             Show current dynamic context
      xen debug "task"        Show retrieval scores and token estimates
      xen undo                Revert last change (git reset --hard HEAD)
      xen --help, xen -h       Show this help

    Examples:
      xen
      xen "add a login endpoint" --project=../test-project --sandbox
      xen "fix the auth bug" --auto
      xen "refactor utils" --dry
      xen index
      xen context
      xen debug "fix login"
      xen undo
  `;

  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      plan:    { type: "boolean", default: false },
      code:    { type: "boolean", default: false },
      review:  { type: "boolean", default: false },
      dry:     { type: "boolean", default: false },
      auto:    { type: "boolean", default: false },
      step:    { type: "boolean", default: false },
      sandbox: { type: "boolean", default: false },
      project: { type: "string", short: "p" },
      help:    { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  const task = positionals.join(" ");
  const projectRoot = resolveProjectRoot(values.project);

  // Danger Zone Check
  const cwd = process.cwd();
  if (cwd.includes("xentari") || projectRoot.includes("xentari")) {
    log.warn("⚠ Running inside Xentari project");
    const approved = await confirm("  You are modifying Xentari itself. Continue?");
    if (!approved) {
      log.info("Aborted.");
      process.exit(1);
    }
  }

  const projectDir = projectRoot;

  if (task.startsWith("/")) {
    const config = loadConfig();
    const plugins = await loadPlugins(config.root);
    const registry = buildCommandRegistry(plugins);
    const [cmdName, ...args] = task.slice(1).trim().split(/\s+/);

    if (registry[cmdName]) {
      const context = {
        projectDir,
        lastTask: null,
        metrics: null,
        registry
      };
      await registry[cmdName].fn({ args, context });
      process.exit(0);
    } else {
      log.error(`Unknown command: /${cmdName}`);
      process.exit(1);
    }
  }

  if (task === "index") {
    await indexProject(projectDir);
    process.exit(0);
  }

  if (task === "context") {
    const { context, stack } = getContext("", projectDir);
    log.section("DYNAMIC CONTEXT");
    log.info(`Stack: ${stack}`);
    console.log("\n" + context);
    process.exit(0);
  }

  if (task.startsWith("debug")) {
    const debugTask = task.replace("debug", "").trim();
    if (!debugTask) {
      log.error("Provide a task to debug. Example: xen debug \"add login\"");
      process.exit(1);
    }
    
    log.section("DEBUG MODE");
    const { stack } = getContext(debugTask, projectDir);
    log.info(`Detected Stack: ${stack}`);
    
    // Run a dry agent run to get real metrics
    log.info("Running diagnostic session...");
    const { metrics } = await runAgent({
      task: debugTask,
      projectDir,
      dryRun: true,
      autoMode: false,
      sandbox: values.sandbox
    });

    updateDuration(metrics);

    console.log(`
Tokens:
  input: ${metrics.inputTokens}
  output: ${metrics.outputTokens}
  total: ${metrics.tokens}

Time:
  total: ${(metrics.duration / 1000).toFixed(2)}s

Files Used:
  ${metrics.files.join("\n  ") || "(none)"}

RAG:
  matched files: ${metrics.ragMatches?.length > 0 ? "\n    - " + metrics.ragMatches.join("\n    - ") : "(none)"}

Chunks:
  selected: ${metrics.chunksUsed || 0}
  size: 800 chars each

Constraint Engine:
  fixes applied: ${metrics.constraintFixes || 0}
  retries: ${metrics.retries}
    `);
    process.exit(0);
  }

  if (task === "undo") {
    if (!existsSync(".git")) {
      log.error("Not a git repository. Undo unavailable.");
      process.exit(1);
    }
    log.warn("This will run: git reset --hard HEAD");
    const answer = await confirm("  Are you sure?");
    if (answer) {
      try {
        undo(projectDir);
        log.ok("Reverted to last commit.");
      } catch (err) {
        log.error(`Undo failed: ${err.message}`);
      }
    } else {
      log.info("Aborted.");
    }
    process.exit(0);
  }

  if (!task && process.stdin.isTTY) {
    await startTUI();
    return;
  }

  if (values.review && !task) {
    let patch = "";
    process.stdin.on("data", (chunk) => { patch += chunk; });
    process.stdin.on("end", async () => {
      await runReviewOnly({ patch });
    });
    return;
  }

  if (!task) {
    console.log(HELP);
    process.exit(1);
  }

  if (values.plan) {
    await runPlanOnly({ task, projectDir });
  } else if (values.code) {
    await runCodeOnly({ task, projectDir });
  } else if (values.review) {
    await runReviewOnly({ task });
  } else if (values.step) {
    await runAgentStep({ task, projectDir });
  } else {
    await runAgent({
      task,
      projectDir,
      dryRun: values.dry,
      autoMode: values.auto,
      sandbox: values.sandbox
    });
  }
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
