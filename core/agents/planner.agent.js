import { chat } from "../llm.js";
import { getContext } from "../context.js";
import { detectTier } from "../tier.js";
import { log } from "../logger.js";

const BASE_SYSTEM = `You are a Node.js backend planner. Given a coding task, produce a JSON array of steps.

IMPORTANT CONTEXT:
- Project is Node.js with Express-style framework
- Use TypeScript (.ts) or JavaScript (.js) files
- Structure: models/, services/, routes/, controllers/
- DO NOT generate Ruby, Rails, Python, or any non-JavaScript code
- DO NOT create .rb, .py, or other non-JS files

Each step has:
- "id": unique integer starting from 1
- "step": a short implementation-focused description
- "files": array of keyword hints for relevant files
- "dependsOn": array of step IDs that MUST be completed before this step

STRICT RULES:
- Only include backend/server-side steps (models, services, routes, controllers, schemas, migrations, APIs)
- DO NOT include frontend, UI, CSS, HTML, React, Vue, or Angular steps
- DO NOT include testing steps unless the task explicitly asks for tests
- DO NOT include deployment, CI/CD, or infrastructure steps
- Each step must target a DIFFERENT file when possible
- If a task is to create a new file, combine creation and content generation into ONE step.
- Each step must be a concrete code change, not a plan or review
- Output ONLY valid JSON, no explanation, no markdown

DEPENDENCY RULES:
- If Step B adds logic that depends on an export from Step A → B dependsOn [A]
- If steps are independent → dependsOn must be []

FILE TARGETING RULES:
- User model → models/User.ts or src/models/User.ts
- Auth service → services/auth.service.ts or src/services/auth.service.ts
- API route → routes.ts or src/routes.ts
- New files: put in appropriate directories (models/, services/, etc.)`;

const TIER_RULES = {
  small: `\n\nIMPORTANT: Maximum 2 steps. Keep each step very simple — one file change per step. Focus on atomic, minimal changes.`,

  medium: `\n\nMaximum 3 steps. Keep steps focused and concrete.`,

  large: `\n\nUp to 4 steps allowed. Steps can involve multiple files and more complex implementations.`,
};

const COMPLEXITY_KEYWORDS = [
  "add feature", "create system", "implement", "build", "refactor",
  "multiple", "full", "complete", "end-to-end", "authentication",
  "database", "crud", "api", "rest", "service"
];

function detectComplexity(task) {
  const lower = task.toLowerCase();
  const matches = COMPLEXITY_KEYWORDS.filter(kw => lower.includes(kw));
  return matches.length >= 2 ? "complex" : "simple";
}

function extractJSON(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : raw.trim();
}

export async function plan(task, { metrics } = {}) {
  const tier = detectTier();
  const complexity = detectComplexity(task);
  const maxSteps = tier === "small" ? 2 : tier === "medium" ? 3 : 4;

  const { context, stack } = getContext(task);
  log.section("CONTEXT");
  log.info(`Stack detected: ${stack}`);

  let system = `${context}\n\n${BASE_SYSTEM}${TIER_RULES[tier]}`;

  if (complexity === "complex" && tier === "small") {
    system += `\n\nNOTE: This is a complex task. Create the smallest possible atomic steps with different target files.`;
  }

  const messages = [
    { role: "system", content: system },
    { role: "user", content: task },
  ];

  const raw = await chat(messages, { maxTokens: 400, metrics });

  try {
    const steps = JSON.parse(extractJSON(raw));
    if (!Array.isArray(steps)) throw new Error("Not an array");
    return steps.slice(0, maxSteps).map((s) => ({
      id: Number(s.id || 0),
      step: String(s.step || ""),
      files: Array.isArray(s.files) ? s.files.map(String) : [],
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(Number) : [],
    }));
  } catch {
    return [{ id: 1, step: task, files: [], dependsOn: [] }];
  }
}

export function getTierRules() {
  return TIER_RULES[detectTier()];
}
