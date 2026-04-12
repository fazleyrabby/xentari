import { join, dirname } from "node:path";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { log, logToFile } from "./logger.js";
import { retrieve } from "./retriever.js";
import { generateWithRetry } from "./agents/coder.agent.js";
import { plan as plannerPlan } from "./agents/planner.agent.js";
import { review as reviewerReview, isApproved } from "./agents/reviewer.agent.js";
import { applyPatch, validatePatch } from "./patcher.js";
import { patchToUnified } from "./diff.ts";
import { remember, trackRecentFiles, recordPattern, getRecentFileNames } from "./memory.js";
import { summarizePatch } from "./summarizer.js";
import { confirm } from "./prompt.js";
import { detectTier, getTierProfile } from "./tier.js";
import { advisorFix, isAdvisorCallAllowed } from "./advisor.js";
import { buildExecutionBatches } from "./scheduler.js";
import { acquireLock, releaseLock } from "./locks.js";
import { loadConfig } from "./config.js";
import { createMetrics } from "./metrics.js";
import { logBug, recordTestResult } from "./analytics.js";
import { resolveContract } from "./retrieval/resolver.ts";
import { buildContext } from "./retrieval/contextBuilder.ts";
import { validateContext } from "./retrieval/validator.ts";
import { trimContext } from "./retrieval/tokenLimiter.ts";
import { stage, statusBar, diffInteractive } from "./tui/index.js";
import crypto from "crypto";
import { createSandbox } from "./sandbox/manager.js";
import { cleanupSandbox } from "./sandbox/cleanup.js";
import { getChangedFiles } from "./sandbox/diff.js";
import * as ux from "./tui/ux.js";
import { addToSession } from "./memory/session.js";
import { detectStack } from "./project/detector.js";
import { renderStatus } from "./tui/statusBar.js";
import { loadIndex, indexProject } from "./index.ts";

import { simulateFailure } from "./utils/simulation.js";


export type StepType = "analyze" | "read" | "modify" | "create" | "refactor" | "verify" | "plan" | "retrieve" | "code" | "review";
export type StepStatus = "pending" | "running" | "done" | "failed";

export type Step = {
  id: number;
  type: StepType;
  target: string;
  description?: string;
  constraints?: string[];
  files?: string[];
  dependsOn: number[];
  status?: StepStatus;
  role?: string;
  pattern?: string;
};

export type AgentOptions = {
  task: string;
  projectDir: string;
  dryRun: boolean;
  autoMode: boolean;
  sandbox?: boolean;
};

let failureState = {
  consecutiveFailures: 0,
  lastFailureReason: null as string | null,
  lastReviewRejectReason: null as string | null,
  advisorCalled: false,
  advisorFailureCount: 0,
};

function detectModule(task: string) {
  const lower = task.toLowerCase();
  if (lower.includes("auth") || lower.includes("login")) return "authentication";
  if (lower.includes("todo") || lower.includes("task")) return "todos";
  if (lower.includes("user")) return "users";
  if (lower.includes("pay") || lower.includes("billing")) return "payments";
  if (lower.includes("api") || lower.includes("route")) return "api";
  return null;
}

function elapsed(start: number) {
  return Date.now() - start;
}

