// ⚠️ LEGACY MODULE — scheduled for deprecation after retrieval stabilization
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { glob } from "glob";
import { loadConfig } from "./config.js";
import { getRecentFileNames } from "./memory.js";
import { getTierProfile } from "./tier.js";
import { getContext } from "./context.js";
import { loadIndex } from "./index.ts";
import { chunkText, selectRelevantChunks, buildContextWindow } from "./chunker.js";
import { retrieveKnowledge } from "./rag.js";
import { safePath } from "./project/guard.js";

const IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/logs/**",
  "**/context/**",
  "**/*.lock",
  "**/temp.patch",
  "**/xen.config.json",
  "**/config.json",
  "**/*.md",
  "**/*.log",
];

const TYPE_PATTERNS = {
  model: {
    keywords: ["model", "schema", "entity"],
    searchDirs: ["models", "src/models", "backend/models", "backend/src/models"],
    extensions: ["ts", "js"],
    priority: 5,
  },
  service: {
    keywords: ["service", "business", "logic"],
    searchDirs: ["services", "src/services", "backend/services", "backend/src/services"],
    extensions: ["ts", "js"],
    priority: 4,
  },
  controller: {
    keywords: ["controller", "handler", "endpoint"],
    searchDirs: ["controllers", "src/controllers", "backend/controllers", "backend/src/controllers"],
    extensions: ["ts", "js"],
    priority: 3,
  },
  route: {
    keywords: ["route", "router", "endpoint", "api"],
    searchDirs: ["routes", "src/routes", "backend/routes"],
    files: ["routes.ts", "routes.js", "router.ts", "router.js"],
    priority: 3,
  },
  middleware: {
    keywords: ["middleware", "auth", "guard"],
    searchDirs: ["middleware", "middlewares", "src/middleware"],
    priority: 3,
  },
  util: {
    keywords: ["util", "helper", "lib"],
    searchDirs: ["utils", "helpers", "lib", "src/utils"],
    priority: 2,
  },
};

const PRIORITY_EXTENSIONS = {
  schema: 5,
  model: 5,
  migration: 5,
  service: 4,
  repository: 4,
  controller: 3,
  route: 3,
  handler: 3,
  middleware: 3,
  helper: 2,
  util: 1,
  utils: 1,
  test: 1,
  spec: 1,
};

function detectType(keywords) {
  const lowerKeywords = keywords.map(k => k.toLowerCase());
  
  for (const [type, config] of Object.entries(TYPE_PATTERNS)) {
    for (const kw of config.keywords) {
      if (lowerKeywords.some(lk => lk.includes(kw))) {
        return { type, config };
      }
    }
  }
  
  return null;
}

function suggestNewFilePath(typeInfo, task) {
  if (!typeInfo) return null;
  
  const { type, config } = typeInfo;
  const taskWords = task.toLowerCase().split(/\s+/);
  const name = taskWords.find(w => w.length > 2 && !["add", "create", "new", "the", "file"].includes(w)) || "item";
  
  for (const ext of config.extensions) {
    for (const dir of config.searchDirs) {
      return { path: `${dir}/${name}.${ext}`, isNew: true, suggestedType: type };
    }
  }
  
  return null;
}

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function semanticScore(taskTokens, fileEntry) {
  if (!fileEntry) return 0;
  
  let score = 0;
  const summaryTokens = tokenize(fileEntry.summary || "");
  const exportTokens = (fileEntry.exports || []).flatMap(e => tokenize(e));
  
  // Summary overlap
  for (const token of taskTokens) {
    if (summaryTokens.includes(token)) score += 2;
    if (exportTokens.includes(token)) score += 3;
  }
  
  return score;
}

function filenameScore(file, keywords) {
  let score = 0;
  const lowerFile = file.toLowerCase();
  const lowerBase = basename(file).toLowerCase();
  
  for (const kw of keywords) {
    const lowerKw = kw.toLowerCase();
    if (lowerKw.length < 2) continue;
    if (lowerBase === lowerKw) {
      score += 10;
    } else if (lowerBase.includes(lowerKw)) {
      score += 5;
    } else if (lowerFile.includes(lowerKw)) {
      score += 3;
    }
  }
  return score;
}

