/**
 * Metrics store for Zentari execution.
 * Tracks tokens, time, and other performance data.
 */

export function createMetrics() {
  return {
    tokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    startTime: Date.now(),
    duration: 0,
    filesUsed: 0,
    retries: 0,
    model: "",
    tier: "",
    cost: 0,
    cacheHits: 0,
    parallelSteps: 0,
    files: [] // Track specific file names used
  };
}

export function updateDuration(metrics) {
  metrics.duration = Date.now() - metrics.startTime;
}
