import express from "express";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { getHash, logObservation } from "../utils/observability.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const XENTARI_ROOT = path.resolve(__dirname, "../../");

import { buildPlan } from "../../planner/index.ts";
import { execute } from "../../executor/index.ts";
import { projectPlan } from "../../adapter/index.ts";
import { generatePatches } from "../../patch/index.ts";
import { processPatches } from "../../templates/index.ts";
import { applyFiles } from "../../apply/index.ts";
import { generateGitPatch } from "../../git/index.ts";

const app = express();
app.use(express.json());

// In-memory job store
const jobs = new Map();
const queue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const jobId = queue.shift();
  const job = jobs.get(jobId);
  job.status = "running";

  const startTime = Date.now();
  try {
    const binPath = path.resolve(XENTARI_ROOT, "bin/xen.js");
    const cmd = `XEN_AUTO_APPROVE=true node "${binPath}" "analyze this project" --project="${job.projectPath}"`;
    
    const output = execSync(cmd, { 
      encoding: "utf8", 
      env: { ...process.env, XEN_AUTO_APPROVE: "true" },
      timeout: 600000 // 10 mins
    });
    
    const endTime = Date.now();
    job.status = "done";
    
    if (job.type === "plan") {
      const plan = buildPlan(output);
      job.result = JSON.stringify(plan, null, 2);
    } else {
      job.result = output;
    }

    logObservation({
      jobId: job.id,
      inputHash: getHash("analyze this project" + job.projectPath),
      outputHash: getHash(job.result),
      startTime,
      endTime,
      durationMs: endTime - startTime
    });
  } catch (err) {
    job.status = "error";
    job.error = err.message.includes("ETIMEDOUT") ? "timeout" : err.message;
  }

  isProcessing = false;
  processQueue(); // Process next job
}

app.post("/analyze", (req, res) => {
  const { projectPath } = req.body;

  if (!projectPath) {
    return res.status(400).json({ error: "projectPath is required" });
  }

  const jobId = crypto.randomUUID();
  const job = {
    id: jobId,
    type: "analyze",
    projectPath,
    status: "pending",
    result: null,
    error: null,
    createdAt: Date.now()
  };

  jobs.set(jobId, job);
  queue.push(jobId);
  
  processQueue(); // Trigger processing

  res.json({ jobId });
});

app.post("/plan", (req, res) => {
  const { projectPath } = req.body;

  if (!projectPath) {
    return res.status(400).json({ error: "projectPath is required" });
  }

  const jobId = crypto.randomUUID();
  const job = {
    id: jobId,
    type: "plan",
    projectPath,
    status: "pending",
    result: null,
    error: null,
    createdAt: Date.now()
  };

  jobs.set(jobId, job);
  queue.push(jobId);
  
  processQueue();

  res.json({ jobId });
});

import { LlamaParser } from "../../core/intent/llamaParser.ts";
import fs from "node:fs";

app.post("/instruct", async (req, res) => {
  const { instruction, projectPath } = req.body;
  if (!instruction) {
    return res.status(400).json({ error: "instruction is required" });
  }

  const parser = new LlamaParser();
  const parsed = await parser.parse(instruction);
  
  if ("error" in parsed) {
    return res.status(400).json(parsed);
  }

  const isLaravel = projectPath && fs.existsSync(path.join(projectPath, "composer.json"));

  const steps = parsed.intents.map((intent, idx) => ({
    id: `step-${idx}`,
    type: intent.intent === "add_auth" ? "route" : 
          intent.intent === "create_route" ? "route" : 
          intent.intent === "add_controller" ? "controller" : "structure",
    description: `Implement ${intent.intent} for ${intent.subject}`,
    file: `${intent.subject}.js`, 
    priority: 10,
    dependsOn: [],
    meta: { 
      capability: intent.intent, 
      layer: intent.intent === "add_auth" ? "entrypoint" : 
             intent.intent === "create_route" ? "entrypoint" : 
             intent.intent === "add_controller" ? "handler" : "module",
      subject: intent.subject,
      projectType: isLaravel ? "laravel" : "node"
    }
  }));
  
  const plan = { steps };
  res.json({ plan });
});

app.post("/execute", (req, res) => {
  const { plan, state } = req.body;

  if (!plan || !state) {
    return res.status(400).json({ error: "plan and state are required" });
  }

  const result = execute(plan, state);
  res.json(result);
});

app.post("/project", (req, res) => {
  const { plan, target } = req.body;

  if (!plan || !target) {
    return res.status(400).json({ error: "plan and target are required" });
  }

  const result = projectPlan(plan, target);
  res.json(result);
});

app.post("/patch", (req, res) => {
  const { projectedPlan } = req.body;

  if (!projectedPlan) {
    return res.status(400).json({ error: "projectedPlan is required" });
  }

  const result = generatePatches(projectedPlan);
  res.json(result);
});

app.post("/render", (req, res) => {
  const { patches } = req.body;

  if (!patches) {
    return res.status(400).json({ error: "patches are required" });
  }

  const result = processPatches(patches);
  res.json(result);
});

app.post("/apply", (req, res) => {
  const { files, root } = req.body;

  if (!files || !root) {
    return res.status(400).json({ error: "files and root are required" });
  }

  try {
    const result = applyFiles(files, root);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/git/patch", (req, res) => {
  const { files } = req.body;

  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: "files array is required" });
  }

  const patch = generateGitPatch(files);
  res.json({ patch });
});

app.get("/job/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  res.json({
    status: job.status,
    result: job.result,
    error: job.error
  });
});

// Minimal cleanup: remove jobs older than 30 mins
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > 1800000) {
      jobs.delete(id);
    }
  }
}, 300000);

const PORT = 4000;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Minimal API Layer with Queue running on http://127.0.0.1:${PORT}`);
});

export default app;
