import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { log } from "../logger.js";

/**
 * 🧠 XENTARI — E9 — Feedback Engine
 */

export type FailureType = "CONSISTENCY" | "BEHAVIOR" | "OUTPUT" | "CONTEXT" | "INFRA" | "UNKNOWN";

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
  
  // Infrastructure issues should not trigger adaptations
  if (upper.includes("MODULE_NOT_FOUND")) return "INFRA";

  // Specific output issues first
  if (upper.includes("TRUNCATION") || upper.includes("BRACES") || upper.includes("EMPTY_OUTPUT") || upper.includes("SYNTAX")) return "OUTPUT";
  
  // Specific context issues
  if (upper.includes("CONTEXT") || upper.includes("STALE") || upper.includes("RETRIEVAL")) return "CONTEXT";

  // Specific behavior/test issues
  if (upper.includes("TEST") || upper.includes("ASSERTION")) return "BEHAVIOR";

  // General consistency/contract issues
  if (upper.includes("CONTRACT") || upper.includes("MISMATCH")) return "CONSISTENCY";
  
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

  if (type === "INFRA") {
    log.warn(`[FEEDBACK] Infrastructure failure detected: ${error}. Skipping adaptation.`);
    return;
  }

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
⚠️ PREVIOUS FAILURE DETECTED (E9 — Feedback Engine)
==================================================
The system recorded a previous failure for this step:
- Error: ${mostCommon}
- Total Failures for this step: ${pattern.count}

Ensure that your implementation explicitly handles this issue to avoid repetition.
`;
}

/**
 * 5. ADAPTIVE RULES (E9 — Feedback Engine)
 */
export type AdaptiveRules = {
  strictContracts: boolean;
  strictTests: boolean;
  strictOutput: boolean;
  smallContext: boolean;
};

export function getAdaptiveRules(projectDir: string, step: string): AdaptiveRules {
  const data = loadFeedback(projectDir);
  const pattern = data.patterns[step];
  
  const rules: AdaptiveRules = {
    strictContracts: false,
    strictTests: false,
    strictOutput: false,
    smallContext: false
  };

  if (!pattern || pattern.count === 0) return rules;

  // Filter failures for this specific step/file
  const stepFailures = data.failures.filter(f => f.step === step);
  
  // Count by type
  const counts = stepFailures.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Trigger adaptation if more than one failure of the same type occurs
  if ((counts["CONSISTENCY"] || 0) > 1) rules.strictContracts = true;
  if ((counts["BEHAVIOR"] || 0) > 1) rules.strictTests = true;
  if ((counts["OUTPUT"] || 0) > 1) rules.strictOutput = true;
  if ((counts["CONTEXT"] || 0) > 1) rules.smallContext = true;

  if (rules.strictContracts) log.info(`[FEEDBACK] Adaptation: STRENGTHEN_CONTRACT_VALIDATION for ${step}`);
  if (rules.strictTests) log.info(`[FEEDBACK] Adaptation: INCREASE_TEST_STRICTNESS for ${step}`);
  if (rules.strictOutput) log.info(`[FEEDBACK] Adaptation: TIGHTEN_OUTPUT_VALIDATION for ${step}`);
  if (rules.smallContext) log.info(`[FEEDBACK] Adaptation: REDUCE_CONTEXT_SIZE for ${step}`);

  return rules;
}
