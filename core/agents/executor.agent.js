import { join } from "node:path";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { log, logToFile } from "../logger.js";
import { retrieve } from "../retriever.js";
import { generateWithRetry } from "./coder.agent.js";
import { plan as plannerPlan } from "./planner.agent.js";
import { review as reviewerReview, isApproved } from "./reviewer.agent.js";
import { applyPatch, validatePatch } from "../patcher.js";
import { patchToUnified } from "../diff-generator.js";
import { remember, trackRecentFiles, recordPattern, getRecentFileNames } from "../memory.js";
import { summarizePatch } from "../summarizer.js";
import { confirm } from "../prompt.js";
import { detectTier, getTierProfile } from "../tier.js";
import { advisorFix, isAdvisorCallAllowed } from "../advisor.js";
import { buildExecutionBatches } from "../scheduler.js";
import { acquireLock, releaseLock } from "../locks.js";
import { loadConfig } from "../config.js";
import { createMetrics } from "../metrics.js";
import { logBug, recordTestResult } from "../analytics.js";
import { resolveContract } from "../retrieval/resolver.ts";
import { buildContext } from "../retrieval/contextBuilder.ts";
import { validateContext } from "../retrieval/validator.ts";
import { trimContext } from "../retrieval/tokenLimiter.ts";
import { stage, statusBar, diffInteractive } from "../tui/index.js";
import crypto from "crypto";
import { createSandbox } from "../sandbox/manager.js";
import { cleanupSandbox } from "../sandbox/cleanup.js";
import { getChangedFiles } from "../sandbox/diff.js";
import * as ux from "../tui/ux.js";
import { addToSession } from "../memory/session.js";

let failureState = {
  consecutiveFailures: 0,
  lastFailureReason: null,
  lastReviewRejectReason: null,
  advisorCalled: false,
  advisorFailureCount: 0,
};

function elapsed(start) {
  return Date.now() - start;
}

