import fs from "fs";
import path from "path";
import crypto from "crypto";

export function loadSession(projectDir, sessionId = "default") {
  if (!projectDir) return [];
  const file = path.join(projectDir, ".xentari", "sessions", `${sessionId}.json`);

  if (!fs.existsSync(file)) return [];

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));

  return Array.isArray(data) ? data : [];
}

export function saveSession(projectDir, sessionId, messages) {
  if (!projectDir) return;
  const dir = path.join(projectDir, ".xentari", "sessions");

  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, `${sessionId}.json`),
    JSON.stringify(messages, null, 2)
  );
}

export function listSessions(projectDir) {
  if (!projectDir) return [];
  const dir = path.join(projectDir, ".xentari", "sessions");
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(".json", ""));
}

export function createSession(projectDir) {
  if (!projectDir) throw new Error("projectDir is required to create session");
  const sessionId = crypto.randomUUID();
  saveSession(projectDir, sessionId, []);
  return { id: sessionId, messages: [] };
}

export function deleteSession(projectDir, sessionId) {
  if (!projectDir) return;
  const file = path.join(projectDir, ".xentari", "sessions", `${sessionId}.json`);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
}

export function loadHistory(projectDir) {
  if (!projectDir) return { history: [] };
  const file = path.join(projectDir, ".xentari", "history.json");
  if (!fs.existsSync(file)) return { history: [] };
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    return { history: [] };
  }
}

export function saveHistory(projectDir, history) {
  if (!projectDir) return;
  const file = path.join(projectDir, ".xentari", "history.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
}

export function addToHistory(projectDir, entry) {
  const data = loadHistory(projectDir);
  data.history.unshift({ ...entry, timestamp: entry.timestamp || Date.now() });
  data.history = data.history.slice(0, 50);
  saveHistory(projectDir, data);
}
