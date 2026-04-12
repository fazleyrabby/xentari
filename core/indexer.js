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
 * Task 1: Extended Analyzer
 */
export function analyzeFile(filePath, projectDir) {
  const fullPath = join(projectDir, filePath);
  const content = readFileSync(fullPath, "utf-8");

  const functions = content.match(/function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:async\s*)?function/g) || [];
  const classes = content.match(/class\s+(\w+)/g) || [];
  const exports = content.match(/export\s+|module\.exports|exports\./g) || [];

  return {
    path: filePath,
    functions: functions.slice(0, 10), // Cap for index size
    classes: classes.slice(0, 5),
    hasExports: exports.length > 0,
    size: content.length
  };
}

/**
 * Task 2: Entry Point Detection
 */
export function detectEntryPoints(files) {
  return files
    .filter(f => 
      f.path.includes("app.js") || f.path.includes("app.ts") ||
      f.path.includes("server.js") || f.path.includes("server.ts") ||
      f.path.includes("main.js") || f.path.includes("main.ts") ||
      f.path.includes("index.js") || f.path.includes("index.ts")
    )
    .map(f => f.path);
}

/**
 * Task 3: Framework Detection (Light)
 */
export function detectFramework(projectDir) {
  const exists = (f) => existsSync(join(projectDir, f));
  if (exists("artisan")) return "laravel";
  if (exists("next.config.js") || exists("next.config.mjs")) return "nextjs";
  if (exists("manage.py")) return "django";
  if (exists("package.json")) return "node";
  return null;
}

/**
 * Task 4: Domain Grouping
 */
function getDomain(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes("auth") || lower.includes("login") || lower.includes("user")) return "authentication";
  if (lower.includes("todo") || lower.includes("task")) return "todos";
  if (lower.includes("api") || lower.includes("route")) return "api";
  if (lower.includes("db") || lower.includes("model") || lower.includes("schema")) return "database";
  return "general";
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
    framework: detectFramework(projectDir),
    entryPoints: [],
    files: [],
    domains: {},
    timestamp: new Date().toISOString(),
    projectDir
  };

  for (const file of files) {
    try {
      const analysis = analyzeFile(file, projectDir);
      const domain = getDomain(file);
      
      knowledge.files.push(analysis);
      
      if (!knowledge.domains[domain]) knowledge.domains[domain] = [];
      knowledge.domains[domain].push(file);
    } catch {
      continue;
    }
  }

  knowledge.entryPoints = detectEntryPoints(knowledge.files);

  const knowledgePath = join(config.logsDir, "knowledge.json");
  // Also keep index.json for backward compatibility or refactor later
  const indexPath = join(config.logsDir, "index.json");
  
  mkdirSync(config.logsDir, { recursive: true });
  writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2));
  writeFileSync(indexPath, JSON.stringify(knowledge, null, 2));
  
  log.ok(`[INDEXER] Indexed ${knowledge.files.length} files. Framework: ${knowledge.framework || 'unknown'}`);
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
