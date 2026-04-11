import { join } from "node:path";
import { readFileSync } from "node:fs";
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
}

function handleReviewFailure(step, reason, chain, opts) {
  failureState.consecutiveFailures++;
  failureState.lastReviewRejectReason = reason;
  log.warn(`[REVIEW FAILURE] ${reason} (Count: ${failureState.consecutiveFailures})`);
}

function resetFailureState() {
  failureState.consecutiveFailures = 0;
  failureState.lastFailureReason = null;
  failureState.lastReviewRejectReason = null;
}

async function executeStep(step, index, opts, chain) {
  const { projectDir, dryRun, autoMode, maxAttempts, task } = opts;
  const stepStart = Date.now();
  const mode = dryRun ? "dry" : autoMode ? "auto" : "normal";
  const tier = detectTier();

  resetFailureState();
  failureState.advisorCalled = false; // Reset advisor usage for each step

  if (failureState.advisorCalled && failureState.advisorFailureCount >= 3) {
    log.warn(`[ADVISOR] Already failed 3 times - no more advisor attempts`);
    return;
  }

  log.step(index + 1, step.step);

  log.info(`[RETRIEVER] Searching for: ${step.files.join(", ") || step.step}`);

  const keywords = [...step.files, ...step.step.split(/\s+/)];
  let files;
  try {
    files = await retrieve(projectDir, keywords, chain?.modifiedFiles || []);
  } catch (err) {
    log.error(`[RETRIEVER] Failed: ${err.message}`);
    logToFile({ task, mode, step: step.step, status: "retrieval_failed", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "retrieval_failed" });
    return;
  }

  if (files.length > 0 && files[0].score === 0) {
    log.warn(`[RETRIEVER] Low confidence — broadening search`);
    const broader = [...keywords, ...step.step.split(/[^a-zA-Z]+/).filter((w) => w.length > 3)];
    try {
      files = await retrieve(projectDir, broader, chain?.modifiedFiles || []);
    } catch {}
  }

  log.info(`[RETRIEVER] Found: ${files.map((f) => `${f.file}${f.isNew ? " (NEW)" : ""} (${f.score})`).join(", ") || "(none)"}`);

  const targetFile = files[0];

  log.info(`[CODER] Generating file content...`);
  let fileResult;
  let feedback = failureState.lastReviewRejectReason || failureState.lastFailureReason;

  try {
    fileResult = await generateWithRetry(step.step, files, feedback, chain, maxAttempts);
  } catch (err) {
    log.error(`[CODER] Failed: ${err.message}`);
    logToFile({ task, mode, step: step.step, status: "code_failed", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "code_failed" });
    recordPattern(step.step, "fail");
    handleFailure(step.step, err.message, chain, opts);
  }

  let patch;
  let approved = false;
  let reviewResult = null;

  if (fileResult) {
    log.info(`[CODER] Generated: ${fileResult.filePath} (${fileResult.content.length} chars)`);

    log.info(`[DIFF] Generating patch...`);
    try {
      patch = patchToUnified(projectDir, [{ file: fileResult.filePath, content: fileResult.content }]);
    } catch (err) {
      log.error(`[DIFF] Failed: ${err.message}`);
      handleFailure(step.step, err.message, chain, opts);
    }

    if (patch) {
      const validation = validatePatch(patch);
      if (!validation.valid) {
        log.error(`[VALIDATE] Invalid patch: ${validation.errors.join(", ")}`);
        handleFailure(step.step, `Invalid patch: ${validation.errors.join(", ")}`, chain, opts);
        patch = null;
      }
    }

    if (patch) {
      log.patch(patch);
      log.info(`[REVIEWER] Reviewing patch...`);
      try {
        reviewResult = await reviewerReview(patch);
        if (isApproved(reviewResult)) {
          approved = true;
          log.ok(`[REVIEWER] Passed`);
        } else {
          log.warn(`[REVIEWER] Issue: ${reviewResult}`);
          handleReviewFailure(step.step, reviewResult, chain, opts);
        }
      } catch (err) {
        log.warn(`[REVIEWER] Failed: ${err.message}`);
        handleReviewFailure(step.step, err.message, chain, opts);
      }
    }
  }

  // --- ESCALATION TO ADVISOR ---
  const shouldEscalate = !approved && (failureState.consecutiveFailures >= 2 || !patch);

  if (shouldEscalate && !failureState.advisorCalled && isAdvisorCallAllowed(step.step, { projectDir })) {
    log.section("ADVISOR");
    log.warn("[ADVISOR] Escalating to stronger model...");
    failureState.advisorCalled = true;

    try {
      const fixedPatch = await advisorFix({
        task: step.step,
        patch,
        feedback: reviewResult || failureState.lastFailureReason
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
            logToFile({ task, mode, step: step.step, status: "success", advisor_used: true, timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
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
    logToFile({ task, mode, step: step.step, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    return;
  }

  resetFailureState();

  log.section("RESULT");

  if (dryRun) {
    log.info(`[PATCHER] Validating (dry-run)...`);
    const result = applyPatch(projectDir, patch, true);
    if (result.valid) {
      log.ok(`[PATCHER] Valid (dry-run)`);
      logToFile({ task, mode, step: step.step, status: "success", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.step, status: "dry_run_ok" });
    } else {
      log.error(`[PATCHER] Invalid: ${result.reason}`);
      logToFile({ task, mode, step: step.step, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.step, status: "apply_failed", reason: result.reason });
    }
    const affectedFiles = extractPatchFiles(patch);
    chain.modifiedFiles.push(...affectedFiles);
    trackRecentFiles(affectedFiles);
    try {
      const summary = await summarizePatch(patch);
      chain.patchSummaries.push(summary);
      log.info(`[SUMMARY] ${summary}`);
    } catch {}
    return;
  }

  const yes = await confirm("\n  Apply patch?");
  if (!yes) {
    log.warn(`[PATCHER] Skipped by user`);
    logToFile({ task, mode, step: step.step, status: "skipped", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "skipped" });
    return;
  }

  log.info(`[PATCHER] Applying...`);
  const result = applyPatch(projectDir, patch, false);

  if (result.applied) {
    log.ok(`[PATCHER] Applied`);
    logToFile({ task, mode, step: step.step, status: "success", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "applied" });
    recordPattern(step.step, "success");

    const affectedFiles = extractPatchFiles(patch);
    chain.modifiedFiles.push(...affectedFiles);
    trackRecentFiles(affectedFiles);

    try {
      const summary = await summarizePatch(patch);
      chain.patchSummaries.push(summary);
      log.info(`[SUMMARY] ${summary}`);
    } catch {}
  } else {
    log.error(`[PATCHER] Failed: ${result.reason}`);
    logToFile({ task, mode, step: step.step, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "apply_failed", reason: result.reason });
    recordPattern(step.step, "fail");
    handleFailure(step.step, result.reason, chain, opts);
  }
}

export async function runAgent({ task, projectDir, dryRun, autoMode }) {
  const profile = getTierProfile();
  const tier = detectTier();
  const totalStart = Date.now();

  log.header(`Task: ${task}`);
  log.info(`Mode: ${dryRun ? "dry-run" : "live"} | Auto: ${autoMode}`);

  log.section("MODEL");
  log.info(`  › ${tier.toUpperCase()} model`);

  log.section("PLANNER");
  log.info(`[PLANNER] Analyzing task...`);
  const steps = await plannerPlan(task);
  log.info(`[PLANNER] ${steps.length} step(s):`);
  steps.forEach((s, i) => log.info(`  ${i + 1}. ${s.step}`));

  const chain = createChain();
  const maxAttempts = autoMode ? profile.maxRetries : 1;

  for (let i = 0; i < steps.length; i++) {
    await executeStep(steps[i], i, { projectDir, dryRun, autoMode, maxAttempts, task }, chain);
  }

  const totalMs = elapsed(totalStart);
  log.header(`Done in ${(totalMs / 1000).toFixed(1)}s`);

  if (chain.patchSummaries.length > 0) {
    log.info(`Changes: ${chain.patchSummaries.join("; ")}`);
  }
  if (chain.modifiedFiles.length > 0) {
    log.info(`Files: ${[...new Set(chain.modifiedFiles)].join(", ")}`);
  }
}

export async function runAgentStep({ task, projectDir }) {
  const totalStart = Date.now();
  const tier = detectTier();

  log.header(`Single Step: ${task}`);
  log.info(`Mode: ${tier.toUpperCase()} model`);

  const chain = createChain();
  const step = { step: task, files: task.split(/\s+/) };

  await executeStep(step, 0, { projectDir, dryRun: true, autoMode: false, maxAttempts: 2, task }, chain);

  const totalMs = elapsed(totalStart);
  log.header(`Done in ${(totalMs / 1000).toFixed(1)}s`);
}