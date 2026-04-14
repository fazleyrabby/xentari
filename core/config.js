import { loadConfig as loadUnifiedConfig } from "../config/configManager.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");

let _config;

export function loadConfig() {
  if (_config) return _config;
  
  const config = loadUnifiedConfig();
  
  _config = {
    ...config,
    root: ROOT,
    logsDir: path.join(ROOT, "logs"),
    logFile: path.join(ROOT, "logs", "xen.log")
  };

  return _config;
}
