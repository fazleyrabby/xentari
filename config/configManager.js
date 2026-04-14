import fs from "fs";
import path from "path";
import { getRuntime } from "../core/runtime/context.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const XENTARI_ROOT = path.join(__dirname, "..");

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
    llama: { enabled: true, baseUrl: "http://localhost:8081" }
  },
  retrieverWeights: {
    filename: 2,
    content: 1,
    priority: 1.5,
    memory: 1,
  }
};

function getGlobalConfigPath() {
   return path.join(XENTARI_ROOT, "config", "config.json");
}

function getLocalConfigPath() {
  const { projectDir } = getRuntime();
  return path.join(projectDir, ".xentari", "config.json");
}

export function loadConfig() {
  const globalPath = getGlobalConfigPath();
  const localPath = getLocalConfigPath();
  
  let config = { ...DEFAULT_CONFIG };

  // 1. Merge Global Config (User settings in Xentari root)
  if (fs.existsSync(globalPath)) {
    try {
      const globalData = JSON.parse(fs.readFileSync(globalPath, "utf-8"));
      config = { ...config, ...globalData };
    } catch (e) {
      console.error("Failed to load global config:", e.message);
    }
  }

  // 2. Merge Local Config (Project-specific settings)
  if (fs.existsSync(localPath)) {
    try {
      const localData = JSON.parse(fs.readFileSync(localPath, "utf-8"));
      config = { ...config, ...localData };
    } catch (e) {
      console.error("Failed to load local config:", e.message);
    }
  }

  return config;
}

export function saveConfig(config, isGlobal = false) {
  const configPath = isGlobal ? getGlobalConfigPath() : getLocalConfigPath();
  const dir = path.dirname(configPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
