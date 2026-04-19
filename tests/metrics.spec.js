import { runTest } from "./testRunner.js";
import { normalizeMetrics } from "../core/llm/metrics.js";

(async () => {

await runTest("Normalize llama.cpp format", async () => {
  const m = normalizeMetrics({
    eval_count: 50,
    eval_rate: 20,
    total_duration: 2500,
    provider: "llama.cpp"
  });

  if (m.completionTokens !== 50) {
    throw new Error(`Incorrect normalization: completionTokens expected 50, got ${m.completionTokens}`);
  }
  if (m.tokensPerSecond !== 20) {
    throw new Error(`Incorrect normalization: tokensPerSecond expected 20, got ${m.tokensPerSecond}`);
  }
});

await runTest("Normalize OpenAI format", async () => {
  const m = normalizeMetrics({
    usage: {
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30
    },
    provider: "openai"
  });

  if (m.totalTokens !== 30) {
    throw new Error(`Incorrect normalization: totalTokens expected 30, got ${m.totalTokens}`);
  }
});

await runTest("Graceful fallback", async () => {
  const m = normalizeMetrics({});

  if (m.totalTokens !== null) {
    throw new Error(`Fallback failed: totalTokens expected null, got ${m.totalTokens}`);
  }
  if (m.provider !== "unknown") {
    throw new Error(`Fallback failed: provider expected unknown, got ${m.provider}`);
  }
});

})();
