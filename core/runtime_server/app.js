import express from "express";
import fs from "fs";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import { execSync, spawn } from "child_process";
import { getState } from "../ui/state.js";
import { workspaceManager } from "../workspace/workspaceManager.js";
import { loadSession, saveSession, listSessions, createSession, deleteSession } from "../session/store.ts";

import modelsRouter from "./routes/models.js";
import filesRouter from "./routes/files.js";
import { loadConfig, saveConfig } from "../../config/configManager.js";
import { normalizeMetrics } from "../llm/metrics.js";
import { setMetrics } from "../ui/state.js";
import { detectModel } from "../utils/detectModel.ts";

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

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    });

    const binPath = path.resolve(XENTARI_ROOT, "bin/xen.js");
    const child = spawn("node", [
      binPath,
      input,
      `--project=${resolvedProject}`,
      ...(command ? [`--command=${command}`] : [])
    ], {
      env: { ...process.env, XEN_AUTO_APPROVE: "true" }
    });

    child.stdout.on("data", (data) => {
      const text = data.toString();
      res.write(`data: ${JSON.stringify({ type: "chunk", content: text })}\n\n`);
    });

    child.on("close", () => {
      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    });
  } catch (err) {
    if (!res.headersSent) res.status(400).json({ error: err.message });
    else res.end();
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

    const binPath = path.resolve(XENTARI_ROOT, "bin/xen.js");
    const child = spawn("node", [binPath, input || prompt, `--project=${resolvedProject}`], {
      env: { ...process.env, XEN_AUTO_APPROVE: "true" }
    });

    let accumulated = "";
    child.stdout.on("data", (data) => {
      accumulated += data.toString();
      res.write(`data: ${JSON.stringify({ fullText: accumulated })}\n\n`);
    });

    child.on("close", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });
  } catch (err) {
    if (!res.headersSent) res.status(400).json({ error: err.message });
    else res.end();
  }
});

async function pollJob(jobId) {
  const maxRetries = 600; // 10 mins with 1s polling
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(`http://localhost:3005/job/${jobId}`);
    const data = await res.json();
    if (data.status === "done") return data.result;
    if (data.status === "error") throw new Error(data.error || "Job failed");
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("Job timeout");
}

app.post(["/chat", "/run"], async (req, res) => {
  try {
    const { input, prompt, projectPath, projectDir } = req.body;
    const resolvedProject = validateProjectPath(projectPath || projectDir);
    const task = input || prompt;

    // Use Minimal API Layer with Queue if available
    if (task.toLowerCase().includes("analyze") && !task.toLowerCase().includes("modify")) {
      try {
        const response = await fetch("http://localhost:3005/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectPath: resolvedProject })
        });
        const { jobId } = await response.json();
        if (jobId) {
          const result = await pollJob(jobId);
          return res.json({ fullText: result });
        }
      } catch (err) {
        console.error("[API QUEUE ERROR]", err.message);
        // Fallback to direct execution
      }
    }

    const binPath = path.resolve(XENTARI_ROOT, "bin/xen.js");
    const output = execSync(`XEN_AUTO_APPROVE=true node "${binPath}" "${task}" --project="${resolvedProject}"`, {
      encoding: "utf8",
      env: { ...process.env, XEN_AUTO_APPROVE: "true" }
    });

    res.json({ fullText: output });
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

app.delete("/session/:id", (req, res) => {
  const { projectDir } = req.query;
  deleteSession(projectDir, req.params.id);
  res.json({ success: true });
});

app.post("/session/set-project", (req, res) => {
  res.json({ success: true });
});

app.get("/api/model", (req, res) => {
  res.json({ name: detectModel() });
});

app.get("/state", (req, res) => {
  res.json(getState());
});

export default app;