import { detectTier } from "../tier.js";
import { generatePatch as generatePatchCore } from "../coder.js";
import { log } from "../logger.js";

export async function generateFileContent(step, files, feedback, chainContext) {
  const tier = detectTier();

  try {
    const fileUpdates = await generatePatchCore(step, files, feedback, chainContext);

    if (!fileUpdates || fileUpdates.length === 0) {
      throw new Error("No file content generated");
    }

    if (tier === "small" && fileUpdates.length > 1) {
      fileUpdates.length = 1;
    }

    const result = fileUpdates[0];

    if (!result.file) {
      throw new Error("Missing file path in generated content");
    }

    if (!result.content || result.content.trim().length === 0) {
      throw new Error("Empty file content generated");
    }

    return {
      filePath: result.file,
      content: result.content,
    };
  } catch (err) {
    throw err;
  }
}

export async function generateWithRetry(step, files, feedback, chainContext, maxRetries = 2) {
  const tier = detectTier();
  const retries = tier === "small" ? 2 : tier === "medium" ? 3 : 4;
  const actualRetries = Math.min(retries, maxRetries);

  let lastError = null;

  for (let attempt = 1; attempt <= actualRetries; attempt++) {
    try {
      return await generateFileContent(step, files, feedback, chainContext);
    } catch (err) {
      lastError = err;
      log.warn(`[CODER] Attempt ${attempt}/${actualRetries} failed: ${err.message}`);

      if (attempt < actualRetries) {
        if (tier === "small") {
          feedback = `Previous attempt failed: ${err.message}. Keep it extremely simple. One file, minimal changes.`;
        } else {
          feedback = `Previous attempt failed: ${err.message}. Fix the issue and try again.`;
        }
      }
    }
  }

  throw lastError || new Error("All retries failed");
}