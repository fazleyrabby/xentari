import { appendFileSync, mkdirSync } from "node:fs";
import { loadConfig } from "./config.js";
import { detectTier } from "./tier.js";
const C = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    bold: "\x1b[1m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
};
const LINE = `${C.dim}${"─".repeat(60)}${C.reset}`;
function fmt(color, label, msg) {
    return `${C[color]}${label}${C.reset} ${msg}`;
}
export const log = {
    // Section headers matching spec: [PLAN] [STEP] [PATCH] [REVIEW] [RESULT]
    section(name) {
        console.log(`\n${C.bold}${C.cyan}[${name}]${C.reset}`);
    },
    step(n, msg) {
        console.log(`\n${C.bold}${C.cyan}[STEP ${n}]${C.reset} ${msg}`);
    },
    info(msg) {
        console.log(fmt("dim", "  ›", msg));
    },
    ok(msg) {
        console.log(fmt("green", "  ✓", msg));
    },
    warn(msg) {
        console.log(fmt("yellow", "  ⚠", msg));
    },
    error(msg) {
        console.error(fmt("red", "  ✗", msg));
    },
    patch(content) {
        console.log(`\n${C.bold}${C.magenta}[PATCH PREVIEW]${C.reset}`);
        console.log(LINE);
        console.log(content);
        console.log(LINE);
    },
    header(msg) {
        console.log(`\n${C.bold}${C.cyan}=> ${msg}${C.reset}`);
    },
    result(msg) {
        console.log(`\n${C.bold}${C.green}[RESULT]${C.reset} ${msg}`);
    },
};
// Append structured JSON entry to logs/xen.log
export function logToFile(entry) {
    try {
        const config = loadConfig();
        mkdirSync(config.logsDir, { recursive: true });
        const tier = detectTier();
        const line = JSON.stringify({ ...entry, model: config.model, tier }) + "\n";
        appendFileSync(config.logFile, line, "utf-8");
    }
    catch { }
}
