import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { getState } from "../ui/state.js";
import { setRuntime, getRuntime } from "../runtime/context.js";
import { workspaceManager } from "../workspace/workspaceManager.js";
import { sessionManager } from "../session/sessionManager.js";
import modelsRouter from "./routes/models.js";
import filesRouter from "./routes/files.js";
import { getProvider } from "../providers/registry.js";
import { getContext } from "../context/contextEngine.js";
import { runAgent } from "../runtime/runAgent.ts";
import { providerRuntime } from "../../runtime/providerRuntime.js";
import { loadConfig, saveConfig } from "../../config/configManager.js";

// Initial model discovery
providerRuntime.refresh().catch(console.error);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use("/api", modelsRouter);
app.use("/api", filesRouter);

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

app.post("/run/stream", async (req, res) => {
  const { prompt, messages } = req.body;
  const { apiUrl, model } = getRuntime();
  
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  try {
    const providerKey = model?.split(":")[0] || "ollama";
    const provider = getProvider(providerKey);
    
    if (!provider) throw new Error(`Provider ${providerKey} not found`);

    const context = getContext();
    const history = (messages || []).map(m => ({
      role: m.role || "user",
      content: m.content
    }));

    const systemPrompt = `You are Xentari, a deterministic AI coding agent.
CONTEXT:
${JSON.stringify(context, null, 2)}`;

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...history
    ];

    await provider.streamChat({
      model,
      messages: fullMessages,
      onToken: (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
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
    const { input, prompt, projectDir } = req.body;

    const result = await runAgent({
      input: input || prompt,
      projectDir
    });

    res.json(result);
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.post("/config", (req, res) => {
  const newConfig = req.body;
  
  // 1. Update Runtime
  setRuntime({
    projectDir: newConfig.projectDir,
    model: newConfig.model,
    apiUrl: newConfig.apiUrl
  });

  // 2. Persist to Project (.xentari/config.json)
  saveConfig(newConfig);

  res.json({ success: true });
});

app.get("/config", (req, res) => {
  const runtime = getRuntime();
  const persistent = loadConfig();
  res.json({ ...persistent, ...runtime });
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