function contentScore(content, keywords) {
  const lower = content.toLowerCase();
  return keywords.reduce((s, kw) => {
    const kwLower = kw.toLowerCase();
    if (kwLower.length < 2) return s;
    let count = 0;
    let idx = 0;
    while ((idx = lower.indexOf(kwLower, idx)) !== -1) {
      count++;
      idx += kwLower.length;
    }
    return s + Math.min(count, 5);
  }, 0);
}

function priorityScore(filePath) {
  const name = basename(filePath).toLowerCase();
  for (const [key, weight] of Object.entries(PRIORITY_EXTENSIONS)) {
    if (name.includes(key)) return weight;
  }
  return 0;
}

function typeBoost(filePath, typeInfo) {
  if (!typeInfo) return 0;
  const { config } = typeInfo;
  const dir = dirname(filePath).split("/").pop();
  return config.searchDirs.some(d => dir === d.split("/").pop()) ? config.priority : 0;
}

function memoryBonus(filePath, recentFiles) {
  return recentFiles.includes(filePath) ? 3 : 0;
}

function isSourceFile(filePath) {
  const ext = filePath.split(".").pop().toLowerCase();
  const sourceExts = ["js", "mjs", "cjs", "ts", "mts", "jsx", "tsx", "json", "sql", "py", "go", "rs", "java", "kt", "swift", "c", "cpp", "h"];
  return sourceExts.includes(ext);
}

function detectModule(task) {
  const lower = task.toLowerCase();
  if (lower.includes("auth") || lower.includes("login")) return "authentication";
  if (lower.includes("todo") || lower.includes("task")) return "todos";
  if (lower.includes("user")) return "users";
  if (lower.includes("pay") || lower.includes("billing")) return "payments";
  if (lower.includes("api") || lower.includes("route")) return "api";
  return null;
}

