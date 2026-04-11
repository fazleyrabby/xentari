#!/usr/bin/env node

import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { runAgent, runAgentStep } from "../core/agents/index.js";
import { run, runPlanOnly, runCodeOnly, runReviewOnly } from "../core/pipeline.js";
import { undo } from "../core/patcher.js";
import { confirm } from "../core/prompt.js";
import { log } from "../core/logger.js";
import { indexProject } from "../core/indexer.js";
import { getContext } from "../core/context.js";

async function main() {
  const HELP = `
    xen — local AI coding assistant

    Usage:
      xen "task"              Full pipeline (plan → code → review → apply)
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
      xen "add a login endpoint"
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
      plan:   { type: "boolean", default: false },
      code:   { type: "boolean", default: false },
      review: { type: "boolean", default: false },
      dry:    { type: "boolean", default: false },
      auto:   { type: "boolean", default: false },
      step:   { type: "boolean", default: false },
      help:   { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  const task = positionals.join(" ");
  const projectDir = process.cwd();

  if (task === "index") {
    await indexProject(projectDir);
    process.exit(0);
  }

  if (task === "context") {
    const { context, stack } = getContext("");
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
    // Debug logic is mostly internal to retriever and context engine
    log.section("DEBUG MODE");
    const { stack } = getContext(debugTask);
    log.info(`Detected Stack: ${stack}`);
    log.info("Run with --dry to see file scores in retrieve logs.");
    process.exit(0);
  }

  if (task === "undo") {
    if (!existsSync(".git")) {
      log.error("Not a git repository. Undo unavailable.");
      process.exit(1);
    }
    log.warn("This will run: git reset --hard HEAD");
    const yes = await confirm("  Are you sure?");
    if (!yes) {
      log.info("Aborted.");
      process.exit(0);
    }
    try {
      undo(projectDir);
      log.ok("Reverted to last commit (git reset --hard HEAD)");
    } catch (err) {
      log.error(`Undo failed: ${err.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (!task) {
    console.log(HELP);
    process.exit(1);
  }

  try {
    if (values.step) {
      await runAgentStep({ task, projectDir });
    } else if (values.plan) {
      await runPlanOnly({ task });
    } else if (values.code) {
      await runCodeOnly({ task, projectDir });
    } else if (values.review) {
      let patch = task;
      if (!process.stdin.isTTY) {
        patch = readFileSync("/dev/stdin", "utf-8");
      }
      await runReviewOnly({ patch });
    } else {
      await runAgent({
        task,
        projectDir,
        dryRun: values.dry,
        autoMode: values.auto,
      });
    }
  } catch (err) {
    console.error(`\n\x1b[31mFatal: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});