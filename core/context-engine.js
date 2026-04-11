import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadIndex } from "./indexer.js";

function safeRead(filePath) {
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf-8");
}

function trimContext(str, max = 3000) {
  if (str.length <= max) return str;
  return str.slice(0, max);
}

export function loadContextConfig(root) {
  const configPath = join(root, "xen.context.json");
  if (!existsSync(configPath)) {
    throw new Error("xen.context.json not found");
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

export function detectStack(task, config) {
  const lower = task.toLowerCase();

  for (const [name, stack] of Object.entries(config.stacks)) {
    if (lower.includes(name)) return name;
  }

  return config.defaultStack;
}

function buildProjectOverview(index) {
  if (!index || !index.files || index.files.length === 0) return "";
  
  let overview = "Project contains:\n";
  const filesByDir = {};
  
  for (const file of index.files) {
    const dir = file.path.split("/")[0] || "root";
    if (!filesByDir[dir]) filesByDir[dir] = [];
    if (filesByDir[dir].length < 3) {
      filesByDir[dir].push(file.path.split("/").pop());
    }
  }
  
  for (const [dir, files] of Object.entries(filesByDir)) {
    overview += `- ${dir}/: ${files.join(", ")}${files.length === 3 ? "..." : ""}\n`;
    if (overview.length > 400) break;
  }
  
  return overview.slice(0, 500);
}

export function buildContext({ root, task }) {
  const config = loadContextConfig(root);
  const index = loadIndex();

  const stackName = detectStack(task, config);
  const stack = config.stacks[stackName];

  const globalCtx = safeRead(join(root, config.globalContext));
  const stackCtx = safeRead(join(root, stack.context));
  const rulesCtx = safeRead(join(root, config.rules));
  const projectOverview = buildProjectOverview(index);

  const combined = `
# GLOBAL CONTEXT
${globalCtx}

# PROJECT OVERVIEW
${projectOverview}

# STACK CONTEXT (${stackName})
${stackCtx}

# RULES
${rulesCtx}
`;

  return {
    context: trimContext(combined.trim()),
    stack: stackName
  };
}
