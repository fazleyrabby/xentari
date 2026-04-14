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
import { runTest, summarizeFailure } from "./utils/testRunner.ts";
import { selectContext, formatContext } from "./retrieval/contextEngine.ts";
import { 
  loadSnapshot, 
  saveSnapshot, 
  validateContracts, 
  updateSnapshotAfterStep, 
  checkStale, 
  captureFileSnapshot 
} from "./retrieval/consistency.ts";
import { 
  isWithinScope, 
  intentAllowsContractBreak, 
  validateChangeSize,
  Intent
} from "./retrieval/intentEngine.ts";
import { logFailure } from "./retrieval/feedbackEngine.ts";

import { simulateFailure } from "./utils/simulation.js";
import { loadStack } from "./loadStack.js";


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
  intent?: Intent;
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

let executionState = {
  anyPatchApplied: false,
  failed: false
};

const ORDER = [
  "model",
  "service",
  "controller",
  "routes"
];

function validatePlan(steps: Step[]) {
  for (const step of steps) {
    if (!step.target || typeof step.target !== "string") {
      throw new Error(`INVALID_PLAN_STEP: Missing target for step ${step.id}`);
    }
  }

  // Fix 7: Multi-file Order Enforcement
  steps.sort((a, b) => {
    const targetA = a.target.toLowerCase();
    const targetB = b.target.toLowerCase();
    
    const indexA = ORDER.findIndex(o => targetA.includes(o));
    const indexB = ORDER.findIndex(o => targetB.includes(o));
    
    const valA = indexA === -1 ? 99 : indexA;
    const valB = indexB === -1 ? 99 : indexB;
    
    if (valA !== valB) return valA - valB;
    return a.id - b.id; // Preserve original id order for same type
  });
}

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

async function validateStep(projectDir: string, step: Step, fileUpdate: { file: string; content: string }) {
  // E8 — Intent Engine (Scope Enforcement)
  if (step.intent) {
    log.info(`[DEBUG] Scope Check: targetPath="${step.target}", intent.target="${step.intent.target}", intent.scope="${step.intent.scope}"`);
    if (!isWithinScope(step.target, step.intent)) {
      log.step("INTENT", "✗", "SCOPE_VIOLATION");
      return { valid: false, reason: `Scope violation: Change to ${step.target} is outside intended scope (${step.intent.scope}).` };
    }
  }

  // E3 — Structure Enforcement (Structure Validation)
  if (step.role && step.pattern) {
    try {
      const { validateStructure } = await import("./patterns.js");
      validateStructure(fileUpdate.content, step.role, step.pattern);
      log.step("VALIDATE", "✓", "STRUCTURE OK");
    } catch (err: any) {
      log.step("VALIDATE", "✗", "STRUCTURE FAIL");
      return { valid: false, reason: `Structure violation: ${err.message}` };
    }
  }

  // E7 — Consistency Engine (Contract Validation)
  try {
    const snapshot = loadSnapshot(projectDir);
    validateContracts({ path: step.target, content: fileUpdate.content, role: step.role }, snapshot);
    log.step("CONSISTENCY", "✓", "CONTRACT OK");
  } catch (err: any) {
    // E8 — Intent Engine (Intent-Driven Override)
    if (step.intent && intentAllowsContractBreak(step.intent)) {
      log.step("CONSISTENCY", "⚠", "CONTRACT_BREAK_ALLOWED_BY_INTENT");
    } else {
      log.step("CONSISTENCY", "✗", "CONTRACT MISMATCH");
      // Explicitly mark failure to prevent patch application
      return { valid: false, reason: "CONTRACT_MISMATCH_PREVENTED: Mismatch detected before patch." };
    }
  }

  // E8 — Intent Engine (Minimal Change Enforcer)
  if (step.intent) {
    const fullPath = join(projectDir, step.target);
    let oldContent = "";
    if (existsSync(fullPath)) {
      oldContent = readFileSync(fullPath, "utf-8");
    }
    const sizeValidation = validateChangeSize(oldContent, fileUpdate.content, step.intent);
    if (!sizeValidation.valid) {
      log.step("INTENT", "✗", "OVER_MODIFICATION");
      return { valid: false, reason: sizeValidation.reason };
    }
  }

  // E4 — Behavior Validation
  // Only run if step explicitly asks for it or it's a critical module
  if (step.type === "modify" || step.type === "create") {
    // E4: Generate test-case for validation
    const testMatch = (step as any).testCode;
    if (testMatch) {
       log.step("TEST", "running...");
       
       const config = loadConfig();
       const { loadStack } = await import("./loadStack.js");
       const stack = await loadStack(config.stack || "node-basic");
       
       const result = stack.testRunner ? stack.testRunner(testMatch) : await runTest(projectDir, testMatch, step.target);
       
       if (!result.success) {
         log.step("TEST", "✗", "FAIL");
         const summary = summarizeFailure(result.output || "Test failed");
         return { valid: false, reason: `Tests failed: ${summary}` };
       }
       log.step("TEST", "✓", "PASS");
    }
  }

  return { valid: true };
}

