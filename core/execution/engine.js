import { safeExec } from "./safeExec.js";

/**
 * E11 — Execution Engine Orchestrator
 * Iterates through a plan and executes commands safely.
 */
export async function executionLoop(plan, options = {}) {
  const results = [];
  
  for (const step of plan.steps) {
    const res = await safeExec({
      command: step.command,
      reason: step.description || "System execution",
      stack: options.stack || "node"
    });
    
    results.push(res);
    
    if (!res.success) {
      return { status: "FAILED", results };
    }
  }
  
  return { status: "SUCCESS", results };
}
