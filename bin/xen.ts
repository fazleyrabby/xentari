import { parseArgs } from "node:util";
import { readFileSync, existsSync } from "node:fs";
import { runAgent } from "../core/runtime/runAgent.ts";
import { confirm } from "../core/prompt.js";
import { log } from "../core/logger.js";
import { indexProject } from "../core/index.ts";
import { buildContext } from "../core/context/buildContext.ts";
import { updateDuration } from "../core/metrics.js";
import { loadPlugins, buildCommandRegistry } from "../core/plugins.js";
import { loadConfig } from "../core/config.js";
import { resolveProjectRoot } from "../core/project/resolver.js";
import { workspaceManager } from "../core/workspace/workspaceManager.js";

let shuttingDown = false;

function gracefulExit(message = "✋ Exiting Xentari...") {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\n" + message);

  try {
    // stop stdin completely
    process.stdin.pause();
    process.stdin.removeAllListeners();
  } catch {}

  // small delay to let logs flush
  setTimeout(() => process.exit(0), 50);
}

// Ctrl+C
process.on("SIGINT", () => {
  gracefulExit();
});

// kill / terminate
process.on("SIGTERM", () => {
  gracefulExit();
});

// unexpected crashes
process.on("uncaughtException", (err) => {
  console.error("\n[UNCAUGHT ERROR]", err.message);
  gracefulExit("Fatal error. Exiting...");
});


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
      xen workspace add <path> Add folder to project list
      xen workspace list      Show all projects
      xen workspace use <id>  Switch to specific project
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
      plan: { type: "boolean", default: false },
      code: { type: "boolean", default: false },
      review: { type: "boolean", default: false },
      dry: { type: "boolean", default: false },
      auto: { type: "boolean", default: false },
      step: { type: "boolean", default: false },
      sandbox: { type: "boolean", default: false },
      project: { type: "string", short: "p" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    process.exit(0);
  }

  const task = positionals.join(" ");
  if (task.startsWith("new ")) {
    const name = task.replace("new ", "").trim();

    if (!name) {
      log.error("Provide project name");
      process.exit(1);
    }

    const path = await import("node:path");
    const fs = await import("node:fs");

    const projectPath = path.resolve(process.cwd(), name);

    if (fs.existsSync(projectPath)) {
      log.error("Folder already exists");
      process.exit(1);
    }

    fs.mkdirSync(projectPath, { recursive: true });

    log.ok(`Created project: ${projectPath}`);
    log.info(`Next: cd ${name} && xen`);

    process.exit(0);
  }

  const projectRoot = resolveProjectRoot(values.project);

  // Danger Zone Check
  const cwd = process.cwd();
  if (cwd.includes("xentari") || projectRoot.includes("xentari")) {
    log.warn("⚠ Running inside Xentari project");
    if (process.env.XEN_AUTO_APPROVE !== "true") {
      const approved = await confirm("  You are modifying Xentari itself. Continue?");
      if (!approved) {
        log.info("Aborted.");
        process.exit(1);
      }
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
    const context = buildContext(projectDir);
    log.section("DYNAMIC CONTEXT");
    console.log(`Files: ${context.files.join(", ")}`);
    context.snippets.forEach((s: any) => {
      console.log(`\n=== FILE: ${s.path} ===\n${s.content}`);
    });
    process.exit(0);
  }

  if (task.startsWith("debug")) {
    const debugTask = task.replace("debug", "").trim();
    if (!debugTask) {
      log.error("Provide a task to debug. Example: xen debug \"add login\"");
      process.exit(1);
    }

    log.section("DEBUG MODE");
    const context = buildContext(projectDir);
    log.info(`Detected Files: ${context.files.length}`);

    // Run a dry agent run to get real metrics
    log.info("Running diagnostic session...");
    const { runAgent: runLegacyAgent } = await import("../core/executor.ts");
    const { metrics } = await runLegacyAgent({
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
    const { undo } = await import("../core/patcher.js");
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

  if (task.startsWith("workspace ")) {
    const sub = task.replace("workspace ", "").trim();
    const parts = sub.split(" ");
    const cmd = parts[0];
    const val = parts.slice(1).join(" ");

    if (cmd === "add") {
       if (!val) { log.error("Provide a path. Example: xen workspace add /path/to/my-project"); process.exit(1); }
       try {
          const p = workspaceManager.addProject(val);
          log.ok(`Added project: ${p.name} (${p.id})`);
       } catch (e) { log.error(e.message); }
    } else if (cmd === "list") {
       const ps = workspaceManager.getProjects();
       log.section("WORKSPACE PROJECTS");
       ps.forEach(p => console.log(` - ${p.name.padEnd(20)} [${p.id.slice(0, 8)}] ${p.path}`));
    } else if (cmd === "use") {
       if (!val) { log.error("Provide a projectId"); process.exit(1); }
       const p = workspaceManager.getProjectById(val) || workspaceManager.getProjects().find(proj => proj.id.startsWith(val));
       if (!p) { log.error("Project not found"); process.exit(1); }
       log.ok(`Switched to: ${p.path}`);
       // Note: CLI usage is usually scoped to CWD or --project flag, 
       // but we persist this selection if needed.
    } else {
       log.error("Unknown workspace command. Use add, list, or use.");
    }
    process.exit(0);
  }

  if (!task && process.stdin.isTTY) {
    const { startTUI } = await import("../core/tui/index.js");
    await startTUI();
    return;
  }

if (values.review && !task && !process.stdin.isTTY) {
  let patch = "";

  process.stdin.on("data", (chunk) => {
    patch += chunk;
  });

  process.stdin.on("end", async () => {
    const { runReviewOnly } = await import("../core/pipeline.ts");
    await runReviewOnly({ patch });
    process.exit(0);
  });

  return;
}

  if (!task) {
    console.log(HELP);
    process.exit(1);
  }

  if (values.plan) {
    const { runPlanOnly } = await import("../core/pipeline.ts");
    await runPlanOnly({ task, projectDir });
  } else if (values.code) {
    const { runCodeOnly } = await import("../core/pipeline.ts");
    await runCodeOnly({ task, projectDir });
  } else if (values.review) {
    const { runReviewOnly } = await import("../core/pipeline.ts");
    await runReviewOnly({ task });
  } else if (values.step) {
    const { runAgentStep } = await import("../core/executor.ts");
    await runAgentStep({ task, projectDir });
  } else {
    const result = await runAgent({
      input: task,
      projectDir
    });

    console.log(result.message);
  }
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
