import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { glob } from "glob";
import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { safePath } from "./project/guard.js";

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

/**
 * Task 3: Lightweight Summarizer
 * Extracts the first 200 chars or meaningful comments.
 */
function summarizeFile(content, filePath) {
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

/**
 * Task 4: Keyword Extractor
 * Extracts unique words of at least 4 characters.
 */
function extractKeywords(content) {
  const words = content.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  return [...new Set(words)].slice(0, 15);
}

/**
 * Task 5: Export Extractor
 */
function extractExports(content, ext) {
  const exports = [];
  if (ext === ".js" || ext === ".ts" || ext === ".tsx" || ext === ".jsx") {
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

/**
 * Task 2: Build Indexer
 * Scans project and builds knowledge.json
 */
export async function indexProject(projectDir) {
  const config = loadConfig();
  log.info("[INDEXER] Building knowledge index...");
  
  const files = await glob("**/*.*", {
    cwd: projectDir,
    ignore: IGNORE,
    nodir: true,
  });

  const knowledge = {
    files: [],
    timestamp: new Date().toISOString(),
    projectDir
  };

  for (const file of files) {
    let fullPath;
    try {
      fullPath = safePath(projectDir, file);
    } catch {
      continue;
    }
    
    const ext = extname(file);
    let content = "";
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const fileExports = extractExports(content, ext);
    const summary = summarizeFile(content, file);
    const keywords = extractKeywords(content);

    knowledge.files.push({
      path: file,
      type: ext.slice(1) || "unknown",
      summary,
      keywords,
      exports: fileExports
    });
  }

  const knowledgePath = join(config.logsDir, "knowledge.json");
  // Also keep index.json for backward compatibility or refactor later
  const indexPath = join(config.logsDir, "index.json");
  
  mkdirSync(config.logsDir, { recursive: true });
  writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2));
  writeFileSync(indexPath, JSON.stringify(knowledge, null, 2));
  
  log.ok(`[INDEXER] Indexed ${knowledge.files.length} files to logs/knowledge.json`);
  return knowledge;
}

export function loadIndex() {
  const config = loadConfig();
  const knowledgePath = join(config.logsDir, "knowledge.json");
  const indexPath = join(config.logsDir, "index.json");
  
  const path = existsSync(knowledgePath) ? knowledgePath : indexPath;
  if (!existsSync(path)) return null;
  
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
