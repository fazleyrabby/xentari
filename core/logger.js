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
  header(msg) {
    console.log(`\n${C.bold}${C.cyan}[xentari]${C.reset} ${msg}`);
  },

  section(msg) {
    console.log(`\n${C.bold}⚙️  [${msg}]${C.reset}`);
  },


  info(msg) {
    console.log(`${C.dim}  •${C.reset} ${msg}`);
  },

  // → <STEP_NAME> <STATE> [metadata]
  // Colors: ... (dim), ✓ (green), ✗ (red)
  step(name, state, metadata = "") {
    let stateSymbol = state;
    if (state === "...") stateSymbol = `${C.dim}...${C.reset}`;
    if (state === "✓") stateSymbol = `${C.green}✓${C.reset}`;
    if (state === "✗") stateSymbol = `${C.red}✗${C.reset}`;
    
    const meta = metadata ? ` ${C.dim}(${metadata})${C.reset}` : "";
    console.log(`${C.cyan}→ ${name.toUpperCase().padEnd(10)}${C.reset} ${stateSymbol}${meta}`);
  },

  ok(msg) {
    console.log(`${C.green}  ✓${C.reset} ${msg}`);
  },

  warn(msg) {
    console.log(`${C.yellow}  ⚠${C.reset} ${msg}`);
  },

  // Strict Error Format
  // ✗ <ERROR_CODE>
  // Reason: <reason>
  // Action: <action>
  error(code, reason, action) {
    console.error(`\n${C.red}✗ ${code.toUpperCase()}${C.reset}`);
    if (reason) console.error(`${C.dim}Reason:${C.reset}\n- ${reason}`);
    if (action) console.error(`${C.dim}Action:${C.reset}\n- ${action}`);
  },

  patch(content, targetPath) {
    console.log(`\n${C.dim}--- ${targetPath}${C.reset}`);
    console.log(`${C.dim}+++ ${targetPath}${C.reset}\n`);
    console.log(content);
  },

  summary(stats) {
    console.log(`\n${C.green}✔ Completed${C.reset}`);
    console.log(`\nChanges:`);
    stats.changes.forEach(c => console.log(`- ${c.path} (${c.type})`));
    console.log(`\nStats:`);
    console.log(`- lines added: ${stats.added}`);
    console.log(`- lines removed: ${stats.removed}`);
    console.log(`- time: ${stats.time}s`);
  },

  debug(ctx) {
    console.log(`\n${C.dim}--- DEBUG CONTEXT ---${C.reset}`);
    console.log(`Target: ${ctx.target}`);
    console.log(`\nRetrieved Files:`);
    ctx.files.forEach(f => console.log(`- ${f}`));
    console.log(`\nDependencies:`);
    ctx.deps.forEach(d => console.log(`- ${d}`));
    console.log(`${C.dim}----------------------${C.reset}`);
  }
};


// Append structured JSON entry to logs/xen.log
export function logToFile(entry) {
  try {
    const config = loadConfig();
    mkdirSync(config.logsDir, { recursive: true });
    const tier = detectTier();
    const line = JSON.stringify({ ...entry, model: config.model, tier }) + "\n";
    appendFileSync(config.logFile, line, "utf-8");
  } catch {}
}
