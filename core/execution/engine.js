import { safeExec } from "./safeExec.js";
import { handleFailure } from "./retryEngine.js";
import * as ui from "../ui/state.js";

/**
 * E12 — Self-Correcting Execution Engine
 * Iterates through a plan, manages retries, and updates UI state.
 */
export async function executionLoop(plan, context = {}) {
  // E12 — Plan Validation Gate
  if (!plan || !Array.isArray(plan.steps)) {
    ui.setStatus({ text: "VALIDATION FAILURE", errors: 1 });
    return { status: "FAILED", reason: "INVALID_PLAN" };
  }

  for (const step of plan.steps) {
    if (!step || !step.command) {
      ui.setStatus({ text: "VALIDATION FAILURE", errors: 1 });
      return { status: "FAILED", reason: "MALFORMED_STEP" };
    }
  }

  ui.setStatus({ text: "RUNNING", errors: 0 });

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    step.retries = step.retries || 0;

    ui.addAction({
      type: "RUN",
      target: step.command,
      icon: "▶"
    });

    const result = await safeExec({
      command: step.command,
      reason: step.reason || "System execution",
      stack: step.stack || context.stack || "node"
    });

    if (!result.success) {
      const decision = await handleFailure(step, result, context);

      ui.addAction({
        type: "FAIL",
        target: decision.classification.type,
        icon: "✖"
      });

      if (decision.status === "RETRY") {
        step.retries++;

        ui.addAction({
          type: "RETRY",
          target: step.command,
          icon: "↻"
        });

        // Repeat this step
        i--;
        continue;
      }

      ui.setStatus({ text: `FAILED: ${decision.classification.type}`, errors: 1 });
      return {
        status: "FAILED",
        reason: decision.classification.type,
        result
      };
    }

    ui.addAction({
      type: "SUCCESS",
      target: step.command,
      icon: "✔"
    });
  }

  ui.setStatus({ text: "SUCCESS", errors: 0 });
  return { status: "SUCCESS" };
}
