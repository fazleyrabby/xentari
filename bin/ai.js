#!/usr/bin/env node

import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { runAgent, runAgentStep } from "../core/agents/index.js";
import { run, runPlanOnly, runCodeOnly, runReviewOnly } from "../core/pipeline.js";
import { undo } from "../core/patcher.js";
import { confirm } from "../core/prompt.js";
import { log } from "../core/logger.js";

async function main() {
  const HELP = `
    ai — local AI coding assistant

    Usage:
      ai "task"              Full pipeline (plan → code → review → apply)
      ai "task" --plan       Only generate plan, print steps
      ai "task" --code       Skip planning, generate patch directly
      ai "task" --review     Review the patch (reads stdin if no task)
      ai "task" --dry        Generate and validate patch, do not apply
      ai "task" --auto       Auto-retry up to 3x using reviewer feedback
      ai "task" --step       Execute single step (no planning, direct execution)
      ai undo                Revert last change (git reset --hard HEAD)
      ai --help, ai -h       Show this help

    Examples:
      ai "add a login endpoint"
      ai "fix the auth bug" --auto
      ai "refactor utils" --dry
      ai "add tests for user model" --plan
      ai "add hello route" --step
      ai undo
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
      undo(process.cwd());
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

  const projectDir = process.cwd();

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