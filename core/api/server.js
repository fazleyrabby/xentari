import express from "express";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const XENTARI_ROOT = path.resolve(__dirname, "../../");

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

  try {
    const binPath = path.resolve(XENTARI_ROOT, "bin/xen.js");
    const cmd = `XEN_AUTO_APPROVE=true node "${binPath}" "analyze this project" --project="${job.projectPath}"`;
    
    const output = execSync(cmd, { 
      encoding: "utf8", 
      env: { ...process.env, XEN_AUTO_APPROVE: "true" },
      timeout: 600000 // 10 mins
    });
    
    job.status = "done";
    job.result = output;
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

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`Minimal API Layer with Queue running on port ${PORT}`);
});

export default app;
