import { detectTier } from "../tier.js";
import { generatePatch as generatePatchCore } from "../coder.js";
import { log } from "../logger.js";

export async function generateFileContent(step, files, feedback, chainContext, { onToken, metrics, role, pattern, projectDir, systemSnapshot } = {}) {
  const tier = detectTier();
  return generatePatchCore(step, files, feedback, chainContext, { onToken, metrics, role, pattern, projectDir, systemSnapshot });
}

export async function generateWithRetry(step, files, feedback, chainContext, maxAttempts, { onToken, metrics, role, pattern, projectDir, systemSnapshot } = {}) {
  let lastError;
  const tier = detectTier();
  const MAX_RETRY_ATTEMPTS = 2; // Loop breaker for validation failures

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        log.warn(`[CODER] Retry attempt ${attempt}/${maxAttempts}...`);
        if (metrics) metrics.retries++;
      }

      const fileUpdates = await generateFileContent(step, files, feedback, chainContext, { onToken, metrics, role, pattern, projectDir, systemSnapshot });
      return fileUpdates;
...
    } catch (err) {
      lastError = err;
      log.error(`[CODER] Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
      
      if (attempt < maxAttempts) {
        if (err.message.includes("validation")) {
          feedback = `Previous output was invalid: ${err.message}. Please follow the STRICT RULES and output ONLY the complete file content.`;
        } else if (err.message.includes("too large")) {
          feedback = `Previous output was too large. Please provide a more concise implementation or modify only the necessary parts.`;
        } else if (tier === "small") {
          feedback = `Previous attempt failed: ${err.message}. Please provide a corrected version. One file, minimal changes.`;
        } else {
          feedback = `Previous attempt failed: ${err.message}. Fix the issue and try again.`;
        }
      }
    }
  }

  throw lastError || new Error("All retries failed");
}
