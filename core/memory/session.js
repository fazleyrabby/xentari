import fs from "node:fs";
import { join } from "node:path";

const FILE = join(import.meta.dirname, "session.json");
const MAX = 10;

export function loadSession() {
  try {
    if (!fs.existsSync(FILE)) return { history: [] };
    return JSON.parse(fs.readFileSync(FILE, "utf-8"));
  } catch (e) {
    return { history: [] };
  }
}

export function saveSession(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("Failed to save session memory");
  }
}

export function addToSession(entry) {
  const session = loadSession();
  session.history.unshift({
    ...entry,
    timestamp: entry.timestamp || Date.now()
  });
  session.history = session.history.slice(0, MAX);
  saveSession(session);
}

export function clearSession() {
  saveSession({ history: [] });
}
