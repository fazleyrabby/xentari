import { mkdirSync } from "node:fs";
import { loadConfig } from "./config.js";
import { log, logToFile } from "./logger.js";
import { plan } from "./planner.js";
import { retrieve } from "./retriever.js";
import { generatePatch } from "./coder.js";
import { patchToUnified } from "./diff-generator.js";
import { review, isApproved } from "./reviewer.js";
import { applyPatch, validatePatch } from "./patcher.js";
import { remember, trackRecentFiles, recordPattern } from "./memory.js";
import { summarizePatch } from "./summarizer.js";
import { confirm } from "./prompt.js";
import { detectTier, getTierProfile } from "./tier.js";
import { resolveContract } from "./retrieval/resolver.ts";
import { buildContext } from "./retrieval/contextBuilder.ts";
import { validateContext } from "./retrieval/validator.ts";
import { trimContext } from "./retrieval/tokenLimiter.ts";
import { stage, statusBar } from "./tui/index.js";
import { Task, Context, PipelineResult } from "./types/index.ts";
import crypto from "crypto";

function elapsed(start: number): number {
  return Date.now() - start;
}

function extractPatchFiles(patch: string): string[] {
  return [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
}

function createChain() {
  return {
    modifiedFiles: [],
    patchSummaries: [],
    get patchSummary() {
      return this.patchSummaries.length ? this.patchSummaries.join("; ") : null;
    },
  };
}

async function codeAndReview(step: any, files: any[], maxAttempts: number, chainContext: any, projectDir: string): Promise<{ patch: string | null; approved: boolean; review?: string | null }> {
  let feedback = null;
  let consecutiveReviewFails = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) log.info(`Retry ${attempt}/${maxAttempts}`);

    log.info("Generating updated file content...");
    let fileUpdates;
    try {
      fileUpdates = await generatePatch(step.step, files, feedback, chainContext);
    } catch (err: any) {
      log.error(`Code generation failed: ${err.message}`);
      return { patch: null, approved: false };
    }

    const tier = detectTier();
    if (tier === "small" && fileUpdates.length !== 1) {
      log.error(`Only one file allowed in SMALL mode, got ${fileUpdates.length}`);
      return { patch: null, approved: false };
    }

    log.info(`Generated: ${fileUpdates.map((f: any) => `${f.file} (${f.content.length} chars)`).join(", ")}`);

    let patch;
    try {
      patch = patchToUnified(projectDir, fileUpdates);
    } catch (err: any) {
      log.error(`Diff generation failed: ${err.message}`);
      feedback = `Diff generation failed: ${err.message}. Ensure the file path is correctly specified at the start of each file content.`;
      if (attempt === maxAttempts) return { patch: null, approved: false, review: feedback };
      continue;
    }

    const validation = validatePatch(patch);
    if (!validation.valid) {
      log.error("Invalid patch:");
      validation.errors.forEach((e: string) => log.error(`  ${e}`));
      feedback = `Invalid patch structure: ${validation.errors.join("; ")}. Generate correct file content.`;
      if (attempt === maxAttempts) return { patch: null, approved: false, review: feedback };
      continue;
    }

    log.patch(patch);
    log.section("REVIEW");
    log.info("Reviewing...");
    let result;
    try {
      result = await review(patch);
    } catch (err: any) {
      log.warn(`Review failed: ${err.message}`);
      return { patch, approved: false, review: err.message };
    }

    if (isApproved(result)) {
      log.ok("Review passed");
      return { patch, approved: true, review: result };
    }

    consecutiveReviewFails++;
    log.warn(`Review: ${result}`);
    if (consecutiveReviewFails >= 2) {
      log.error("Reviewer failed twice consecutively — stopping retries");
      return { patch: null, approved: false, review: result };
    }
    feedback = `Previous attempt failed review:\n${result}\n\nFix the issues and regenerate the file content.`;
  }
  return { patch: null, approved: false, review: feedback };
}

