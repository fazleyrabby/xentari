import fs from "fs";
import path from "path";
import { getRuntime } from "../core/runtime/context.js";

const DEFAULT_CONFIG = {
  providers: {
    ollama: {
      enabled: true,
      baseUrl: "http://localhost:11434"
    },
    lmstudio: {
      enabled: true,
      baseUrl: "http://localhost:1234"
    },
    llama: {
      enabled: true,
      baseUrl: "http://localhost:8081"
    }
  },
  defaultModel: "qwen"
};

function getConfigPath() {
  const { projectDir } = getRuntime();
  return path.join(projectDir, ".xentari", "config.json");
}

export function loadConfig() {
  const configPath = getConfigPath();
  
  if (!fs.existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const data = fs.readFileSync(configPath, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch (e) {
    console.error("Failed to load config, using defaults", e);
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config) {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
