import fs from "fs";
import path from "path";
import { getRuntime } from "../runtime/context.js";

function getSessionDir() {
  const { projectDir } = getRuntime();
  const dir = path.join(projectDir, ".xentari/sessions");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function saveSession(id, messages) {
  const dir = getSessionDir();
  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(messages, null, 2));
}

export function loadSession(id) {
  const dir = getSessionDir();
  const file = path.join(dir, `${id}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
}

export function listSessions() {
  const dir = getSessionDir();
  return fs.readdirSync(dir).map(f => f.replace(".json", ""));
}