export async function retrieve(projectDir, keywords, extraBoostFiles = [], { metrics } = {}) {
  const config = loadConfig();
  const profile = getTierProfile();
  const w = config.retrieverWeights || { filename: 2, content: 1, priority: 1.5, memory: 1 };
  const recentFiles = getRecentFileNames();
  const index = loadIndex();

  const maxFiles = profile.maxFiles;
  const maxChars = profile.maxFileChars;

  const task = keywords.join(" ");
  const taskTokens = tokenize(task);
  const typeInfo = detectType(keywords);
  
  // Task 8: Retrieve RAG knowledge for boosting
  const ragKnowledge = retrieveKnowledge(task);
  const ragFiles = ragKnowledge.map(f => f.path);

  const { stack } = getContext(task, projectDir);
  let basePath = projectDir;

  if (stack === "backend" && existsSync(join(projectDir, "backend"))) {
    basePath = join(projectDir, "backend");
  } else if (stack === "frontend" && existsSync(join(projectDir, "frontend"))) {
    basePath = join(projectDir, "frontend");
  }

  const files = await glob("**/*.*", {
    cwd: basePath,
    ignore: IGNORE,
    nodir: true,
  });

  // Pass 1: Quick scoring based on metadata
  const candidates = files
    .filter(isSourceFile)
    .map((file) => {
      const relativeFile = stack !== "default" && basePath !== projectDir ? join(stack, file) : file;
      const indexEntry = index?.files.find(f => f.path === relativeFile);

      const fnScore = filenameScore(file, keywords) * w.filename;
      const prScore = priorityScore(file) * w.priority;
      const memScore = memoryBonus(relativeFile, recentFiles) * w.memory;
      const boostScore = extraBoostFiles.includes(relativeFile) ? 5 : 0;
      
      // RAG Boost (Task 8)
      const ragBoost = ragFiles.includes(relativeFile) ? 10 : 0;
      
      const typeScore = typeBoost(file, typeInfo);
      const semScore = semanticScore(taskTokens, indexEntry);

      let fullPath;
      try {
        fullPath = safePath(basePath, file);
      } catch {
        return null;
      }

      return {
        file: relativeFile,
        fullPath,
        score: fnScore + prScore + memScore + boostScore + ragBoost + typeScore + semScore,
        hasPriority: prScore > 0 || typeScore > 0 || semScore > 5 || ragBoost > 0,
      };
    }).filter(c => c !== null);

  // Sort and take top candidates for content analysis
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, maxFiles * 2);

  // Pass 2: Content analysis and chunking for top candidates
  const scored = topCandidates.map((c) => {
    let content = "";
    let ctScore = 0;
    try {
      const rawContent = readFileSync(c.fullPath, "utf-8");
      
      if (rawContent.length > maxChars) {
        const chunks = chunkText(rawContent, 800);
        const selected = selectRelevantChunks(chunks, task, profile.maxChunks);
        content = buildContextWindow(selected);
        // Score content based on selected chunks
        ctScore = contentScore(content, keywords) * w.content;
      } else {
        content = rawContent;
        ctScore = contentScore(content, keywords) * w.content;
      }
    } catch {}

    return {
      ...c,
      content,
      score: c.score + ctScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxFiles);

  if (top.length === 0 && typeInfo) {
    const newFile = suggestNewFilePath(typeInfo, task);
    if (newFile) {
      top.push({
        file: newFile.path,
        content: "",
        score: 10,
        isNew: true,
      });
    }
  }

  // Phase 35: Multi-File Retrieval (Dependency Expansion)
  const finalFiles = [...top];
  if (index && top.length > 0 && top.length < 5) {
    const mainFile = top[0].file;
    const deps = index.dependencies[mainFile] || [];
    const reverse = index.reverseDependencies[mainFile] || [];
    
    const relatedPaths = [...deps.slice(0, 2), ...reverse.slice(0, 2)];
    
    for (const relPath of relatedPaths) {
      if (finalFiles.length >= 5) break;
      if (finalFiles.some(f => f.file === relPath)) continue;
      
      try {
        const fullPath = safePath(projectDir, relPath);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, "utf-8");
          finalFiles.push({
            file: relPath,
            content: content.slice(0, profile.maxFileChars),
            score: 5,
            isRelated: true
          });
        }
      } catch {}
    }
  }

  // Phase 41: Module-Aware Retrieval
  const targetModule = detectModule(task);
  if (targetModule && index?.modules && index.modules[targetModule]) {
    const moduleFiles = index.modules[targetModule].slice(0, 3);
    for (const modFile of moduleFiles) {
      if (finalFiles.length >= 5) break;
      if (finalFiles.some(f => f.file === modFile)) continue;
      
      try {
        const fullPath = safePath(projectDir, modFile);
        if (existsSync(fullPath)) {
          const content = readFileSync(fullPath, "utf-8");
          finalFiles.push({
            file: modFile,
            content: content.slice(0, profile.maxFileChars),
            score: 8, // Higher than related, lower than primary
            isModuleContext: true
          });
        }
      } catch {}
    }
  }

  if (metrics) {
    metrics.filesUsed = finalFiles.length;
    metrics.files = finalFiles.map(f => f.file);
    // Track chunks only for final selected files
    metrics.chunksUsed = finalFiles.reduce((sum, f) => {
      if (f.content.includes("... [CHUNK BOUNDARY] ...")) {
        return sum + f.content.split("... [CHUNK BOUNDARY] ...").length;
      }
      return sum;
    }, 0);
    // Track RAG matches
    metrics.ragMatches = finalFiles.filter(f => ragFiles.includes(f.file)).map(f => f.file);
  }

  const hasPriorityFile = finalFiles.some((f) => f.hasPriority);
  if (!hasPriorityFile && scored.length > top.length) {
    const firstPriority = scored.find((f) => f.hasPriority && !finalFiles.includes(f));
    if (firstPriority && finalFiles.length > 0) {
      finalFiles[finalFiles.length - 1] = firstPriority;
    }
  }

  return finalFiles.map(({ file, content, score, isNew, isRelated, isModuleContext }) => ({ 
    file, 
    content, 
    score,
    isNew: isNew || false,
    isRelated: isRelated || false,
    isModuleContext: isModuleContext || false
  }));
}

export function getTypeSuggestions(typeInfo) {
  if (!typeInfo) return [];
  return typeInfo.config.searchDirs;
}
