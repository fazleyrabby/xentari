import { log } from "../logger.js";

/**
 * Deterministic failure simulation for testing stability.
 */
export function simulateFailure(type) {
  log.warn(`[SIMULATION] Injecting failure: ${type}`);
  
  switch (type) {
    case "MISSING_FILE":
      // This will be caught by the patcher recovery flow
      throw new Error("error: simulFile.js: No such file or directory");

    case "INVALID_OUTPUT":
      return { content: "", error: "malformed_output" };

    case "RETRIEVAL_FAIL":
      return { files: [], error: "no_files_found" };

    case "PATCH_FAILURE":
      return { patch: "invalid diff data", error: "corrupt_patch" };

    case "DIRECTORY_MISSING":
      throw new Error("ENOENT: no such file or directory, mkdir 'nested/path'");

    case "PERMISSION_FAILURE":
      throw new Error("EACCES: permission denied, write");

    case "PARTIAL_OUTPUT":
       return { content: "function partial() {", error: "truncated_code" };

    case "MARKDOWN_OUTPUT":
      return { content: "```javascript\nconsole.log('leaked markdown');\n```" };

    case "EMPTY_OUTPUT":
      return { content: "" };

    case "RAW_DIFF":
      return { content: "diff --git a/app.js b/app.js\n--- a/app.js\n+++ b/b/app.js\n@@ -1,1 +1,2 @@\n+const leakedDiff = true;" };

    default:
      log.info(`[SIMULATION] No failure injected for type: ${type}`);

  }
}
