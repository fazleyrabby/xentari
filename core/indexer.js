import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, basename, extname, dirname, relative } from "node:path";
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
 * Task 2: Normalize Paths (Phase 33)
 */
function normalizeImportPath(baseDir, importPath, projectDir) {
  if (!importPath.startsWith(".")) return null; // Skip packages
  
  const absolutePath = join(projectDir, baseDir, importPath);
  const extensions = [".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"];
  
  // Try direct path first
  if (existsSync(absolutePath) && !fs.statSync(absolutePath).isDirectory()) {
    return relative(projectDir, absolutePath);
  }

  for (const ext of extensions) {
    const fullPath = absolutePath + (ext.startsWith("/") ? ext : (absolutePath.endsWith(ext) ? "" : ext));
    if (existsSync(fullPath)) return relative(projectDir, fullPath);
  }
  
  return null;
}

/**
 * Task 1: Extended Analyzer (Upgraded for Phase 33)
 */
export function analyzeFile(filePath, projectDir) {
  const fullPath = join(projectDir, filePath);
  const content = readFileSync(fullPath, "utf-8");
  const fileDir = dirname(filePath);

  const functions = content.match(/function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:async\s*)?function/g) || [];
  const classes = content.match(/class\s+(\w+)/g) || [];
  const exports = content.match(/export\s+|module\.exports|exports\./g) || [];

  // Phase 33: Extract Imports
  const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"](.*?)['"]/g);
  const requireMatches = content.matchAll(/require\(['"](.*?)['"]\)/g);
  
  const dependencies = [];
  for (const match of importMatches) {
    const normalized = normalizeImportPath(fileDir, match[1], projectDir);
    if (normalized) dependencies.push(normalized);
  }
  for (const match of requireMatches) {
    const normalized = normalizeImportPath(fileDir, match[1], projectDir);
    if (normalized) dependencies.push(normalized);
  }

  return {
    path: filePath,
    functions: functions.slice(0, 10), // Cap for index size
    classes: classes.slice(0, 5),
    hasExports: exports.length > 0,
    size: content.length,
    dependencies: [...new Set(dependencies)]
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
 * Task 1: Module Grouping (Phase 38)
 */
function detectModules(files) {
  const modules = {};
  files.forEach(f => {
    const lower = f.path.toLowerCase();
    let mod = "general";
    if (lower.includes("auth") || lower.includes("login")) mod = "authentication";
    else if (lower.includes("user")) mod = "users";
    else if (lower.includes("todo") || lower.includes("task")) mod = "todos";
    else if (lower.includes("pay") || lower.includes("billing")) mod = "payments";
    else if (lower.includes("api") || lower.includes("route")) mod = "api";
    
    if (!modules[mod]) modules[mod] = [];
    modules[mod].push(f.path);
  });
  return modules;
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
    modules: {}, // Phase 38
    dependencies: {}, // Phase 33
    reverseDependencies: {}, // Phase 34
    timestamp: new Date().toISOString(),
    projectDir
  };

  for (const file of files) {
    try {
      const analysis = analyzeFile(file, projectDir);
      knowledge.files.push(analysis);
      knowledge.dependencies[file] = analysis.dependencies;
    } catch {
      continue;
    }
  }

  // Phase 34: Build Reverse Map
  Object.entries(knowledge.dependencies).forEach(([file, deps]) => {
    deps.forEach(dep => {
      knowledge.reverseDependencies[dep] ??= [];
      if (!knowledge.reverseDependencies[dep].includes(file)) {
        knowledge.reverseDependencies[dep].push(file);
      }
    });
  });

  knowledge.modules = detectModules(knowledge.files);
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
