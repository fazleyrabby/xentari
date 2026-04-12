import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { log } from "./logger.js";
function analyticsPath() {
    return join(loadConfig().logsDir, "analytics.json");
}
function loadAnalytics() {
    const p = analyticsPath();
    if (!existsSync(p))
        return { history: [] };
    try {
        return JSON.parse(readFileSync(p, "utf-8"));
    }
    catch {
        return { history: [] };
    }
}
function saveAnalytics(data) {
    const config = loadConfig();
    mkdirSync(config.logsDir, { recursive: true });
    writeFileSync(analyticsPath(), JSON.stringify(data, null, 2), "utf-8");
}
export function logBug(bug) {
    const config = loadConfig();
    const path = join(config.logsDir, "bugs.json");
    let bugs = [];
    if (existsSync(path)) {
        try {
            bugs = JSON.parse(readFileSync(path, "utf-8"));
        }
        catch { }
    }
    bugs.push({
        ...bug,
        timestamp: new Date().toISOString()
    });
    // Keep last 50
    if (bugs.length > 50)
        bugs = bugs.slice(-50);
    mkdirSync(config.logsDir, { recursive: true });
    writeFileSync(path, JSON.stringify(bugs, null, 2), "utf-8");
}
export function recordTestResult(entry) {
    const data = loadAnalytics();
    data.history.push({
        ...entry,
        timestamp: new Date().toISOString()
    });
    // Keep last 100 entries
    if (data.history.length > 100)
        data.history = data.history.slice(-100);
    saveAnalytics(data);
}
export function generateWeeklyInsights() {
    const data = loadAnalytics();
    if (data.history.length === 0)
        return null;
    const total = data.history.length;
    const successes = data.history.filter(h => h.status === "success").length;
    const failureTypes = {};
    data.history.filter(h => h.status === "fail").forEach(h => {
        const type = h.failType || "unknown";
        failureTypes[type] = (failureTypes[type] || 0) + 1;
    });
    const topFailure = Object.entries(failureTypes).sort((a, b) => b[1] - a[1])[0];
    return {
        successRate: ((successes / total) * 100).toFixed(1) + "%",
        totalTasks: total,
        topFailureType: topFailure ? topFailure[0] : "none",
        averageRetries: (data.history.reduce((acc, h) => acc + (h.retries || 0), 0) / total).toFixed(1)
    };
}
export function showWeeklyAnalysis() {
    const insights = generateWeeklyInsights();
    if (!insights)
        return;
    log.section("📊 SYSTEM INSIGHTS");
    console.log(`  Success Rate: ${insights.successRate}`);
    console.log(`  Total Tasks:  ${insights.totalTasks}`);
    console.log(`  Avg Retries:  ${insights.averageRetries}`);
    console.log(`  Top Failure:  ${insights.topFailureType}`);
}
// Alias for UI consumption
export function loadSummary() {
    return generateWeeklyInsights();
}
