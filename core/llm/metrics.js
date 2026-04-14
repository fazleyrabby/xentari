export function normalizeMetrics(raw = {}) {
  return {
    promptTokens:
      raw.prompt_eval_count ??
      raw.prompt_tokens ??
      raw.usage?.prompt_tokens ??
      null,

    completionTokens:
      raw.eval_count ??
      raw.completion_tokens ??
      raw.usage?.completion_tokens ??
      null,

    totalTokens:
      raw.total_tokens ??
      raw.usage?.total_tokens ??
      null,

    tokensPerSecond:
      raw.eval_rate ??
      raw.tokens_per_second ??
      null,

    latencyMs:
      raw.total_duration ??
      raw.latency ??
      null,

    provider:
      raw.provider ?? "unknown"
  };
}
