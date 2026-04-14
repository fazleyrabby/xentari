import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { route } from "../router/index.js";
import { getState } from "../ui/state.js";
import { setRuntime, getRuntime } from "../runtime/context.js";
import { saveSession, loadSession, listSessions } from "../session/store.js";
import modelsRouter from "./routes/models.js";
import { providerRuntime } from "../../runtime/providerRuntime.js";

// Initial model discovery
providerRuntime.refresh().catch(console.error);

const app = express();
app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use("/api", modelsRouter);

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
  const { sessionId, messages } = req.body;
  saveSession(sessionId, messages);
  res.json({ success: true });
});

app.get("/session/load/:id", (req, res) => {
  res.json(loadSession(req.params.id));
});

app.get("/session/list", (req, res) => {
  res.json(listSessions());
});

app.get("/state", (req, res) => {
  res.json(getState());
});

export default app;
