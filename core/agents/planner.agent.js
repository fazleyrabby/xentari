import { loadConfig } from "../config.js";
import { loadStack } from "../loadStack.js";
import { log } from "../logger.js";

/**
 * Core Planner Proxy.
 * Delegates planning to the stack-specific planner.
 */
export async function plan(task, { metrics, projectDir } = {}) {
  const config = loadConfig();
  const stack = await loadStack(config.stack || "node-basic");

  if (!stack || !stack.planner || !stack.planner.generatePlan) {
    log.error("[PLANNER] INVALID_STACK_ADAPTER: Missing planner");
    throw new Error("INVALID_STACK_ADAPTER: Missing planner");
  }

  log.info(`[PLANNER] Delegating to stack: ${config.stack || "node-basic"}`);

  // E10: Fully stack-controlled planning
  const steps = await stack.planner.generatePlan({
    instruction: task,
    context: "", // Base context is handled within the stack's planner
    metrics,
    projectDir
  });

  // Basic validation of plan structure
  if (!Array.isArray(steps)) {
    throw new Error("INVALID_PLAN: Planner did not return an array of steps");
  }

  for (const step of steps) {
    if (!step.target) throw new Error("INVALID_PLAN_STEP: Missing target");
    if (!step.type) throw new Error("INVALID_PLAN_STEP: Missing type");
  }

  return steps;
}
