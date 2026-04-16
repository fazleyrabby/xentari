import { classifyFailure } from "./failureClassifier.js";

/**
 * E12 — Retry Intelligence Engine
 * Decides whether to retry a failed execution step.
 */
export async function handleFailure(step, result, context) {
  const classification = classifyFailure(result);

  if (!classification.retry) {
    return {
      status: "FAILED",
      classification
    };
  }

  // Max 2 retries (0, 1, 2 = total 3 attempts)
  if (step.retries >= 2) {
    return {
      status: "FAILED_MAX_RETRIES",
      classification
    };
  }

  return {
    status: "RETRY",
    classification
  };
}
