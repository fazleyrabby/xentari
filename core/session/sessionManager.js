import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getRuntime } from "../runtime/context.js";
import { workspaceManager } from "../workspace/workspaceManager.js";
import { setRuntime } from "../runtime/context.js";

function getSessionsDir() {
  return path.join(process.cwd(), ".xentari", "sessions");
}

export class SessionManager {
  constructor() {
    if (!fs.existsSync(getSessionsDir())) fs.mkdirSync(getSessionsDir(), { recursive: true });
  }

  createSession() {
    const session = {
      id: crypto.randomUUID(),
      activeProjectId: null,
      createdAt: Date.now(),
      messages: []
    };
    this.saveSession(session);
    return session;
  }

  saveSession(session) {
    const file = path.join(getSessionsDir(), `${session.id}.json`);
    fs.writeFileSync(file, JSON.stringify(session, null, 2));
  }

  loadSession(id) {
    const file = path.join(getSessionsDir(), `${id}.json`);
    if (!fs.existsSync(file)) return null;
    const session = JSON.parse(fs.readFileSync(file));
    
    // Sync runtime if project is linked
    if (session.activeProjectId) {
      const project = workspaceManager.getProjectById(session.activeProjectId);
      if (project) {
        setRuntime({ projectDir: project.path });
      }
    }
    
    return session;
  }

  listSessions() {
    return fs.readdirSync(getSessionsDir())
      .filter(f => f.endsWith(".json"))
      .map(f => f.replace(".json", ""));
  }

  setActiveProject(sessionId, projectId) {
    const session = this.loadSession(sessionId);
    if (!session) throw new Error("Session not found");
    
    const project = workspaceManager.getProjectById(projectId);
    if (!project) throw new Error("Project not found");

    session.activeProjectId = projectId;
    this.saveSession(session);
    
    setRuntime({ projectDir: project.path });
    return session;
  }
}

export const sessionManager = new SessionManager();