async function executeStep(step: Step, index: number, opts: AgentOptions, chain: any, { onToken, rl, metrics }: any = {}) {
  const { projectDir, dryRun, autoMode, task } = opts;
  const stepStart = Date.now();
  const mode = dryRun ? "dry" : autoMode ? "auto" : "normal";
  const tier = detectTier();

  // E8 — Intent Engine (Intent Target Guarantee)
  if (step.intent && step.intent.scope === 'file' && !step.intent.target) {
    step.intent.target = step.target;
  }

  // Track state.json
  const statePath = join(projectDir, ".xentari", "state.json");
  const updateState = (status: string) => {
    try {
      const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf-8")) : { steps: {} };
      state.current_step = step.id;
      state.steps = state.steps || {};
      state.steps[step.id] = { status, timestamp: new Date().toISOString() };
      writeFileSync(statePath, JSON.stringify(state, null, 2));
    } catch {}
  };

  updateState("running");

  // Fix 3: Cascade Failure Halt
  if (executionState.failed || chain.hasFailure) {
    log.step("STEP", "✗", "CASCADE_BLOCKED");
    updateState("failed");
    throw new Error("CASCADE_ABORT: Previous step failed");
  }

  // Fix 2: Invalid Plan Step Guard
  if (!step.files?.length && !(step as any).filePath) {
    // If target looks like a file path (has a dot) or is explicitly a file-acting type
    const isFileActingType = ["create", "modify", "refactor", "verify"].includes(step.type);
    const looksLikeFilePath = step.target && step.target.includes('.');

    if (step.target && (isFileActingType || looksLikeFilePath)) {
      log.info(`[EXECUTOR] Inferring file path from target: ${step.target}`);
      step.files = [step.target];
      (step as any).filePath = step.target;
    } else if (step.type === 'plan' || step.type === 'analyze') {
      log.info(`[EXECUTOR] Step ${step.id} is informational (${step.type}). Marking done.`);
      updateState("done");
      return; // Skip the file-acting parts
    } else {
      log.step("STEP", "✗", "INVALID_PLAN_STEP");
      executionState.failed = true;
      updateState("failed");
      throw new Error(`INVALID_PLAN_STEP: Step ${step.id} has no target files for type ${step.type}`);
    }
  }

  resetFailureState();

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

  let files: any[] = [];
  log.step("RETRIEVE", "...");
  ux.showStage("RETRIEVE");
  
  // E5 — Context Engine (Deterministic Retrieval)
  try {
     const bundle = selectContext(step.target, projectDir);
     files = [{ file: step.target, content: bundle.target, score: 1.0 }];
     
     // E7 — Consistency Engine (Stale Context Check)
     const snapshot = loadSnapshot(projectDir);
     if (snapshot.files[step.target]) {
       try {
         checkStale(step.target, bundle.target, snapshot.files[step.target].hash);
       } catch (err: any) {
         log.step("CONTEXT", "⚠", "STALE_DETECTION");
         // Auto-update snapshot if stale context is detected but target is same
         updateSnapshotAfterStep(projectDir, step.target, bundle.target);
       }
     }

     log.step("RETRIEVE", "✓", "DETERMINISTIC OK");
  } catch (err: any) {
    log.step("RETRIEVE", "✗", "FALLBACK TO LEGACY");
    const keywords = [...(step.files || []), ...step.target.split(/\s+/)];
    files = await retrieve(projectDir, keywords, chain?.modifiedFiles || [], { metrics });
  }

  let attempt = 1;
  let feedback = null;
  const maxAttempts = (opts.autoMode && process.env.XEN_ALLOW_RETRIES === "true") ? 2 : 1;

  while (attempt <= maxAttempts) { // E1 — Stability (Retry Rule)
    try {
      ux.showStage("CODE");
      const taskInstruction = typeof (step as any).description === 'string' && (step as any).description.length > 0 
        ? `${(step as any).description}\nConstraints: ${((step as any).constraints || []).join(', ')}`
        : step.target;

      // E7 — Consistency Engine (Snapshot Awareness)
      const snapshot = loadSnapshot(projectDir);

      const fileUpdates = await generateWithRetry(taskInstruction, files, feedback, chain, 1, { 
        onToken, 
        metrics, 
        role: step.role, 
        pattern: step.pattern,
        projectDir,
        systemSnapshot: snapshot,
        intent: step.intent // E8
      });

      if (!fileUpdates || fileUpdates.length === 0) throw new Error("EMPTY_OUTPUT");
      
      const update = fileUpdates[0];
      if (update.file && update.file !== step.target) {
         log.step("CODE", "✗", "TARGET_VIOLATION");
         throw new Error("TARGET_DEVIATION");
      }

      log.step("VALIDATE", "...");
      // E10: Use stack validator
      const validation = stack.validator ? stack.validator(update.content) : await validateStep(projectDir, step, update);
      if (!validation.valid) {
        log.step("VALIDATE", "✗", validation.reason);
        
        // E9 — Feedback Engine (Log validation failure)
        logFailure(projectDir, step.target, validation.reason!, step.intent);

        feedback = `Validation failed: ${validation.reason}. Please fix and return full file.`;
        attempt++;
        if (attempt > 2) throw new Error(`Step validation failed after retry: ${validation.reason}`);
        log.step("RETRY", `attempt 2/2 (fix validation)`);
        continue;
      }

      // If valid, apply
      log.step("DIFF", "ready");
      const patch = patchToUnified(projectDir, [{ file: step.target, content: update.content }]);
      log.patch(patch, step.target);

      const autoApprove = process.env.XEN_AUTO_APPROVE === "true" || opts.autoMode;
      const approved = autoApprove || await confirm("  Apply changes?");
      
      if (!approved) {
        log.step("PATCH", "✗", "rejected by user");
        updateState("failed");
        chain.hasFailure = true;
        return;
      }

      log.step("PATCH", "applying...");
      let result = await applyPatch(projectDir, patch, false, update.content);
      if (result.applied) {
        log.step("PATCH", "✓");
        executionState.anyPatchApplied = true;
        chain.modifiedFiles.push(step.target);
        
        // E7 — Consistency Engine (Post-Step Snapshot Update)
        updateSnapshotAfterStep(projectDir, step.target, update.content);
        
        updateState("done");
        return;
      } else {
        log.step("PATCH", "✗", result.reason);
        executionState.failed = true;
        throw new Error(result.reason!);
      }
    } catch (err: any) {
      // E9 — Feedback Engine (Log execution failure)
      logFailure(projectDir, step.target, err.message, step.intent);

      if (attempt >= 2) {
        log.step("STEP", "✗", `FAILED: ${err.message}`);
        executionState.failed = true;
        updateState("failed");
        chain.hasFailure = true; // Block cascade
        throw err;
      }
      feedback = `Execution failed: ${err.message}. Fix and try again.`;
      attempt++;
      log.step("RETRY", `attempt 2/2 (execution error)`);
    }
  }
}


