import express from "express";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import { getState } from "../ui/state.js";
import { workspaceManager } from "../workspace/workspaceManager.js";
import { loadSession, saveSession, listSessions, createSession } from "../session/store.ts";

import modelsRouter from "./routes/models.js";
import filesRouter from "./routes/files.js";
import { runAgent } from "../runtime/runAgent.ts";
import { loadConfig, saveConfig } from "../../config/configManager.js";
import { normalizeMetrics } from "../llm/metrics.js";
import { setMetrics } from "../ui/state.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const XENTARI_ROOT = path.resolve(process.cwd());

function validateProjectPath(projectPath) {
  if (!projectPath) {
    throw new Error("Missing projectPath — execution aborted");
  }

  const resolvedProject = path.resolve(projectPath);
  const resolvedRoot = path.resolve(XENTARI_ROOT);

  if (resolvedProject === resolvedRoot) {
    throw new Error("Refusing to scan Xentari root");
  }

  if (resolvedProject.startsWith(resolvedRoot)) {
    throw new Error("Refusing to scan inside Xentari directory");
  }

  if (projectPath.includes("..")) {
    throw new Error("Invalid project path");
  }

  return resolvedProject;
}

app.use("/api", modelsRouter);
app.use("/api", filesRouter);

app.get("/api/projects", (req, res) => {
  res.json(workspaceManager.getProjects());
});

app.post("/api/projects/add", (req, res) => {
  try {
    const { path: projectPath } = req.body;
    const project = workspaceManager.addProject(projectPath);
    res.json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/projects/:id", (req, res) => {
  workspaceManager.removeProject(req.params.id);
  res.json({ success: true });
});

app.get("/chat/stream", async (req, res) => {
  const { input, projectPath, command } = req.query;

  try {
    const resolvedProject = validateProjectPath(projectPath);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    const result = await runAgent({
      input,
      projectDir: resolvedProject,
      meta: command ? { command } : null,
      onStatus: (msg) => {
        res.write(`data: ${JSON.stringify({ type: "status", message: msg })}\n\n`);
      },
      onContext: (files) => {
        res.write(`data: ${JSON.stringify({ type: "context", files: files.slice(0, 8) })}\n\n`);
      },
      onMetrics: (metrics) => {
        setMetrics(metrics);
        res.write(`data: ${JSON.stringify({ type: "metrics", metrics })}\n\n`);
      },
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
      }
    });

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

app.post("/run/stream", async (req, res) => {
  const { input, prompt, projectPath, projectDir } = req.body;

  try {
    const resolvedProject = validateProjectPath(projectPath || projectDir);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    let accumulated = "";
    const result = await runAgent({
      input: input || prompt,
      projectDir: resolvedProject,
      onChunk: (chunk) => {
        accumulated += chunk;
        res.write(`data: ${JSON.stringify({ fullText: accumulated })}\n\n`);
      }
    });

    res.write("data: [DONE]\n\n");
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

app.post(["/chat", "/run"], async (req, res) => {
  try {
    const { input, prompt, projectPath, projectDir } = req.body;
    const resolvedProject = validateProjectPath(projectPath || projectDir);

    const result = await runAgent({
      input: input || prompt,
      projectDir: resolvedProject
    });

    res.json(result);
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.post("/config", (req, res) => {
  const newConfig = req.body;
  
  saveConfig(newConfig);

  res.json({ success: true });
});

app.get("/config", (req, res) => {
  const persistent = loadConfig(req.query.projectDir);
  res.json({ ...persistent });
});

app.post("/session/save", (req, res) => {
  const { sessionId, messages, projectDir } = req.body;
  saveSession(projectDir, sessionId, messages);
  res.json({ success: true });
});

app.get("/session/load/:id", (req, res) => {
  const { projectDir } = req.query;
  const messages = loadSession(projectDir, req.params.id);
  res.json({ id: req.params.id, messages });
});

app.get("/session/list", (req, res) => {
  const { projectDir } = req.query;
  res.json(listSessions(projectDir));
});

app.post("/session/create", (req, res) => {
  const { projectDir } = req.body;
  res.json(createSession(projectDir));
});

app.post("/session/set-project", (req, res) => {
  res.json({ success: true });
});

app.get("/file", (req, res) => {
  const { path: filePath } = req.query;
  const config = loadConfig();
  const projectDir = config.projectDir || "";

  if (!filePath || !projectDir) {
    return res.status(400).json({ error: "Missing path or projectDir" });
  }

  const resolved = path.resolve(projectDir, filePath);
  if (!resolved.startsWith(path.resolve(projectDir))) {
    return res.status(403).json({ error: "Path traversal denied" });
  }

  try {
    const raw = fs.readFileSync(resolved, "utf-8");
    const truncated = raw.slice(0, 2000);
    const keyword = req.query.keyword || path.basename(filePath, path.extname(filePath));
    const lines = truncated.split("\n");
    const matchLine = lines.findIndex(l => l.toLowerCase().includes(keyword.toLowerCase()));
    res.json({ path: filePath, content: truncated, matchLine: matchLine >= 0 ? matchLine : null });
  } catch {
    res.status(404).json({ error: "File not found" });
  }
});

app.get("/state", (req, res) => {
  res.json(getState());
});

export default app;