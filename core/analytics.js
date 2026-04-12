/**
 * Bug Classification System for Zentari.
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";

/**
 * Logs a bug/failure with classification.
 * @param {Object} bug - { task, type, severity, description, fix_area }
 */
export function logBug(bug) {
  const config = loadConfig();
  const bugsPath = join(config.logsDir, "bugs.json");
  
  let bugs = [];
  if (existsSync(bugsPath)) {
    try {
      bugs = JSON.parse(readFileSync(bugsPath, "utf-8"));
    } catch {}
  }

  const entry = {
    ...bug,
    timestamp: new Date().toISOString()
  };

  bugs.push(entry);
  writeFileSync(bugsPath, JSON.stringify(bugs, null, 2));
}

/**
 * Records a test result for the dashboard and scoring.
 * @param {Object} result - { task, status, retries, tokens, time_ms }
 */
export function recordTestResult(result) {
  const config = loadConfig();
  const testingPath = join(config.logsDir, "testing.json");

  let data = [];
  if (existsSync(testingPath)) {
    try {
      const content = readFileSync(testingPath, "utf-8");
      data = JSON.parse(content || "[]");
    } catch {
      data = [];
    }
  }

  data.push({
    ...result,
    timestamp: new Date().toISOString()
  });

  writeFileSync(testingPath, JSON.stringify(data, null, 2));
}

/**
 * Scoring System
 */
export function loadSummary() {
  const config = loadConfig();
  const testingPath = join(config.logsDir, "testing.json");

  if (!existsSync(testingPath)) return null;

  try {
    const data = JSON.parse(readFileSync(testingPath, "utf-8"));
    if (data.length === 0) return null;

    const total = data.length;
    const success = data.filter(x => x.status === "success").length;
    const avgTime = data.reduce((a, b) => a + (b.time_ms || 0), 0) / total / 1000;

    return {
      totalTasks: total,
      successRate: success / total,
      avgTime: avgTime.toFixed(2),
      patchSuccess: success / total
    };
  } catch {
    return null;
  }
}