async function processStep(step: Task, index: number, opts: any, chain: any): Promise<void> {
  const { projectDir, dryRun, autoMode, maxAttempts, task } = opts;
  const stepStart = Date.now();
  const mode = dryRun ? "dry" : autoMode ? "auto" : "normal";

  log.step(index + 1, step.step);

  let files;
  let finalContext;

  function hashContext(ctx: any): string {
    return crypto.createHash("sha1").update(JSON.stringify(ctx)).digest("hex");
  }

  try {
    const contract = resolveContract(step.type);
    const context = buildContext({
      filePath: (step.filePath || (step.files && step.files[0]) || "") as string,
      functionName: step.functionName,
    });

    const validation = validateContext(context, contract);
    if (!validation.valid) throw new Error("Invalid context: " + validation.missing.join(", "));

    finalContext = trimContext(context, contract.maxTokens);
    log.info(`New retrieval success. Context hash: ${hashContext(finalContext)}`);
    
    files = [{
      file: (step.filePath || (step.files && step.files[0]) || "") as string,
      content: context.file,
      score: 1.0
    }];
  } catch (e: any) {
    log.warn(`Fallback to legacy retrieval: ${e.message}`);
    log.info("Retrieving files...");
    const keywords = [...(step.files || []), ...step.step.split(/\s+/)];
    try {
      files = await retrieve(projectDir, keywords, chain.modifiedFiles);
    } catch (err: any) {
      log.error(`Retrieval failed: ${err.message}`);
      logToFile({ task, mode, step: step.step, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.step, status: "retrieval_failed" });
      return;
    }
  }

  if (files && files.length > 0) {
    log.info(`Files: ${files.map((f: any) => `${f.file} (${f.score})`).join(", ") || "(none)"}`);
  }

  const { patch, approved, review: reviewText } = await codeAndReview(step, files, maxAttempts, chain, projectDir);

  if (!patch) {
    logToFile({ task, mode, step: step.step, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "code_failed" });
    recordPattern(step.step, "fail");
    return;
  }

  if (!approved) {
    log.warn("Reviewer flagged issues — skipping application");
    logToFile({ task, mode, step: step.step, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "review_rejected", review: reviewText });
    recordPattern(step.step, "fail");
    return;
  }

  log.section("RESULT");
  if (dryRun) {
    log.info("Validating patch (dry-run)...");
    const result = await applyPatch(projectDir, patch, true);
    if (result.valid) {
      log.ok("Patch valid (dry-run, not applied)");
      logToFile({ task, mode, step: step.step, status: "success", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.step, status: "dry_run_ok" });
    } else {
      log.error(`Patch invalid: ${result.reason}`);
      logToFile({ task, mode, step: step.step, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
      remember({ task, step: step.step, status: "apply_failed", reason: result.reason });
    }
    const patchFiles = extractPatchFiles(patch);
    chain.modifiedFiles.push(...patchFiles);
    trackRecentFiles(patchFiles);
    try {
      const summary = await summarizePatch(patch);
      chain.patchSummaries.push(summary);
      log.info(`Summary: ${summary}`);
    } catch {}
    return;
  }

  log.info("Applying patch...");
  const result = await applyPatch(projectDir, patch, false);

  if (result.applied) {
    log.ok("Patch applied");
    logToFile({ task, mode, step: step.step, status: "success", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "applied" });
    recordPattern(step.step, "success");

    const patchFiles = extractPatchFiles(patch);
    chain.modifiedFiles.push(...patchFiles);
    trackRecentFiles(patchFiles);

    try {
      const summary = await summarizePatch(patch);
      chain.patchSummaries.push(summary);
      log.info(`Summary: ${summary}`);
    } catch {}
  } else {
    log.error(`Patch failed: ${result.reason}`);
    logToFile({ task, mode, step: step.step, status: "fail", timestamp: new Date().toISOString(), duration_ms: elapsed(stepStart) });
    remember({ task, step: step.step, status: "apply_failed", reason: result.reason });
    recordPattern(step.step, "fail");
  }
}

export async function runPlanOnly({ task, projectDir }: { task: string; projectDir?: string }): Promise<any[]> {
  log.section("PLAN");
  const steps = await plan(task, projectDir || process.cwd());
  steps.forEach((s, i) => log.info(`${i + 1}. ${s.step} [${s.files.join(", ")}]`));
  return steps;
}

export async function runCodeOnly({ task, projectDir }: { task: string; projectDir: string }): Promise<string | null> {
  log.section("PATCH");
  log.info("Retrieving files...");
  const keywords = task.split(/\s+/);
  const files = await retrieve(projectDir, keywords);
  log.info(`Files: ${files.map((f: any) => `${f.file} (${f.score})`).join(", ") || "(none)"}`);

  log.info("Generating updated file content...");
  const fileUpdates = await generatePatch(task, files, null, null);
  log.info(`Generated content for ${fileUpdates.length} file(s)`);

  let patch;
  try {
    patch = patchToUnified(projectDir, fileUpdates);
  } catch (err: any) {
    log.error(`Diff generation failed: ${err.message}`);
    return null;
  }

  const validation = validatePatch(patch);
  if (!validation.valid) {
    log.error("Invalid patch:");
    validation.errors.forEach((e: string) => log.error(`  ${e}`));
    return null;
  }
  log.patch(patch);
  return patch;
}

export async function runReviewOnly({ patch }: { patch: string }): Promise<string | null> {
  log.section("REVIEW");
  if (!patch) {
    log.error("No patch provided. Pipe a patch or pass it as the task argument.");
    return null;
  }
  const result = await review(patch);
  if (isApproved(result)) log.ok("Review: OK");
  else log.warn(`Review:\n${result}`);
  return result;
}

export async function run({ task, projectDir, dryRun, autoMode }: { task: string; projectDir: string; dryRun: boolean; autoMode: boolean }): Promise<void> {
  const config = loadConfig();
  const profile = getTierProfile();
  const tier = detectTier();
  const totalStart = Date.now();
  mkdirSync(config.logsDir, { recursive: true });

  log.header(`Task: ${task}`);
  log.info(`Mode: ${dryRun ? "dry-run" : "live"} | Auto: ${autoMode}`);
  log.section("MODEL");
  log.info(`  › ${config.model} (${tier.toUpperCase()})`);

  log.section("PLAN");
  log.info("Planning...");
  const steps = await plan(task, projectDir);
  log.info(`${steps.length} step(s):`);
  steps.forEach((s, i) => log.info(`  ${i + 1}. ${s.step}`));

  const chain = createChain();
  const maxAttempts = autoMode ? profile.maxRetries : 1;
  for (let i = 0; i < steps.length; i++) {
    await processStep(steps[i] as any as Task, i, { projectDir, dryRun, autoMode, maxAttempts, task }, chain);
  }

  const totalMs = elapsed(totalStart);
  log.header(`Done in ${(totalMs / 1000).toFixed(1)}s`);

  if (chain.patchSummaries.length > 0) log.info(`Changes: ${chain.patchSummaries.join("; ")}`);
  if (chain.modifiedFiles.length > 0) log.info(`Files touched: ${[...new Set(chain.modifiedFiles)].join(", ")}`);

  statusBar.renderStatusBar({
    task,
    stage: "COMPLETE",
    tokens: "N/A",
    time: (totalMs / 1000).toFixed(1),
    retries: 0
  });
}
