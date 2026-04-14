import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HOME = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;

const DEFAULT_CONFIG = {
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
  providers: {
    ollama: { enabled: true, baseUrl: "http://localhost:11434" },
    lmstudio: { enabled: true, baseUrl: "http://localhost:1234" },
    llama: { enabled: false, baseUrl: "http://localhost:8081" }
  },
  retrieverWeights: {
    filename: 2,
    content: 1,
    priority: 1.5,
    memory: 1,
  }
};

function deepMerge(target, source) {
  if (!source) return target;
  for (const key in source) {
    const val = source[key];
    if (val && typeof val === "object" && !Array.isArray(val)) {
      target[key] = deepMerge(target[key] || {}, val);
    } else {
      target[key] = val;
    }
  }
  return target;
}

function getGlobalConfigPath() {
  return path.join(HOME, ".xentari", "config.json");
}

function getLocalConfigPath(projectDir = process.cwd()) {
  try {
    if (!projectDir) return null;
    return path.join(projectDir, ".xentari", "config.json");
  } catch {
    return null;
  }
}

export function loadConfig(projectDir) {
  const globalPath = getGlobalConfigPath();
  const localPath = getLocalConfigPath(projectDir);

  // Create clean copy of defaults
  let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // global merge
  if (fs.existsSync(globalPath)) {
    try {
      const globalData = JSON.parse(fs.readFileSync(globalPath, "utf-8"));
      config = deepMerge(config, globalData);
    } catch {}
  }

  // local merge
  if (localPath && fs.existsSync(localPath)) {
    try {
      const localData = JSON.parse(fs.readFileSync(localPath, "utf-8"));
      config = deepMerge(config, localData);
    } catch {}
  }

  return config;
}

export function saveConfig(newConfig, isGlobal = false) {
  const configPath = isGlobal ? getGlobalConfigPath() : getLocalConfigPath(newConfig.projectDir);
  if (!configPath) return;

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {}
  }

  const merged = deepMerge(existing, newConfig);
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
}
