import { log } from "../logger.js";
import os from "node:os";

// ---------- ASCII ----------
const LOGO = `
██╗  ██╗███████╗███╗   ██╗████████╗ █████╗ ██████╗ ██╗
╚██╗██╔╝██╔════╝████╗  ██║╚══██╔══╝██╔══██╗██╔══██╗██║
 ╚███╔╝ █████╗  ██╔██╗ ██║   ██║   ███████║██████╔╝██║
 ██╔██╗ ██╔══╝  ██║╚██╗██║   ██║   ██╔══██║██╔══██╗██║
██╔╝ ██╗███████╗██║ ╚████║   ██║   ██║  ██║██║  ██║██║
╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝
`;

const LOGO_COMPACT = `XENTARI`;

// ---------- helpers ----------
function getTerminalWidth() {
  return process.stdout.columns || 80;
}

function getModeLabel(mode) {
  switch (mode) {
    case "strict": return "STRICT";
    case "sandbox": return "SANDBOX";
    default: return "NORMAL";
  }
}

// ---------- main ----------
export function renderHeader({
  project,
  stack,
  mode = "normal",
  profile = null,
}) {
  const width = getTerminalWidth();

  // ---------- responsive logo ----------
  if (width >= 80) {
    console.log(LOGO);
  } else {
    console.log(LOGO_COMPACT);
  }

  // ---------- meta ----------
  log.info(`XENTARI v0.1.0`);
  log.info(`Local-first AI Dev System\n`);

  log.info(`📁 Project: ${project}`);
  log.info(`📦 Stack:   ${stack || "unknown"}`);
  log.info(`⚙️  Mode:    ${getModeLabel(mode)}`);

  // ---------- profile (future-ready) ----------
  if (profile) {
    log.info(
      `🧠 Model: ${profile.name} | Files: ${profile.maxFiles} | Tokens: ${profile.maxTokens}`
    );
  }

  console.log("─".repeat(Math.min(width, 80)));

  console.log(`Type your task or /help for commands.`);
  console.log(`Hotkeys: Ctrl+P (Palette)\n`);
}