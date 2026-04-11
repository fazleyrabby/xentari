import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

const defaults = {
  baseURL: "http://localhost:8081/v1",
  model: "qwen",
  modelTier: "auto",
  maxFiles: 3,
  maxFileChars: 1500,
  maxTokens: 600,
  temperature: 0.2,
  dryRun: false,
  autoRetries: 3,
  llmTimeoutMs: 60_000,
  maxPatchChars: 10_000,
  retrieverWeights: {
    filename: 2,
    content: 1,
    priority: 1.5,
    memory: 1,
  },
};

let _config;

export function loadConfig() {
  if (_config) return _config;
  try {
    const raw = readFileSync(join(ROOT, "config", "config.json"), "utf-8");
    const user = JSON.parse(raw);
    _config = {
      ...defaults,
      ...user,
      retrieverWeights: { ...defaults.retrieverWeights, ...user.retrieverWeights },
    };
  } catch {
    _config = { ...defaults };
  }
  _config.root = ROOT;
  _config.logsDir = join(ROOT, "logs");
  _config.logFile = join(ROOT, "logs", "xen.log");
  return _config;
}
