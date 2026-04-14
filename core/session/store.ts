import fs from "fs";
import path from "path";

export function loadSession(projectDir, sessionId = "default") {
  const file = path.join(projectDir, ".xentari", "sessions", `${sessionId}.json`);

  if (!fs.existsSync(file)) return [];

  const data = JSON.parse(fs.readFileSync(file, "utf-8"));

  return Array.isArray(data) ? data : [];
}

export function saveSession(projectDir, sessionId, messages) {
  const dir = path.join(projectDir, ".xentari", "sessions");

  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, `${sessionId}.json`),
    JSON.stringify(messages, null, 2)
  );
}
