import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { glob } from "glob";
import { loadConfig } from "./config.js";
import { getRecentFileNames } from "./memory.js";
import { getTierProfile } from "./tier.js";
import { getContext } from "./context.js";

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
  
  const singularMap = { models: "model", services: "service", controllers: "controller", routes: "route" };
  const typeName = singularMap[config.searchDirs[0]] || type;
  
  for (const ext of config.extensions) {
    for (const dir of config.searchDirs) {
      const fileName = `${name}.${ext}`;
      return { path: `${dir}/${fileName}`, isNew: true, suggestedType: type };
    }
  }
  
  return null;
}

function filenameScore(filePath, keywords) {
  const name = basename(filePath).toLowerCase();
  return keywords.reduce(
    (s, kw) => s + (name.includes(kw.toLowerCase()) ? 1 : 0),
    0
  );
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
  const { type, config } = typeInfo;
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

export async function retrieve(projectDir, keywords, extraBoostFiles = []) {
  const config = loadConfig();
  const profile = getTierProfile();
  const w = config.retrieverWeights;
  const recentFiles = getRecentFileNames();

  const maxFiles = profile.maxFiles;
  const maxChars = profile.maxFileChars;

  const task = keywords.join(" ");
  const typeInfo = detectType(keywords);

  const { stack } = getContext(task);
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

  const scored = files
    .filter(isSourceFile)
    .map((file) => {
      const fullPath = join(basePath, file);
      let content = "";
      try {
        content = readFileSync(fullPath, "utf-8").slice(0, maxChars);
      } catch {}

      const fnScore = filenameScore(file, keywords) * w.filename;
      const ctScore = contentScore(content, keywords) * w.content;
      const prScore = priorityScore(file) * w.priority;
      const memScore = memoryBonus(file, recentFiles) * w.memory;
      const boostScore = extraBoostFiles.includes(file) ? 5 : 0;
      const typeScore = typeBoost(file, typeInfo);

      return {
        file: stack !== "default" && basePath !== projectDir ? join(stack, file) : file,
        content,
        score: fnScore + ctScore + prScore + memScore + boostScore + typeScore,
        hasPriority: prScore > 0 || typeScore > 0,
      };
    });

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, maxFiles);

  const hasPriorityFile = top.some((f) => f.hasPriority);
  if (!hasPriorityFile) {
    const firstPriority = scored.find((f) => f.hasPriority && !top.includes(f));
    if (firstPriority && top.length > 0) {
      top[top.length - 1] = firstPriority;
    }
  }

  if (top.length === 0 && typeInfo) {
    const newFile = suggestNewFilePath(typeInfo, task);
    if (newFile) {
      return [{
        file: newFile.path,
        content: "",
        score: 10,
        isNew: true,
      }];
    }
  }

  return top.map(({ file, content, score, isNew }) => ({ 
    file, 
    content, 
    score,
    isNew: isNew || false,
  }));
}

export function getTypeSuggestions(typeInfo) {
  if (!typeInfo) return [];
  return typeInfo.config.searchDirs;
}