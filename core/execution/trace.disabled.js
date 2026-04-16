/**
 * E15 — Debug Trace Layer
 * In-memory buffer for high-frequency observability.
 */

const trace = [];

export function addTrace(entry) {
  trace.push({
    ...entry,
    time: Date.now()
  });

  // Maintain circular buffer to prevent memory leakage
  if (trace.length > 50) {
    trace.shift();
  }
}

export function getTrace() {
  return [...trace];
}

export function clearTrace() {
  trace.length = 0;
}
