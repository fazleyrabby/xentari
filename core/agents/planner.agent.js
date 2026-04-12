import { chat } from "../llm.js";
import { getContext } from "../context.js";
import { detectTier } from "../tier.js";
import { log } from "../logger.js";
import { detectStack } from "../project/detector.js";
import { loadSession } from "../memory/session.js";

const BASE_SYSTEM = `You are a professional software architect and planner. Given a coding task, you must first REASON about the implementation and then produce a structured JSON plan.

REASONING RULES:
- Break the task into 3-5 clear, atomic steps.
- Identify the core files that need to be modified.
- Determine dependencies between steps (e.g., Step B needs Step A's export).
- Keep steps short and actionable.

IMPORTANT CONTEXT:
- Follow the project's established conventions and structure.
- Use the appropriate language and tools for the detected stack.
- DO NOT generate code in languages that do not match the project.

OUTPUT FORMAT:
Output ONLY a JSON object with a "steps" key containing the array of steps.
Each step MUST have:
- "id": unique integer starting from 1
- "step": a short implementation-focused description
- "files": array of keyword hints for relevant files
- "dependsOn": array of step IDs that MUST be completed before this step

STRICT RULES:
- Only include server-side/core implementation steps.
- DO NOT include frontend, UI, CSS, HTML, React, Vue, or Angular steps unless explicitly asked.
- DO NOT include testing steps unless the task explicitly asks for tests.
- DO NOT include deployment, CI/CD, or infrastructure steps.
- Each step must target a DIFFERENT file when possible.
- If a task is to create a new file, combine creation and content generation into ONE step.
- Each step must be a concrete code change, not a plan or review.
- Output ONLY valid JSON, no explanation, no markdown.

DEPENDENCY RULES:
- If Step B adds logic that depends on an export/definition from Step A → B dependsOn [A]
- If steps are independent → dependsOn must be []

FILE TARGETING RULES:
- Target the correct directories for the ecosystem (e.g., models/, services/, src/, etc.)
- New files: put in appropriate directories according to project conventions.`;

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

export async function plan(task, { metrics, projectDir } = {}) {
  const tier = detectTier();
  const complexity = detectComplexity(task);
  const maxSteps = tier === "small" ? 2 : tier === "medium" ? 3 : 4;

  const { context } = getContext(task, projectDir);
  
  // Task 4: Use Memory in Prompt (Phase 25)
  const session = loadSession();
  const memoryHint = session.history.length
    ? `\n[SESSION MEMORY] Recent task: ${session.history[0].task}. Modified files: ${session.history[0].files.join(", ")}`
    : "";
  
  // New Stack Detection (Task 1 & 5)
  const { stack, framework } = detectStack(projectDir || process.cwd());
  const stackHint = `This is a ${stack} project. Follow common conventions and best practices for this ecosystem.`;
  const frameworkHint = framework ? `Framework: ${framework}` : "";
  
  log.section("CONTEXT");
  log.info(`Stack detected: ${stack} ${framework ? `(${framework})` : ""}`);

  let system = `${context}${memoryHint}\n\n${stackHint}\n${frameworkHint}\n\n${BASE_SYSTEM}${TIER_RULES[tier]}`;

  if (complexity === "complex" && tier === "small") {
    system += `\n\nNOTE: This is a complex task. Create the smallest possible atomic steps with different target files.`;
  }

  const messages = [
    { role: "system", content: system },
    { role: "user", content: task },
  ];

  const raw = await chat(messages, { maxTokens: 600, metrics });

  try {
    const data = JSON.parse(extractJSON(raw));
    const stepsArray = data.steps || data;
    
    if (!Array.isArray(stepsArray)) throw new Error("Not an array");
    
    return stepsArray.slice(0, maxSteps).map((s) => ({
      id: Number(s.id || 0),
      step: String(s.step || s),
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