function extractPatchFiles(patch) {
  return [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
}

function createChain() {
  return {
    modifiedFiles: [],
    patchSummaries: [],
    get patchSummary() {
      return this.patchSummaries.length
        ? this.patchSummaries.join("; ")
        : null;
    },
  };
}

function handleFailure(step, reason, chain, opts) {
  failureState.consecutiveFailures++;
  failureState.lastFailureReason = reason;
  log.warn(`[FAILURE] ${reason} (Count: ${failureState.consecutiveFailures})`);
  
  // Phase 46: Failure Memory
  recordPattern(step, "fail", []);
}

function handleReviewFailure(step, reason, chain, opts) {
  failureState.consecutiveFailures++;
  failureState.lastReviewRejectReason = reason;
  log.warn(`[REVIEW FAILURE] ${reason} (Count: ${failureState.consecutiveFailures})`);
  
  // Phase 46: Failure Memory
  recordPattern(step, "fail", []);
}

function resetFailureState() {
  failureState.consecutiveFailures = 0;
  failureState.lastFailureReason = null;
  failureState.lastReviewRejectReason = null;
}

function validateStepResult(projectDir, fileUpdate) {
  if (!fileUpdate.content || fileUpdate.content.length < 10) {
    return { valid: false, reason: `Generated content for ${fileUpdate.file} is too small or empty` };
  }

  if (fileUpdate.file && fileUpdate.file.endsWith(".js")) {
    try {
      const code = fileUpdate.content;
      const stack = [];
      const pairs = { '{': '}', '(': ')', '[': ']' };
      for (let char of code) {
        if (pairs[char]) stack.push(char);
        else if (Object.values(pairs).includes(char)) {
          if (pairs[stack.pop()] !== char) return { valid: false, reason: `Unbalanced braces or parentheses detected in ${fileUpdate.file}` };
        }
      }
    } catch (err) {
      return { valid: false, reason: `Syntax check failed for ${fileUpdate.file}: ${err.message}` };
    }
  }

  return { valid: true };
}

async function executeStep(step, index, opts, chain, { onToken, rl, metrics } = {}) {
  const { projectDir, dryRun, autoMode, maxAttempts, task } = opts;
  const stepStart = Date.now();
  const mode = dryRun ? "dry" : autoMode ? "auto" : "normal";
  const tier = detectTier();

  resetFailureState();
  failureState.advisorCalled = false; 

  if (failureState.advisorCalled && failureState.advisorFailureCount >= 3) {
    log.warn(`[ADVISOR] Already failed 3 times - no more advisor attempts`);
    return;
  }

  log.info(`\n→ ${step.type.toUpperCase()}: ${step.target}`);
  log.step(index + 1, step.target);

  let files;
  let finalContext;

  function hashContext(ctx) {
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
      filePath: step.filePath || (step.files && step.files[0]),
      functionName: step.functionName,
    });

    const validation = validateContext(context, contract);

    if (!validation.valid) {
      throw new Error("Invalid context: " + validation.missing.join(", "));
    }

    finalContext = trimContext(context, contract.maxTokens);
    log.info(`[RETRIEVAL] Deterministic success. Hash: ${hashContext(finalContext)}`);
    
    files = [{
      file: step.filePath || step.files[0],
      content: context.file,
      score: 1.0
    }];
  } catch (e) {
    log.warn(`[RETRIEVAL] Fallback to legacy: ${e.message}`);
    log.info(`[RETRIEVER] Searching for: ${step.files.join(", ") || step.target}`);

    const keywords = [...(step.files || []), ...step.target.split(/\s+/)];
    try {
      files = await retrieve(projectDir, keywords, chain?.modifiedFiles || [], { metrics });
    } catch (err) {
      log.error(`[RETRIEVER] Failed: ${err.message}`);
      logBug({ task: step.target, type: "retrieval", severity: "high", description: err.message, fix_area: "retriever.js" });
      logToFile({ task, mode, step: step.target, status: "retrieval_failed", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.target, status: "retrieval_failed" });
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
  const lockedFiles = [];
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
    let fileUpdates;
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
    } catch (err) {
      log.error(`[CODER] Failed: ${err.message}`);
      logBug({ task: step.target, type: "generation", severity: "high", description: err.message, fix_area: "coder.agent.js" });
      logToFile({ task, mode, step: step.target, status: "code_failed", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.target, status: "code_failed" });
      recordPattern(step.target, "fail");
      handleFailure(step.target, err.message, chain, opts);
    }

    let patch;
    let approved = false;
    let reviewResult = null;

    if (fileUpdates && fileUpdates.length > 0) {
      log.info(`[CODER] Generated updates for ${fileUpdates.length} file(s) (${Date.now() - codeStart}ms)`);
      for (const update of fileUpdates) {
        log.info(`  › ${update.file} (${update.content.length} chars)`);
      }

      log.info(`[DIFF] Generating patch...`);
      try {
        patch = patchToUnified(projectDir, fileUpdates.map(u => ({ file: u.file, content: u.content })));

        // Phase 36: Impact Analysis
        const index = loadIndex();
        if (index && fileUpdates.length > 0) {
          const file = fileUpdates[0].file;
          const affected = [
            ...(index.dependencies[file] || []),
            ...(index.reverseDependencies[file] || [])
          ];

          if (affected.length > 0) {
            log.warn(`\n⚠ Impact Analysis: This change may affect:`);
            affected.forEach(f => log.info(`  - ${f}`));
          }
        }
      } catch (err) {
        log.error(`[DIFF] Failed: ${err.message}`);
        handleFailure(step.target, err.message, chain, opts);
      }
      if (patch) {
        const validation = validatePatch(patch);
        if (!validation.valid) {
          log.error(`[VALIDATE] Invalid patch: ${validation.errors.join(", ")}`);
          handleFailure(step.target, `Invalid patch: ${validation.errors.join(", ")}`, chain, opts);
          patch = null;
        }
      }

      if (patch) {
        log.patch(patch);
        const reviewStart = Date.now();
        ux.showStage("REVIEW");
        log.info(`[REVIEWER] Reviewing patch...`);
        try {
          reviewResult = await reviewerReview(patch, { metrics });
          if (isApproved(reviewResult)) {
            approved = true;
            log.ok(`[REVIEWER] Passed (${Date.now() - reviewStart}ms)`);
          } else {
            if (metrics) metrics.retries++;
            log.warn(`[REVIEWER] Issue: ${reviewResult}`);
            logBug({ task: step.target, type: "generation", severity: "medium", description: reviewResult, fix_area: "reviewer.agent.js" });
            handleReviewFailure(step.target, reviewResult, chain, opts);
          }
        } catch (err) {
          log.warn(`[REVIEWER] Failed: ${err.message}`);
          logBug({ task: step.target, type: "execution", severity: "low", description: err.message, fix_area: "reviewer.agent.js" });
          handleReviewFailure(step.target, err.message, chain, opts);
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
          patch,
          feedback: reviewResult || failureState.lastFailureReason,
          metrics
        });

        if (fixedPatch) {
          const validation = validatePatch(fixedPatch);
          if (validation.valid) {
            log.info("[ADVISOR] Received valid patch. Reviewing...");
            const review = await reviewerReview(fixedPatch, { metrics });
            if (isApproved(review)) {
              log.ok("[ADVISOR] Patch approved");
              patch = fixedPatch;
              approved = true;
              logToFile({ task, mode, step: step.target, status: "success", advisor_used: true, timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
            } else {
              log.error(`[ADVISOR] Patch still not approved: ${review}`);
              failureState.advisorFailureCount++;
            }
          } else {
            log.error(`[ADVISOR] Invalid patch returned: ${validation.errors.join(", ")}`);
            failureState.advisorFailureCount++;
          }
        }
      } catch (err) {
        log.error(`[ADVISOR] Failed: ${err.message}`);
        failureState.advisorFailureCount++;
      }
    }

    if (!approved) {
      logToFile({ task, mode, step: step.target, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      return;
    }

    log.section("RESULT");
    ux.showStage("PATCH");

    if (dryRun) {
      log.info(`[PATCHER] Validating (dry-run)...`);
      const result = await applyPatch(projectDir, patch, true);
      if (result.valid) {
        log.ok(`[PATCHER] Valid (dry-run)`);
        logToFile({ task, mode, step: step.target, status: "success", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
        remember({ task, step: step.target, status: "dry_run_ok" });
      } else {
        log.error(`[PATCHER] Invalid: ${result.reason}`);
        logToFile({ task, mode, step: step.target, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
        remember({ task, step: step.target, status: "apply_failed", reason: result.reason });
      }
      const affectedFiles = extractPatchFiles(patch);
      chain.modifiedFiles.push(...affectedFiles);
      trackRecentFiles(affectedFiles);
      try {
        const summary = await summarizePatch(patch, { metrics });
        chain.patchSummaries.push(summary);
        log.info(`[SUMMARY] ${summary}`);
      } catch {}
      return;
    }

    log.info(`[PATCHER] Applying...`);
    const result = await applyPatch(projectDir, patch, false, fileUpdates[0]?.content);

    if (result.applied) {
      log.ok(`[PATCHER] Applied`);
      logToFile({ task, mode, step: step.target, status: "success", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.target, status: "applied" });
      recordPattern(step.target, "success");

      const affectedFiles = extractPatchFiles(patch);
      chain.modifiedFiles.push(...affectedFiles);
      trackRecentFiles(affectedFiles);

      try {
        const summary = await summarizePatch(patch, { metrics });
        chain.patchSummaries.push(summary);
        log.info(`[SUMMARY] ${summary}`);
      } catch {}
    } else {
      log.error(`[PATCHER] Failed: ${result.reason}`);
      logBug({ task: step.target, type: "patch", severity: "high", description: result.reason, fix_area: "patcher.js" });
      logToFile({ task, mode, step: step.target, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.target, status: "apply_failed", reason: result.reason });
      recordPattern(step.target, "fail");
      handleFailure(step.target, result.reason, chain, opts);
    }
  } finally {
    lockedFiles.forEach(releaseLock);
  }
}

async function executePipeline(opts, { onToken, rl } = {}) {
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
  const steps = await plannerPlan(task, { metrics, projectDir });
  
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
  const maxAttempts = autoMode ? profile.maxRetries : 1;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    
    // Phase 32: Clean Step Display
    console.log(`\n⚙️  [${step.type.toUpperCase()}] ${step.target}`);

    try {
      await executeStep(step, i, { projectDir, dryRun, autoMode, maxAttempts, task }, chain, { onToken, rl, metrics });
    } catch (err) {
      log.error(`[EXECUTOR] Step ${step.id} failed: ${err.message}`);
      // Retry once if failed
      log.info(`[EXECUTOR] Retrying step ${step.id}...`);
      await executeStep(step, i, { projectDir, dryRun, autoMode, maxAttempts, task }, chain, { onToken, rl, metrics });
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

export async function runAgent(opts, { onToken, rl } = {}) {
  let { projectDir, sandbox } = opts;
  let originalRoot = projectDir;
  let sandboxRoot = null;

  if (sandbox) {
    try {
      sandboxRoot = createSandbox(projectDir);
      log.info(`🧪 Running in sandbox: ${sandboxRoot}`);
      projectDir = sandboxRoot;
      opts.projectDir = sandboxRoot;
    } catch (err) {
      log.warn(`Sandbox creation failed: ${err.message}. Falling back to normal mode.`);
      sandbox = false;
    }
  }

  const result = await executePipeline(opts, { onToken, rl });

  // Phase 43: Flow-Aware Execution
  const index = loadIndex();
  const targetModule = detectModule(opts.task);
  if (index && targetModule && index.flows && index.flows[targetModule]) {
    const flow = index.flows[targetModule].flow;
    log.info(`\n🌊 Flow-Aware Execution: Detected ${targetModule} flow.`);
    // Flow awareness is currently injected via the architectural context in prompts (Phase 44)
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
          task: opts.task,
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
        task: opts.task,
        files: [...new Set(result.chain.modifiedFiles)],
        timestamp: Date.now()
      });
    }
  }

  return result;
}

export async function runAgentStep({ task, projectDir }, { onToken, rl } = {}) {
  const totalStart = Date.now();
  const tier = detectTier();
  const config = loadConfig();
  
  const metrics = createMetrics();
  metrics.model = config.model;
  metrics.tier = tier;

  log.header(`Single Step: ${task}`);
  log.info(`Mode: ${tier.toUpperCase()} model`);

  const chain = createChain();
  const step = { id: 1, type: "modify", target: task, files: task.split(/\s+/), dependsOn: [] };

  await executeStep(step, 0, { projectDir, dryRun: true, autoMode: false, maxAttempts: 2, task }, chain, { onToken, rl, metrics });

  const totalMs = elapsed(totalStart);
  log.header(`Done in ${(totalMs / 1000).toFixed(1)}s`);

  return { metrics, chain };
}
