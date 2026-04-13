import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { log } from "../logger.js";

/**
 * 🧠 XENTARI — PHASE 10: FEEDBACK ENGINE
 */

export type FailureType = "CONSISTENCY" | "BEHAVIOR" | "OUTPUT" | "CONTEXT" | "UNKNOWN";

export type FailureEntry = {
  step: string;
  type: FailureType;
  error: string;
  intent?: any;
  timestamp: number;
};

export type FeedbackData = {
  failures: FailureEntry[];
  patterns: Record<string, { count: number; issues: Record<string, number> }>;
};

/**
 * 1. FAILURE CLASSIFIER
 */
export function classifyFailure(error: string): FailureType {
  const upper = error.toUpperCase();
  if (upper.includes("CONTRACT") || upper.includes("MISMATCH")) return "CONSISTENCY";
  if (upper.includes("TEST") || upper.includes("ASSERTION")) return "BEHAVIOR";
  if (upper.includes("TRUNCATION") || upper.includes("BRACES") || upper.includes("EMPTY_OUTPUT")) return "OUTPUT";
  if (upper.includes("CONTEXT") || upper.includes("STALE") || upper.includes("RETRIEVAL")) return "CONTEXT";
  return "UNKNOWN";
}

/**
 * 2. LOAD/SAVE FEEDBACK
 */
export function loadFeedback(projectDir: string): FeedbackData {
  const path = join(projectDir, ".xentari", "feedback.json");
  if (!existsSync(path)) {
    return { failures: [], patterns: {} };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { failures: [], patterns: {} };
  }
}

export function saveFeedback(projectDir: string, data: FeedbackData) {
  const xentariDir = join(projectDir, ".xentari");
  if (!existsSync(xentariDir)) mkdirSync(xentariDir, { recursive: true });
  
  const path = join(xentariDir, "feedback.json");
  writeFileSync(path, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * 3. FAILURE LOGGER
 */
export function logFailure(projectDir: string, step: string, error: string, intent?: any) {
  const data = loadFeedback(projectDir);
  
  const type = classifyFailure(error);
  const entry: FailureEntry = {
    step,
    type,
    error,
    intent,
    timestamp: Date.now()
  };

  data.failures.push(entry);
  
  // Keep last 50 failures
  if (data.failures.length > 50) data.failures.shift();

  // Update patterns
  if (!data.patterns[step]) {
    data.patterns[step] = { count: 0, issues: {} };
  }
  
  data.patterns[step].count++;
  data.patterns[step].issues[error] = (data.patterns[step].issues[error] || 0) + 1;

  saveFeedback(projectDir, data);
  log.info(`[FEEDBACK] Logged ${type} failure for ${step}`);
}

/**
 * 4. FEEDBACK INJECTION
 */
export function getFeedbackForStep(projectDir: string, step: string): string {
  const data = loadFeedback(projectDir);
  const pattern = data.patterns[step];

  if (!pattern || pattern.count === 0) return "";

  const mostCommon = Object.keys(pattern.issues)
    .sort((a, b) => pattern.issues[b] - pattern.issues[a])[0];

  return `
==================================================
⚠️ PREVIOUS FAILURE DETECTED (PHASE 10)
==================================================
The system recorded a previous failure for this step:
- Error: ${mostCommon}
- Total Failures for this step: ${pattern.count}

Ensure that your implementation explicitly handles this issue to avoid repetition.
`;
}
