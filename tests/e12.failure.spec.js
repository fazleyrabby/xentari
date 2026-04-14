import { runTest } from "./testRunner.js";
import { classifyFailure } from "../core/execution/failureClassifier.js";
import { handleFailure } from "../core/execution/retryEngine.js";

(async () => {

await runTest("FAILURE: classify code error", async () => {
  const res = classifyFailure({ error: "syntax error" });

  if (res.type !== "CODE") {
    throw new Error(`Expected CODE, got ${res.type}`);
  }
  if (!res.retry) {
    throw new Error("CODE failure should be retryable");
  }
});

await runTest("FAILURE: classify environment error", async () => {
  const res = classifyFailure({ error: "command not found" });

  if (res.type !== "ENVIRONMENT") {
    throw new Error(`Expected ENVIRONMENT, got ${res.type}`);
  }
  if (res.retry) {
    throw new Error("ENVIRONMENT failure should not be retryable");
  }
});

await runTest("RETRY: triggers retry", async () => {
  const step = { command: "bad-cmd", retries: 0 };

  const decision = await handleFailure(step, { error: "syntax error" });

  if (decision.status !== "RETRY") {
    throw new Error(`Expected RETRY, got ${decision.status}`);
  }
});

await runTest("RETRY: stops after max retries", async () => {
  const step = { command: "bad-cmd", retries: 2 };

  const decision = await handleFailure(step, { error: "syntax error" });

  if (decision.status !== "FAILED_MAX_RETRIES") {
    throw new Error(`Expected FAILED_MAX_RETRIES, got ${decision.status}`);
  }
});

})();
