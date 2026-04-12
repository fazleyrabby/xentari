import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, basename, extname, dirname, relative } from "node:path";
import { glob } from "glob";
import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { safePath } from "./project/guard.js";

// Phase 33+ TypeScript Types
export type IndexEntry = {
  file: string;
  functions: string[];
  imports: string[];
  domain?: string;
  classes?: string[];
  hasExports?: boolean;
  size?: number;
  dependencies?: string[];
};

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
function normalizeImportPath(baseDir: string, importPath: string, projectDir: string): string | null {
  if (!importPath.startsWith(".")) return null; // Skip packages
  
  const absolutePath = join(projectDir, baseDir, importPath);
  const extensions = [".js", ".ts", ".jsx", ".tsx", "/index.js", "/index.ts"];
  
  // Try direct path first
  if (existsSync(absolutePath) && !statSync(absolutePath).isDirectory()) {
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
export function analyzeFile(filePath: string, projectDir: string): IndexEntry {
  const fullPath = join(projectDir, filePath);
  const content = readFileSync(fullPath, "utf-8");
  const fileDir = dirname(filePath);

  const functions = content.match(/function\s+(\w+)|(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:async\s*)?function/g) || [];
  const classes = content.match(/class\s+(\w+)/g) || [];
  const exports = content.match(/export\s+|module\.exports|exports\./g) || [];

  // Phase 33: Extract Imports
  const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"](.*?)['"]/g);
  const requireMatches = content.matchAll(/require\(['"](.*?)['"]\)/g);
  
  const dependencies: string[] = [];
  const rawImports: string[] = [];

  for (const match of importMatches) {
    rawImports.push(match[1]);
    const normalized = normalizeImportPath(fileDir, match[1], projectDir);
    if (normalized) dependencies.push(normalized);
  }
  for (const match of requireMatches) {
    rawImports.push(match[1]);
    const normalized = normalizeImportPath(fileDir, match[1], projectDir);
    if (normalized) dependencies.push(normalized);
  }

  return {
    file: filePath,
    functions: functions.slice(0, 10), // Cap for index size
    imports: rawImports,
    classes: classes.slice(0, 5),
    hasExports: exports.length > 0,
    size: content.length,
    dependencies: [...new Set(dependencies)]
  };
}

/**
 * Task 2: Entry Point Detection
 */
export function detectEntryPoints(files: IndexEntry[]): string[] {
  return files
    .filter(f => 
      f.file.includes("app.js") || f.file.includes("app.ts") ||
      f.file.includes("server.js") || f.file.includes("server.ts") ||
      f.file.includes("main.js") || f.file.includes("main.ts") ||
      f.file.includes("index.js") || f.file.includes("index.ts")
    )
    .map(f => f.file);
}

/**
 * Task 3: Framework Detection (Light)
 */
export function detectFramework(projectDir: string): string | null {
  const exists = (f: string) => existsSync(join(projectDir, f));
  if (exists("artisan")) return "laravel";
  if (exists("next.config.js") || exists("next.config.mjs")) return "nextjs";
  if (exists("manage.py")) return "django";
  if (exists("package.json")) return "node";
  return null;
}

/**
 * Task 1: Module Grouping (Phase 38)
 */
function detectModules(files: IndexEntry[]): Record<string, string[]> {
  const modules: Record<string, string[]> = {};
  files.forEach(f => {
    const lower = f.file.toLowerCase();
    let mod = "general";
    if (lower.includes("auth") || lower.includes("login")) mod = "authentication";
    else if (lower.includes("user")) mod = "users";
    else if (lower.includes("todo") || lower.includes("task")) mod = "todos";
    else if (lower.includes("pay") || lower.includes("billing")) mod = "payments";
    else if (lower.includes("api") || lower.includes("route")) mod = "api";
    
    if (!modules[mod]) modules[mod] = [];
    modules[mod].push(f.file);
  });
  return modules;
}

/**
 * Task 1: System Flow Detection (Phase 42)
 */
function detectFlows(modules: Record<string, string[]>): Record<string, { flow: string[] }> {
  const flows: Record<string, { flow: string[] }> = {};
  
  Object.entries(modules).forEach(([modName, files]) => {
    const sorted = [...files].sort((a, b) => {
      const getRank = (p: string) => {
        if (p.includes("route")) return 1;
        if (p.includes("controller")) return 2;
        if (p.includes("service")) return 3;
        if (p.includes("model") || p.includes("schema")) return 4;
        return 5;
      };
      return getRank(a) - getRank(b);
    });
    
    flows[modName] = {
      flow: sorted
    };
  });
  
  return flows;
}

/**
 * Task 2: Build Indexer
 * Scans project and builds knowledge.json
 */
export async function indexProject(projectDir: string) {
  const config = loadConfig();
  log.info("[INDEXER] Building knowledge index...");
  
  const files = await glob("**/*.*", {
    cwd: projectDir,
    ignore: IGNORE,
    nodir: true,
  });

  const knowledge: {
    framework: string | null;
    entryPoints: string[];
    files: IndexEntry[];
    domains: Record<string, string[]>;
    modules: Record<string, string[]>;
    flows: Record<string, { flow: string[] }>;
    dependencies: Record<string, string[]>;
    reverseDependencies: Record<string, string[]>;
    timestamp: string;
    projectDir: string;
  } = {
    framework: detectFramework(projectDir),
    entryPoints: [],
    files: [],
    domains: {},
    modules: {}, // Phase 38
    flows: {}, // Phase 42
    dependencies: {}, // Phase 33
    reverseDependencies: {}, // Phase 34
    timestamp: new Date().toISOString(),
    projectDir
  };

  for (const file of files) {
    try {
      const analysis = analyzeFile(file, projectDir);
      knowledge.files.push(analysis);
      knowledge.dependencies[file] = analysis.dependencies || [];
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
  knowledge.flows = detectFlows(knowledge.modules);
  knowledge.entryPoints = detectEntryPoints(knowledge.files);

  const xentariDir = join(projectDir, ".xentari");
  if (!existsSync(xentariDir)) mkdirSync(xentariDir, { recursive: true });

  const knowledgePath = join(xentariDir, "knowledge.json");
  const indexPath = join(xentariDir, "index.json");
  
  writeFileSync(knowledgePath, JSON.stringify(knowledge, null, 2));
  writeFileSync(indexPath, JSON.stringify(knowledge, null, 2));
  
  // Phase 52: Auto-add to gitignore
  const gitignorePath = join(projectDir, ".gitignore");
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, "utf-8");
    if (!content.includes(".xentari/")) {
      writeFileSync(gitignorePath, content + "\n.xentari/\n");
    }
  }

  log.ok(`[INDEXER] Indexed ${knowledge.files.length} files. Framework: ${knowledge.framework || 'unknown'}`);
  return knowledge;
}

export function loadIndex(projectDir: string = loadConfig().root) {
  const knowledgePath = join(projectDir, ".xentari", "knowledge.json");
  const indexPath = join(projectDir, ".xentari", "index.json");
  
  const path = existsSync(knowledgePath) ? knowledgePath : (existsSync(indexPath) ? indexPath : null);
  if (!path || !existsSync(path)) return null;
  
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}
