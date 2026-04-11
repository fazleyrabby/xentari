# 🧠 Phase 8 — Context Engine (Auto Stack Detection + Dynamic Loading)

You are a senior Node.js engineer working on an AI CLI tool.

Your task is to implement a **Context Engine** that dynamically loads the correct context based on project structure and task intent.

⚠️ STRICT RULES:
- DO NOT refactor existing pipeline
- DO NOT change planner/retriever core logic
- ONLY extend context loading mechanism
- Keep implementation minimal and deterministic
- Must work with small models (low token usage)

---

# 🎯 GOAL

Replace static context loading with:

dynamic context = global + stack-specific + rules

---

# 🧩 TARGET BEHAVIOR

Instead of:
summary.md → always loaded

New behavior:

1. Detect stack (backend / frontend / etc.)
2. Load:
   - context/global.md
   - context/<stack>.md
   - context/rules.md
3. Combine into single prompt context

---

# 🔧 TASK 1 — Create Context Config

## File: ai.context.json

~~~json
{
  "defaultStack": "backend",
  "stacks": {
    "backend": {
      "path": "backend",
      "context": "context/backend.md"
    },
    "frontend": {
      "path": "frontend",
      "context": "context/frontend.md"
    }
  },
  "globalContext": "context/global.md",
  "rules": "context/rules.md"
}
~~~

---

# 🔧 TASK 2 — Create Context Engine

## File: core/context-engine.js

~~~js
import { readFileSync, existsSync } from "fs";
import path from "path";

function safeRead(filePath) {
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf-8");
}

export function loadContextConfig(root) {
  const configPath = path.join(root, "ai.context.json");
  if (!existsSync(configPath)) {
    throw new Error("ai.context.json not found");
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

export function buildContext({ root, task }) {
  const config = loadContextConfig(root);

  const stackName = detectStack(task, config);
  const stack = config.stacks[stackName];

  const globalCtx = safeRead(path.join(root, config.globalContext));
  const stackCtx = safeRead(path.join(root, stack.context));
  const rulesCtx = safeRead(path.join(root, config.rules));

  const combined = `
# GLOBAL CONTEXT
${globalCtx}

# STACK CONTEXT (${stackName})
${stackCtx}

# RULES
${rulesCtx}
`;

  return {
    context: combined.trim(),
    stack: stackName
  };
}
~~~

---

# 🔧 TASK 3 — Replace Old Context Loader

## File: core/context.js

Replace ALL logic with:

~~~js
import { buildContext } from "./context-engine.js";
import { loadConfig } from "./config.js";

export function getContext(task) {
  const config = loadConfig();
  const root = config.root;

  const { context, stack } = buildContext({ root, task });

  return { context, stack };
}
~~~

---

# 🔧 TASK 4 — Inject Context into LLM Calls

## File: core/planner.js, coder.js, reviewer.js

Update prompt construction:

~~~js
const { context } = getContext(task);

const messages = [
  {
    role: "system",
    content: context
  },
  {
    role: "user",
    content: task
  }
];
~~~

---

# 🔧 TASK 5 — Stack-Aware Retriever

## File: core/retriever.js

Before scanning files:

~~~js
import { getContext } from "./context.js";

const { stack } = getContext(task);

let basePath = projectDir;

if (stack === "backend") {
  basePath = path.join(projectDir, "backend");
}

if (stack === "frontend") {
  basePath = path.join(projectDir, "frontend");
}
~~~

Use basePath instead of full project scan.

---

# 🔧 TASK 6 — Logging

~~~js
log.section("CONTEXT");
log.info(`Stack detected: ${stack}`);
~~~

---

# 🔧 TASK 7 — Fallback Safety

If stack context missing:

~~~js
if (!stackCtx) {
  log.warn("Missing stack context file, using global only");
}
~~~

---

# 🔧 TASK 8 — Token Optimization (IMPORTANT)

Limit context size:

~~~js
function trimContext(str, max = 3000) {
  if (str.length <= max) return str;
  return str.slice(0, max);
}
~~~

Apply before returning context.

---

# ✅ EXPECTED RESULT

- Context adapts per task
- Backend tasks only use backend context
- No cross-stack contamination
- Smaller prompts → better local model performance
- System scales to multi-stack projects

---

# 🚫 DO NOT

- Load all context files blindly
- Hardcode stack paths
- Increase prompt size unnecessarily
- Add complex NLP for detection (keep simple)

---

# 🧠 SUCCESS CRITERIA

- Backend task → only backend context loaded
- Frontend task → only frontend context loaded
- Missing context → safe fallback
- Logs show detected stack
- Prompt size reduced vs previous version

---

Implement exactly as specified.