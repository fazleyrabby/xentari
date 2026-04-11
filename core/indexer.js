import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { glob } from "glob";
import { loadConfig } from "./config.js";
import { log } from "./logger.js";

const IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/logs/**",
  "**/context/**",
  "**/*.lock",
  "**/xen.context.json",
  "**/config.json",
  "**/*.md",
  "**/*.log",
];

function extractExports(content, ext) {
  const exports = [];
  if (ext === ".js" || ext === ".ts") {
    // Basic regex for named exports
    const matches = content.matchAll(/export\s+(?:async\s+)?(?:function|const|class|let|var)\s+([a-zA-Z0-9_]+)/g);
    for (const match of matches) {
      exports.push(match[1]);
    }
    // Default export
    const defaultMatch = content.match(/export\s+default\s+([a-zA-Z0-9_]+|function|class)/);
    if (defaultMatch) {
      exports.push("default");
    }
  }
  return exports;
}

function generateSummary(content, filePath) {
  // Heuristic: Take the first few lines of comments or code
  const lines = content.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);
  
  let summary = "";
  for (const line of lines) {
    if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) {
      summary += line.replace(/[\/\*]/g, "").trim() + " ";
    } else {
      summary += line;
      break;
    }
    if (summary.length > 150) break;
  }
  
  return summary.slice(0, 200).trim() || `Source file: ${basename(filePath)}`;
}

export async function indexProject(projectDir) {
  const config = loadConfig();
  log.info("[INDEXER] Scanning project...");
  
  const files = await glob("**/*.*", {
    cwd: projectDir,
    ignore: IGNORE,
    nodir: true,
  });

  const index = {
    files: [],
    timestamp: new Date().toISOString(),
    projectDir
  };

  for (const file of files) {
    const fullPath = join(projectDir, file);
    const ext = extname(file);
    let content = "";
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const fileExports = extractExports(content, ext);
    const summary = generateSummary(content, file);

    index.files.push({
      path: file,
      type: ext.slice(1) || "unknown",
      summary,
      exports: fileExports
    });
  }

  const indexPath = join(config.logsDir, "index.json");
  mkdirSync(config.logsDir, { recursive: true });
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  
  log.ok(`[INDEXER] Indexed ${index.files.length} files to logs/index.json`);
  return index;
}

export function loadIndex() {
  const config = loadConfig();
  const indexPath = join(config.logsDir, "index.json");
  if (!existsSync(indexPath)) return null;
  try {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  } catch {
    return null;
  }
}
