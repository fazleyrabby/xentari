// ⚠️ LEGACY MODULE — scheduled for deprecation after retrieval stabilization
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";
import { loadIndex } from "./index.ts";
import { retrieveKnowledge } from "./rag.js";

function buildProjectOverview(projectDir) {
  const index = loadIndex(projectDir);
  if (!index) return "";

  const files = index.files.slice(0, 10);
  const overview = files.map(f => `- ${f.file}: [${f.functions.join(", ")}]`).join("\n");
  
  return `\n# PROJECT OVERVIEW\nProject contains:\n${overview}\n`;
}

function trimContext(text, maxChars = 3000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n... [TRUNCATED]";
}

/**
 * Task 7: Inject into Context
 */
function buildKnowledgeContext(task, projectDir) {
  const knowledge = retrieveKnowledge(task, projectDir);
  if (knowledge.length === 0) return "";

  const context = knowledge.map(f => `- ${f.file}: [${f.functions.join(", ")}]`).join("\n");
  return `\n# RELEVANT PROJECT KNOWLEDGE\n${context}\n`;
}

function buildDependencyContext(projectDir) {
  const pkgPath = join(projectDir, "package.json");
  if (!existsSync(pkgPath)) return "";
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const list = Object.keys(deps).join(", ");
    return `\n# PROJECT DEPENDENCIES\nInstalled: ${list}\n`;
  } catch {
    return "";
  }
}

export function buildDynamicContext(task, projectDir = process.cwd()) {
  const config = loadConfig();
  const contextDir = join(projectDir, "context");
  
  let dynamicContext = "";

  // Load Global Context
  const globalPath = join(contextDir, "global.md");
  if (existsSync(globalPath)) {
    dynamicContext += `# GLOBAL CONTEXT\n${readFileSync(globalPath, "utf-8")}\n`;
  }

  // Dependencies (Anti-Hallucination)
  dynamicContext += buildDependencyContext(projectDir);

  // Project Overview
  dynamicContext += buildProjectOverview(projectDir);


  // RAG Knowledge (Task 7)
  dynamicContext += buildKnowledgeContext(task, projectDir);

  // Stack Detection
  const { stack } = detectStack(task, projectDir);
  const stackPath = join(contextDir, `${stack}.md`);
  if (existsSync(stackPath)) {
    dynamicContext += `\n# STACK CONTEXT (${stack})\n${readFileSync(stackPath, "utf-8")}\n`;
  }

  // Rules
  const rulesPath = join(contextDir, "rules.md");
  if (existsSync(rulesPath)) {
    dynamicContext += `\n# RULES\n${readFileSync(rulesPath, "utf-8")}\n`;
  }

  return {
    context: trimContext(dynamicContext),
    stack
  };
}

function xenContextPathName(projectDir) {
  // Check both legacy and new names
  return existsSync(join(projectDir, "xen.context.json")) ? "xen.context.json" : "xen.config.json";
}

function detectStack(task, projectDir) {
  const configPath = join(projectDir, xenContextPathName(projectDir));
  if (!existsSync(configPath)) return { stack: "default" };

  try {
    const contextMap = JSON.parse(readFileSync(configPath, "utf-8"));
    const lowerTask = task.toLowerCase();

    for (const [stack, info] of Object.entries(contextMap.stacks)) {
      if (info.keywords && info.keywords.some(kw => lowerTask.includes(kw))) {
        return { stack, info };
      }
    }
  } catch {}

  return { stack: "default" };
}