function extractPatchFiles(patch: string) {
  return [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
}

function createChain() {
  return {
    modifiedFiles: [] as string[],
    patchSummaries: [] as string[],
    get patchSummary(): string | null {
      return this.patchSummaries.length
        ? this.patchSummaries.join("; ")
        : null;
    },
  };
}

function handleFailure(step: Step, reason: string, chain: any, opts: any) {
  failureState.consecutiveFailures++;
  failureState.lastFailureReason = reason;
  log.warn(`[FAILURE] ${reason} (Count: ${failureState.consecutiveFailures})`);
  
  // Phase 46: Failure Memory
  recordPattern(step as any, "fail", []);
}

function handleReviewFailure(step: Step, reason: string, chain: any, opts: any) {
  failureState.consecutiveFailures++;
  failureState.lastReviewRejectReason = reason;
  log.warn(`[REVIEW FAILURE] ${reason} (Count: ${failureState.consecutiveFailures})`);
  
  // Phase 46: Failure Memory
  recordPattern(step as any, "fail", []);
}

function resetFailureState() {
  failureState.consecutiveFailures = 0;
  failureState.lastFailureReason = null;
  failureState.lastReviewRejectReason = null;
}

function validateStepResult(projectDir: string, fileUpdate: { file: string; content: string }) {
  if (!fileUpdate.content || fileUpdate.content.length < 10) {
    return { valid: false, reason: `Generated content for ${fileUpdate.file} is too small or empty` };
  }

  if (fileUpdate.file && (fileUpdate.file.endsWith(".js") || fileUpdate.file.endsWith(".ts"))) {
    try {
      const code = fileUpdate.content;
      const stack: string[] = [];
      const pairs: Record<string, string> = { '{': '}', '(': ')', '[': ']' };
      for (let char of code) {
        if (pairs[char]) stack.push(char);
        else if (Object.values(pairs).includes(char)) {
          if (pairs[stack.pop()!] !== char) return { valid: false, reason: `Unbalanced braces or parentheses detected in ${fileUpdate.file}` };
        }
      }
      if (stack.length > 0) return { valid: false, reason: `Unbalanced braces or parentheses detected in ${fileUpdate.file}` };
    } catch (err: any) {
      return { valid: false, reason: `Syntax check failed for ${fileUpdate.file}: ${err.message}` };
    }
  }

  return { valid: true };
}

async function executeStep(step: Step, index: number, opts: AgentOptions, chain: any, { onToken, rl, metrics }: any = {}) {
  const { projectDir, dryRun, autoMode, task } = opts;
  const stepStart = Date.now();
  const mode = dryRun ? "dry" : autoMode ? "auto" : "normal";
  const tier = detectTier();
  const maxAttempts = autoMode ? getTierProfile().maxRetries : 1;

  // Fix: Ensure a file path is available for steps that need it.
  if (!step.files?.length && !(step as any).filePath) {
    if ((step.type === 'create' || step.type === 'modify') && step.target) {
      log.info(`[EXECUTOR] Inferring file path from target: ${step.target}`);
      step.files = [step.target];
      (step as any).filePath = step.target;
    } else {
      log.warn(`[EXECUTOR] Step ${step.id} has no files to process. Skipping.`);
      return; // Can't proceed without a file target.
    }
  }

  resetFailureState();
  failureState.advisorCalled = false; 


  if (failureState.advisorCalled && failureState.advisorFailureCount >= 3) {
    log.warn(`[ADVISOR] Already failed 3 times - no more advisor attempts`);
    return;
  }

  log.info(`Target: ${step.target}`);

  // Phase: CREATE Step Guarantee
  if (step.type === 'create' && step.target) {
    const fullPath = join(projectDir, step.target);
    if (!existsSync(fullPath)) {
      const dir = dirname(fullPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, "");
    }
  }

  let files: any[];
  let finalContext: any;

  log.step("RETRIEVE", "...");
  const retrieveStart = Date.now();
  ux.showStage("RETRIEVE");
  try {
    const keywords = [...(step.files || []), ...step.target.split(/\s+/)];
    files = await retrieve(projectDir, keywords, chain?.modifiedFiles || [], { metrics });
    log.step("RETRIEVE", "✓", `files: ${files.length}`);
  } catch (err: any) {
    log.step("RETRIEVE", "✗", err.message);
    log.error("RETRIEVAL_FAILED", err.message, "Run indexing or check file permissions.");
    return;
  }

  try {
    const codeStart = Date.now();
    log.step("CODE", "generating...");
    ux.showStage("CODE");
    let fileUpdates: any[];
    const feedback = failureState.lastReviewRejectReason || failureState.lastFailureReason;

    try {
      const taskInstruction = typeof (step as any).description === 'string' && (step as any).description.length > 0 
        ? `${(step as any).description}\nConstraints: ${((step as any).constraints || []).join(', ')}`
        : step.target;
        
      fileUpdates = await generateWithRetry(taskInstruction, files, feedback, chain, maxAttempts, { 
        onToken, 
        metrics, 
        role: step.role, 
        pattern: step.pattern 
      });
      
      // Phase: STRICT TARGET ENFORCEMENT
      if (fileUpdates && fileUpdates.length > 0) {
        const update = fileUpdates[0];
        if (!update.file) update.file = step.target;
        if (update.file && update.file !== step.target) {
           log.step("CODE", "✗", "TARGET_VIOLATION");
           log.error("TARGET_VIOLATION", `Model attempted to modify '${update.file}' instead of '${step.target}'`, "Check prompt constraints.");
           throw new Error("TARGET_DEVIATION");
        }
      }
      log.step("CODE", "✓", `lines: ${fileUpdates[0]?.content.split("\n").length || 0}`);
    } catch (err: any) {
      log.step("CODE", "✗", "MODEL_UNSTABLE_OUTPUT");
      return;
    }

    log.step("VALIDATE", "...");
    for (const update of fileUpdates!) {
      const validation = validateStepResult(projectDir, update);
      if (!validation.valid) {
        log.step("VALIDATE", "✗", validation.reason.toUpperCase());
        log.error("VALIDATION_FAILED", validation.reason, "Model produced incomplete or truncated code.");
        return;
      }
    }
    log.step("VALIDATE", "✓");

    let patch: string | null = null;
    let approved = false;

    if (fileUpdates! && fileUpdates!.length > 0) {
      log.step("DIFF", "ready");
      try {
        patch = patchToUnified(projectDir, fileUpdates!.map(u => ({ file: u.file, content: u.content })));
        log.patch(patch!, step.target);
      } catch (err: any) {
        log.step("DIFF", "✗");
        return;
      }

      if (patch) {
        const auto = process.env.XEN_AUTO_APPROVE === "true";
        approved = auto || await confirm("  Apply changes?");
      }
    }

    if (!approved) {
      log.step("PATCH", "✗", "rejected by user");
      return;
    }

    log.step("PATCH", "applying...");
    ux.showStage("PATCH");

    if (dryRun) {
      let result = await applyPatch(projectDir, patch!, true);
      if (result.valid) {
        log.step("PATCH", "✓", "dry-run ok");
      } else {
        log.step("PATCH", "✗", result.reason);
      }
      return;
    }
    log.step("PATCH", "applying...");
    ux.showStage("PATCH");

    let result = await applyPatch(projectDir, patch!, false, fileUpdates![0]?.content);

    if (result.retry) {
      log.step("RECOVERY", "creating file...");
      log.step("PATCH", "retry...");
      result = await applyPatch(projectDir, result.patch, false, fileUpdates![0]?.content);
      patch = result.patch;
    }

    if (result.applied) {
      log.step("PATCH", "✓");
      const affectedFiles = extractPatchFiles(patch!);
      chain.modifiedFiles.push(...affectedFiles);
      try {
        const summary = await summarizePatch(patch!, { metrics });
        chain.patchSummaries.push(summary);
      } catch {}
    } else {
      log.step("PATCH", "✗", result.reason);
      log.error("PATCH_FAILED", result.reason!, "Check file locks or syntax errors in generated code.");
    }
  } finally {
    // Release locks if any
  }
}


async function executePipeline(opts: AgentOptions, { onToken, rl }: any = {}) {
  const { task, projectDir, dryRun, autoMode } = opts;
  const config = loadConfig();
  const profile = getTierProfile();
  const tier = detectTier();
  const totalStart = Date.now();

  const metrics = createMetrics();
  metrics.model = config.model;
  metrics.tier = tier;

  // Phase 32: Session Header
  console.clear();
  log.header("🧠 Xentari CLI");
  log.info(`Project: ${projectDir}`);

  // Phase 57: Auto-Index Enforce
  const xentariDir = join(projectDir, ".xentari");
  const indexPath = join(xentariDir, "index.json");
  if (!existsSync(indexPath)) {
    log.info("[EXECUTOR] Index missing. Initializing project analysis...");
    await indexProject(projectDir);
  }

  const stackInfo = detectStack(projectDir);



  log.info(`Stack:   ${stackInfo.stack}${stackInfo.framework ? ` (${stackInfo.framework})` : ""}\n`);

  // Phase 32: Context Panel (Simulation)
  ux.showContext({
    stack: stackInfo.stack,
    framework: stackInfo.framework,
    projectRoot: projectDir
  });

  ux.showStage("PLAN");
  log.step("PLAN", "...");
  
  let steps: Step[] = [];
  const localPlanPath = join(projectDir, "xentari", "plan.json");
  
  if (existsSync(localPlanPath)) {
    try {
      const { readFileSync } = await import("node:fs");
      const planData = JSON.parse(readFileSync(localPlanPath, "utf-8"));
      const taskIds = planData.steps || [];
      for (const tid of taskIds) {
        const tFile = join(projectDir, "xentari", "tasks", `${tid}.json`);
        if (existsSync(tFile)) {
          const t = JSON.parse(readFileSync(tFile, "utf-8"));
          steps.push({
            id: t.id || Number(tid.split("_")[0]),
            type: "modify",
            target: t.target,
            description: t.description,
            constraints: t.constraints,
            files: [t.target],
            dependsOn: []
          });
        }
      }
      log.info(`Loaded ${steps.length} deterministic tasks from plan.json`);
    } catch(e) {
      log.warn(`Failed to parse local plan.json, falling back to dynamic planner.`);
      steps = (await plannerPlan(task, { metrics, projectDir })) as any;
    }
  } else {
    steps = (await plannerPlan(task, { metrics, projectDir })) as any;
  }
  
  log.step("PLAN", "✓", `${steps.length} steps`);

  log.info(`Target: ${steps[0]?.target || "N/A"}`);
  
  if (steps.length > 6) {
    ux.warn(`Plan contains ${steps.length} steps. Large operations may be less reliable.`);
  }

  const autoApprove = process.env.XEN_AUTO_APPROVE === "true";
  const approved = autoApprove || await confirm("  Execute this plan?");
  if (!approved) {
    log.step("PATCH", "✗", "rejected by user");
    return { metrics, chain: createChain() };
  }

  const chain = createChain();

  for (let j = 0; j < steps.length; j++) {
    const step = steps[j];
    
    try {
      await executeStep(step, j, opts, chain, { onToken, rl, metrics });
    } catch (err: any) {
      log.step("STEP", "✗", `Step ${j+1} failed: ${err.message}`);
      // Retry once if failed
      log.step("RETRY", "attempt 1/1");
      await executeStep(step, j, opts, chain, { onToken, rl, metrics });
    }
  }

  const totalMs = elapsed(totalStart);
  const timeSec = (totalMs / 1000).toFixed(2);

  if (chain.patchSummaries.length > 0) {
    log.summary({
      changes: chain.modifiedFiles.map(f => ({ path: f, type: "updated" })),
      added: chain.patchSummaries.reduce((acc, s) => acc + (s.match(/\+/g) || []).length, 0),
      removed: chain.patchSummaries.reduce((acc, s) => acc + (s.match(/-/g) || []).length, 0),
      time: timeSec
    });
  } else {
    log.error("TASK_FAILED", "No changes were applied to the project.", "Check model logs or try a clearer instruction.");
  }

  return { metrics, chain };
}


export async function runAgent(opts: AgentOptions, { onToken, rl }: any = {}) {
  let { projectDir, sandbox, task } = opts;
  let originalRoot = projectDir;
  let sandboxRoot: string | null = null;

  if (sandbox) {
    try {
      sandboxRoot = createSandbox(projectDir);
      log.info(`🧪 Running in sandbox: ${sandboxRoot}`);
      projectDir = sandboxRoot;
      opts.projectDir = sandboxRoot;
    } catch (err: any) {
      log.warn(`Sandbox creation failed: ${err.message}. Falling back to normal mode.`);
      opts.sandbox = false;
    }
  }

  const result = await executePipeline(opts, { onToken, rl });

  // Phase 43: Flow-Aware Execution
  const index = loadIndex(projectDir);
  const targetModule = detectModule(task);
  if (index && targetModule && (index as any).flows && (index as any).flows[targetModule]) {
    const flow = (index as any).flows[targetModule].flow;
    log.info(`\n🌊 Flow-Aware Execution: Detected ${targetModule} flow.`);
  }

  if (sandboxRoot) {
    const changes = getChangedFiles(originalRoot, sandboxRoot);

    if (changes.length > 0) {
      log.header("SANDBOX CHANGES");
      changes.forEach(c => {
        log.info(`📄 ${c.file}`);
      });

      const approved = await confirm("  Apply sandbox changes to real project?");
      if (approved) {
        changes.forEach(c => {
          const target = join(originalRoot, c.file);
          writeFileSync(target, c.newContent);
        });
        ux.success("Changes applied to real project.");

        // Task 3: Store after task (Phase 25)
        addToSession({
          task: task,
          files: changes.map(c => c.file),
          timestamp: Date.now()
        });
      } else {
        log.info("Changes discarded.");
      }
    } else {
      log.info("No changes detected in sandbox.");
    }

    cleanupSandbox(sandboxRoot);
  } else {
    // If not in sandbox, and successful, also store
    if (result.chain && result.chain.modifiedFiles.length > 0) {
      addToSession({
        task: task,
        files: [...new Set(result.chain.modifiedFiles)],
        timestamp: Date.now()
      });
    }
  }

  return result;
}

export async function runAgentStep({ task, projectDir }: { task: string; projectDir: string }, { onToken, rl }: any = {}) {
  const totalStart = Date.now();
  const tier = detectTier();
  const config = loadConfig();
  
  const metrics = createMetrics();
  metrics.model = config.model;
  metrics.tier = tier;

  log.header(`Single Step: ${task}`);
  log.info(`Mode: ${tier.toUpperCase()} model`);

  const chain = createChain();
  const step: Step = { id: 1, type: "modify", target: task, files: task.split(/\s+/), dependsOn: [] };

  await executeStep(step, 0, { task, projectDir, dryRun: true, autoMode: false, sandbox: false }, chain, { onToken, rl, metrics });

  const totalMs = elapsed(totalStart);
  log.header(`Done in ${(totalMs / 1000).toFixed(1)}s`);

  return { metrics, chain };
}
