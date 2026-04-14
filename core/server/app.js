import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { route } from "../router/index.js";
import { getState } from "../ui/state.js";
import { setRuntime, getRuntime } from "../runtime/context.js";
import { workspaceManager } from "../workspace/workspaceManager.js";
import { sessionManager } from "../session/sessionManager.js";
import modelsRouter from "./routes/models.js";
import { providerRuntime } from "../../runtime/providerRuntime.js";

// Initial model discovery
providerRuntime.refresh().catch(console.error);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use("/api", modelsRouter);

// Projects API
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

// Run API
app.post("/run", async (req, res) => {
  try {
    const { prompt } = req.body;

    const result = await route(prompt, {
      auto: true,
      source: "web"
    });

    res.json(result);

  } catch (err) {
    res.json({ error: err.message });
  }
});

app.post("/config", (req, res) => {
  const { projectDir, model, provider, apiUrl } = req.body;

  setRuntime({
    projectDir,
    model,
    provider,
    apiUrl
  });

  res.json({ success: true });
});

app.get("/config", (req, res) => {
  res.json(getRuntime());
});

app.post("/session/save", (req, res) => {
  const { session } = req.body;
  sessionManager.saveSession(session);
  res.json({ success: true });
});

app.get("/session/load/:id", (req, res) => {
  const session = sessionManager.loadSession(req.params.id);
  res.json(session || { messages: [] });
});

app.get("/session/list", (req, res) => {
  res.json(sessionManager.listSessions());
});

app.post("/session/create", (req, res) => {
  res.json(sessionManager.createSession());
});

app.post("/session/set-project", (req, res) => {
  const { sessionId, projectId } = req.body;
  try {
    const session = sessionManager.setActiveProject(sessionId, projectId);
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/state", (req, res) => {
  res.json(getState());
});

export default app;
