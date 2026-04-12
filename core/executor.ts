import { join } from "node:path";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
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
  files?: string[];
  dependsOn: number[];
  status?: StepStatus;
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

  log.info(`\n→ ${step.type.toUpperCase()}: ${step.target}`);
  log.step(index + 1, step.target);

  let files: any[];
  let finalContext: any;

  function hashContext(ctx: any) {
    return crypto
      .createHash("sha1")
      .update(JSON.stringify(ctx))
      .digest("hex");
  }

  const retrieveStart = Date.now();
  ux.showStage("RETRIEVE");
  try {
    // Attempt deterministic contract-based retrieval
    const contract = resolveContract(step.type);

    const context = buildContext({
      filePath: (step as any).filePath || (step.files && step.files[0]),
      functionName: (step as any).functionName,
    });

    const validation = validateContext(context, contract);

    if (!validation.valid) {
      throw new Error("Invalid context: " + validation.missing.join(", "));
    }

    finalContext = trimContext(context, contract.maxTokens);
    log.info(`[RETRIEVAL] Deterministic success. Hash: ${hashContext(finalContext)}`);
    
    files = [{
      file: (step as any).filePath || step.files![0],
      content: context.file,
      score: 1.0
    }];
  } catch (e: any) {
    log.info(`[RETRIEVAL] Extending context: ${e.message}`);
    log.info(`[RETRIEVER] Searching for: ${step.files?.join(", ") || step.target}`);


    const keywords = [...(step.files || []), ...step.target.split(/\s+/)];
    try {
      files = await retrieve(projectDir, keywords, chain?.modifiedFiles || [], { metrics });
    } catch (err: any) {
      log.error(`[RETRIEVER] Failed: ${err.message}`);
      logBug({ task: step.target, type: "retrieval", severity: "high", description: err.message, fix_area: "retriever.js" });
      logToFile({ task: opts.task, mode, step: step.target, status: "retrieval_failed", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task: opts.task, step: step.target, status: "retrieval_failed" });
      return;
    }

    if (files.length > 0 && files[0].score === 0) {
      log.warn(`[RETRIEVER] Low confidence — broadening search`);
      const broader = [...keywords, ...step.target.split(/[^a-zA-Z]+/).filter((w) => w.length > 3)];
      try {
        files = await retrieve(projectDir, broader, chain?.modifiedFiles || [], { metrics });
      } catch {}
    }
  }

  log.info(`[RETRIEVER] Found: ${files.map((f) => `${f.file}${f.isNew ? " (NEW)" : ""} (${f.score})`).join(", ") || "(none)"} (${Date.now() - retrieveStart}ms)`);

  // --- FILE LOCKING ---
  const lockedFiles: string[] = [];
  for (const f of files.slice(0, 3)) { // Lock top 3 potential candidates
    if (!acquireLock(f.file)) {
      log.warn(`[LOCK] File ${f.file} is already being modified. Skipping parallel execution for this step.`);
      throw new Error(`File ${f.file} is locked`);
    }
    lockedFiles.push(f.file);
  }

  try {
    const codeStart = Date.now();
    ux.showStage("CODE");
    log.info(`[CODER] Generating file content...`);
    let fileUpdates: any[];
    let feedback = failureState.lastReviewRejectReason || failureState.lastFailureReason;

    try {
      fileUpdates = await generateWithRetry(step.target, files, feedback, chain, maxAttempts, { onToken, metrics });
      
      for (const update of fileUpdates) {
        const validation = validateStepResult(projectDir, update);
        if (!validation.valid) {
          if (metrics) metrics.retries++;
          log.warn(`[VALIDATOR] Result invalid: ${validation.reason}`);
          fileUpdates = await generateWithRetry(step.target, files, `Validator feedback: ${validation.reason}`, chain, 1, { onToken, metrics });
          break;
        }
      }
    } catch (err: any) {
      log.error(`[CODER] Failed: ${err.message}`);
      logBug({ task: step.target, type: "generation", severity: "high", description: err.message, fix_area: "coder.agent.js" });
      logToFile({ task: opts.task, mode, step: step.target, status: "code_failed", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task: opts.task, step: step.target, status: "code_failed" });
      recordPattern(step as any, "fail", []);
      handleFailure(step, err.message, chain, opts);
    }

    let patch: string | null = null;
    let approved = false;
    let reviewResult: any = null;

    if (fileUpdates! && fileUpdates!.length > 0) {
      log.info(`[CODER] Generated updates for ${fileUpdates!.length} file(s) (${Date.now() - codeStart}ms)`);
      for (const update of fileUpdates!) {
        log.info(`  › ${update.file} (${update.content.length} chars)`);
      }

      log.info(`[DIFF] Generating patch...`);
      try {
        patch = patchToUnified(projectDir, fileUpdates!.map(u => ({ file: u.file, content: u.content })));

        // Phase 36: Impact Analysis
        const index = loadIndex(projectDir);
        if (index && fileUpdates!.length > 0) {
          const file = fileUpdates![0].file;
          const affected = [
            ...((index as any).dependencies[file] || []),
            ...((index as any).reverseDependencies[file] || [])
          ];

          if (affected.length > 0) {
            log.warn(`\n⚠ Impact Analysis: This change may affect:`);
            affected.forEach((f: string) => log.info(`  - ${f}`));
          }
        }
      } catch (err: any) {
        log.error(`[DIFF] Failed: ${err.message}`);
        handleFailure(step, err.message, chain, opts);
      }

      if (patch) {
        const validation = validatePatch(patch);
        if (!validation.valid) {
          log.error(`[VALIDATE] Invalid patch: ${validation.errors.join(", ")}`);
          handleFailure(step, `Invalid patch: ${validation.errors.join(", ")}`, chain, opts);
          patch = null;
        }
      }

      if (patch) {
        log.patch(patch);
        const reviewStart = Date.now();
        ux.showStage("REVIEW");
        log.info(`[REVIEWER] Reviewing patch...`);
        try {
          reviewResult = await reviewerReview(patch);
          if (isApproved(reviewResult)) {
            approved = true;
            log.ok(`[REVIEWER] Passed (${Date.now() - reviewStart}ms)`);
          } else {
            if (metrics) metrics.retries++;
            log.warn(`[REVIEWER] Issue: ${reviewResult}`);
            logBug({ task: step.target, type: "generation", severity: "medium", description: reviewResult, fix_area: "reviewer.agent.js" });
            handleReviewFailure(step, reviewResult, chain, opts);
          }
        } catch (err: any) {
          log.warn(`[REVIEWER] Failed: ${err.message}`);
          logBug({ task: step.target, type: "execution", severity: "low", description: err.message, fix_area: "reviewer.agent.js" });
          handleReviewFailure(step, err.message, chain, opts);
        }
      }
    }

    // --- ESCALATION TO ADVISOR ---
    const shouldEscalate = !approved && (failureState.consecutiveFailures >= 2 || !patch);

    if (shouldEscalate && !failureState.advisorCalled && isAdvisorCallAllowed(step.target, { projectDir })) {
      log.section("ADVISOR");
      log.warn("[ADVISOR] Escalating to stronger model...");
      failureState.advisorCalled = true;

      try {
        const fixedPatch = await advisorFix({
          task: step.target,
          patch: patch!,
          feedback: reviewResult || failureState.lastFailureReason,
          metrics
        });

        if (fixedPatch) {
          const validation = validatePatch(fixedPatch);
          if (validation.valid) {
            log.info("[ADVISOR] Received valid patch. Reviewing...");
            const review = await reviewerReview(fixedPatch);
            if (isApproved(review)) {
              log.ok("[ADVISOR] Patch approved");
              patch = fixedPatch;
              approved = true;
              logToFile({ task: opts.task, mode, step: step.target, status: "success", advisor_used: true, timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
            } else {
              log.error(`[ADVISOR] Patch still not approved: ${review}`);
              failureState.advisorFailureCount++;
            }
          } else {
            log.error(`[ADVISOR] Invalid patch returned: ${validation.errors.join(", ")}`);
            failureState.advisorFailureCount++;
          }
        }
      } catch (err: any) {
        log.error(`[ADVISOR] Failed: ${err.message}`);
        failureState.advisorFailureCount++;
      }
    }

    if (!approved) {
      logToFile({ task: opts.task, mode, step: step.target, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      return;
    }

    log.section("RESULT");
    ux.showStage("PATCH");

    if (dryRun) {
      log.info(`[PATCHER] Validating (dry-run)...`);
      let result = await applyPatch(projectDir, patch!, true);
      
      if (result.retry) {
        log.info(`[EXECUTOR] Recovery successful. Retrying (dry-run)...`);
        result = await applyPatch(projectDir, result.patch, true);
        patch = result.patch; // Update patch for subsequent steps
      }

      if (result.valid) {
        log.ok(`[PATCHER] Valid (dry-run)`);
        logToFile({ task: opts.task, mode, step: step.target, status: "success", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
        remember({ task: opts.task, step: step.target, status: "dry_run_ok" });
      } else {
        log.error(`[PATCHER] Invalid: ${result.reason}`);
        logToFile({ task: opts.task, mode, step: step.target, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
        remember({ task: opts.task, step: step.target, status: "apply_failed", reason: result.reason });
      }

      const affectedFiles = extractPatchFiles(patch!);
      chain.modifiedFiles.push(...affectedFiles);
      trackRecentFiles(affectedFiles);
      try {
        const summary = await summarizePatch(patch!, { metrics });
        chain.patchSummaries.push(summary);
        log.info(`[SUMMARY] ${summary}`);
      } catch {}
      return;
    }

    log.info(`[PATCHER] Applying...`);
    // Phase Simulation Hook
    if (process.env.XEN_SIMULATE) simulateFailure(process.env.XEN_SIMULATE);

    let result = await applyPatch(projectDir, patch!, false, fileUpdates![0]?.content);

    if (result.retry) {
      log.info(`[EXECUTOR] Recovery successful. Retrying patch...`);
      result = await applyPatch(projectDir, result.patch, false, fileUpdates![0]?.content);
      patch = result.patch;
    }

    if (result.applied) {

      log.ok(`[PATCHER] Applied`);
      logToFile({ task: opts.task, mode, step: step.target, status: "success", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task: opts.task, step: step.target, status: "applied" });
      recordPattern(step as any, "success", chain.modifiedFiles);

      const affectedFiles = extractPatchFiles(patch!);
      chain.modifiedFiles.push(...affectedFiles);
      trackRecentFiles(affectedFiles);

      try {
        const summary = await summarizePatch(patch!, { metrics });
        chain.patchSummaries.push(summary);
        log.info(`[SUMMARY] ${summary}`);
      } catch {}
    } else {
      log.error(`[PATCHER] Failed: ${result.reason}`);
      logBug({ task: step.target, type: "patch", severity: "high", description: result.reason, fix_area: "patcher.js" });
      logToFile({ task: opts.task, mode, step: step.target, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task: opts.task, step: step.target, status: "apply_failed", reason: result.reason });
      recordPattern(step as any, "fail", []);
      handleFailure(step, result.reason!, chain, opts);
    }
  } finally {
    lockedFiles.forEach(releaseLock);
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
  log.info(`[PLANNER] Analyzing task...`);
  const steps: Step[] = (await plannerPlan(task, { metrics, projectDir })) as any;
  
  // Phase 31: Plan Preview and User Approval (Safety Check)
  log.info(`[PLANNER] Execution Plan:`);
  steps.forEach((s, i) => log.info(`  ${i + 1}. ${s.type.toUpperCase()} → ${s.target}`));

  if (steps.length > 6) {
    ux.warn(`Plan contains ${steps.length} steps. Large operations may be less reliable.`);
  }

  const approved = await confirm("Execute this plan?");
  if (!approved) {
    ux.warn("Plan rejected by user.");
    return { metrics, chain: createChain() };
  }

  const chain = createChain();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Phase 32: Clean Step Display
    console.log(`\n⚙️  [${step.type.toUpperCase()}] ${step.target}`);

    try {
      await executeStep(step, i, opts, chain, { onToken, rl, metrics });
    } catch (err: any) {
      log.error(`[EXECUTOR] Step ${step.id} failed: ${err.message}`);
      // Retry once if failed
      log.info(`[EXECUTOR] Retrying step ${step.id}...`);
      await executeStep(step, i, opts, chain, { onToken, rl, metrics });
    }
  }

  const totalMs = elapsed(totalStart);
  const timeSec = (totalMs / 1000).toFixed(2);
  log.header(`Done in ${timeSec}s`);

  if (chain.patchSummaries.length > 0) {
    ux.success("Task completed");
    log.info(`Changes: ${chain.patchSummaries.join("; ")}`);
  } else {
    ux.error("Task failed or no changes applied");
  }

  if (chain.modifiedFiles.length > 0) {
    log.info(`Files: ${[...new Set(chain.modifiedFiles)].join(", ")}`);
  }

  recordTestResult({
    task,
    status: (chain.modifiedFiles.length > 0) ? "success" : "fail",
    retries: metrics.retries,
    tokens: metrics.tokens,
    time_ms: totalMs
  });

  // Phase 32: Final Render
  renderStatus({
    model: config.model,
    stack: stackInfo.stack,
    stage: "COMPLETE",
    retries: metrics.retries,
    time: timeSec,
    tokens: metrics.tokens
  });

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
      log.section("SANDBOX CHANGES");
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
