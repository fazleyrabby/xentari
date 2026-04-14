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

  // We allow scanning the Xentari root if the user explicitly wants to (Dogfooding mode)
  // but we still prevent arbitrary parent directory escapes.
  if (projectPath.includes("..")) {
    throw new Error("Invalid project path: parent directory traversal denied");
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

    // HEADERS FIRST — MUST NOT BE DELAYED
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    await runAgent({
      input,
      projectDir: resolvedProject,
      meta: command ? { command } : null,
      onStatus: (msg) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: "status", message: msg })}\n\n`);
      },
      onContext: (files) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: "context", files: files.slice(0, 8) })}\n\n`);
      },
      onMetrics: (metrics) => {
        setMetrics(metrics);
        if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: "metrics", metrics })}\n\n`);
      },
      onChunk: (chunk) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: "chunk", content: chunk })}\n\n`);
      }
    });

    if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  } catch (err) {
    // If headers were already sent, write an error event. Otherwise, standard 400.
    if (res.headersSent) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ type: "error", message: err.message })}\n\n`);
    } else {
      res.status(400).json({ error: err.message });
    }
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
    await runAgent({
      input: input || prompt,
      projectDir: resolvedProject,
      onChunk: (chunk) => {
        accumulated += chunk;
        if (!res.writableEnded) res.write(`data: ${JSON.stringify({ fullText: accumulated })}\n\n`);
      }
    });

    if (!res.writableEnded) res.write("data: [DONE]\n\n");
  } catch (err) {
    if (res.headersSent) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    } else {
      res.status(400).json({ error: err.message });
    }
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

app.get("/state", (req, res) => {
  res.json(getState());
});

export default app;