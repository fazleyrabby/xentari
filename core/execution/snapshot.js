import fs from "node:fs";

/**
 * E15 — Execution Snapshot System
 * Persists execution state for post-mortem analysis.
 */
export function saveSnapshot(step, context, result) {
  const snapshot = {
    step: {
      command: step.command,
      retries: step.retries
    },
    context: {
      stack: context.stack
    },
    result: {
      success: result.success,
      error: result.error || null,
      code: result.code || null
    },
    timestamp: Date.now()
  };

  try {
    if (!fs.existsSync(".xentari")) {
      fs.mkdirSync(".xentari");
    }
    
    fs.appendFileSync(
      ".xentari/snapshots.log",
      JSON.stringify(snapshot) + "\n"
    );
  } catch (err) {
    console.error(`[SNAPSHOT ERROR] ${err.message}`);
  }
}
