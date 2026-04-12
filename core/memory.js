import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { loadConfig } from "./config.js";
import { join } from "node:path";

function memoryPath() {
  const config = loadConfig();
  return join(config.root, ".xentari", "memory.json");
}

function intelligencePath() {
  const config = loadConfig();
  return join(config.root, ".xentari", "intelligence.json");
}

// --- Execution history ---

function loadHistory() {
  const p = memoryPath();
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return [];
  }
}

export function remember(entry) {
  const config = loadConfig();
  const dir = join(config.root, ".xentari");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const history = loadHistory();
  history.push({ ...entry, timestamp: new Date().toISOString() });
  writeFileSync(memoryPath(), JSON.stringify(history, null, 2), "utf-8");
}

export function recall() {
  return loadHistory();
}

// --- Intelligence store (persistent patterns + recent files) ---

const EMPTY_INTEL = {
  recentFiles: [],
  successfulPatterns: [],
  failedPatterns: [],
};

function loadIntel() {
  const p = intelligencePath();
  if (!existsSync(p)) return { ...EMPTY_INTEL };
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8"));
    return {
      recentFiles: Array.isArray(raw.recentFiles) ? raw.recentFiles : [],
      successfulPatterns: Array.isArray(raw.successfulPatterns) ? raw.successfulPatterns : [],
      failedPatterns: Array.isArray(raw.failedPatterns) ? raw.failedPatterns : [],
    };
  } catch {
    return { ...EMPTY_INTEL };
  }
}

function saveIntel(intel) {
  const config = loadConfig();
  const dir = join(config.root, ".xentari");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(intelligencePath(), JSON.stringify(intel, null, 2), "utf-8");
}

export function getIntelligence() {
  return loadIntel();
}

export function trackRecentFiles(files) {
  const intel = loadIntel();
  const now = Date.now();
  const newEntries = files.map((f) => ({ file: f, ts: now }));
  // Merge, deduplicate by file (keep newest), cap at 20
  const merged = [...newEntries, ...intel.recentFiles];
  const seen = new Set();
  intel.recentFiles = merged.filter((e) => {
    if (seen.has(e.file)) return false;
    seen.add(e.file);
    return true;
  }).slice(0, 20);
  saveIntel(intel);
}

export function recordPattern(step, status, files = []) {
  const intel = loadIntel();
  const entry = { step, files, timestamp: new Date().toISOString() };
  if (status === "success") {
    intel.successfulPatterns.push(entry);
    intel.successfulPatterns = intel.successfulPatterns.slice(-20); // Keep last 20 (Phase 45)
  } else {
    intel.failedPatterns.push(entry);
    intel.failedPatterns = intel.failedPatterns.slice(-20); // Keep last 20
  }
  saveIntel(intel);
}

export function getRecentFileNames() {
  const intel = loadIntel();
  return intel.recentFiles.map((e) => e.file);
}