async function executePipeline(opts: AgentOptions, { onToken, rl }: any = {}) {
  const { task, projectDir, dryRun, autoMode } = opts;

  // Reset execution state
  executionState.anyPatchApplied = false;
  executionState.failed = false;

  const config = loadConfig();
  
  // Load Stack
  const stack = await loadStack(config.stack || "node-basic");
  if (!stack) throw new Error("CRITICAL: Failed to load stack");

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

  // E7 — Consistency Engine (Initialize Snapshot)
  const snapshot = loadSnapshot(projectDir);
  const index = loadIndex(projectDir);
  if (index && Object.keys(snapshot.files).length === 0) {
    log.info("[EXECUTOR] Snapshot missing. Capturing initial system state...");
    index.files.forEach((f: any) => {
      try {
        const fullPath = join(projectDir, f.file);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, "utf-8");
          snapshot.files[f.file] = captureFileSnapshot(f.file, content);
        }
      } catch {}
    });
    saveSnapshot(projectDir, snapshot);
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
  
  // Fix 2: Invalid Plan Step Guard
  validatePlan(steps);

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
      // E6 — Multi-File Orchestration (Step execution)
      await executeStep(step, j, opts, chain, { onToken, rl, metrics });
    } catch (err: any) {
      log.step("STEP", "✗", `FAILED: ${err.message}`);
      log.error("CASCADE_ABORT", `Execution halted due to step failure: ${err.message}`, "The system will not proceed with subsequent steps to avoid inconsistent state.");
      executionState.failed = true;
      break; 
    }
  }
const totalMs = elapsed(totalStart);
const timeSec = (totalMs / 1000).toFixed(2);

// Fix 1: Finalize Execution Success Detection
if (executionState.anyPatchApplied) {
  log.summary({
    changes: chain.modifiedFiles.map(f => ({ path: f, type: "updated" })),
    added: chain.patchSummaries.reduce((acc, s) => acc + (s.match(/\+/g) || []).length, 0),
    removed: chain.patchSummaries.reduce((acc, s) => acc + (s.match(/-/g) || []).length, 0),
    time: timeSec
  });
} else if (executionState.failed) {
  // If we failed but didn't apply any patch, it's a hard fail
  log.error("TASK_FAILED", "Execution failed and no changes were applied.", "Check previous errors for details.");
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
