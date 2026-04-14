export function normalizeMetrics(raw = {}) {
  const promptTokens =
    raw.prompt_eval_count ??
    raw.prompt_tokens ??
    raw.usage?.prompt_tokens ??
    raw.input_tokens ??
    0;

  const completionTokens =
    raw.eval_count ??
    raw.completion_tokens ??
    raw.usage?.completion_tokens ??
    raw.output_tokens ??
    0;

  const totalTokens =
    raw.total_tokens ??
    raw.usage?.total_tokens ??
    (promptTokens + completionTokens);

  const tokensPerSecond =
    raw.eval_rate ??
    raw.tokens_per_second ??
    raw.tps ??
    null;

  const latencyMs =
    raw.total_duration ??
    raw.latency ??
    raw.latency_ms ??
    raw.duration ??
    null;

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerSecond: (tokensPerSecond && isFinite(tokensPerSecond)) ? Math.round(tokensPerSecond) : null,
    latencyMs: (latencyMs && isFinite(latencyMs)) ? Math.round(latencyMs) : null,
    provider: raw.provider || "unknown"
  };
}
