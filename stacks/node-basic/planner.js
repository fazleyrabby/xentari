import { chat } from "../../core/llm.js";
import { buildContext } from "../../core/context/buildContext.ts";
import { detectTier } from "../../core/tier.js";
import { log } from "../../core/logger.js";
import { loadHistory } from "../../core/session/store.ts";
import { getIntelligence } from "../../core/memory.js";

const BASE_SYSTEM = `You are a professional software architect and planner. Given a coding task, you must REASON about the implementation and then produce a structured JSON execution plan.

PLANNING RULES:
- Break the task into 3-6 clear, atomic steps.
- Each step must have a specific "type" and "target".
- Identify dependencies (e.g., Step B depends on Step A's export).
- Keep targets concise.

ALLOWED STEP TYPES:
- analyze: examine existing code/structure
- read: read specific file contents
- modify: update existing file
- create: create a new file
- refactor: restructure code without changing behavior
- verify: check results or run tests

E3 — Structure Enforcement
If a step creates or modifies a core component, you MUST assign a "role" and "pattern" if applicable.
ROLES: model | service | controller | routes | config
PATTERNS: model | service | controller | routes

Example Step:
{
  "id": 2,
  "type": "create",
  "target": "controllers/user.controller.js",
  "role": "controller",
  "pattern": "controller",
  "testCode": "assert.ok(target.handleRequest);",
  "intent": {
    "type": "add",
    "scope": "file",
    "description": "Create controller to handle user requests"
  },
  "dependsOn": [1]
}

IMPORTANT CONTEXT:
- Follow the project's established conventions and structure.
- Use the appropriate language and tools for the detected stack (Node.js/JavaScript).
- DO NOT generate code in languages that do not match the project.
- If a step is critical, provide a minimal 'testCode' (JavaScript) to verify the implementation.
- Every step MUST include an 'intent' object describing the PURPOSE and SCOPE of the change.

ALLOWED INTENT TYPES: modify | refactor | add | remove
ALLOWED INTENT SCOPES: file | module | system

OUTPUT FORMAT:
Output ONLY a JSON object with a "steps" key containing the array of steps.
Each step MUST have:
- "id": unique integer starting from 1
- "type": one of the allowed step types listed above
- "target": a short implementation-focused description or file path
- "intent": an object with "type", "scope", and "description"
- "dependsOn": array of step IDs that MUST be completed before this step
- "testCode": (optional) a string containing a minimal JS test using 'assert' and the 'target' module.

STRICT RULES:
- Only include server-side/core implementation steps.
- Each step must be a concrete action, not a broad plan.
- Output ONLY valid JSON, no explanation, no markdown.

DEPENDENCY RULES:
- If Step B adds logic that depends on an export/definition from Step A → B dependsOn [A]
- If steps are independent → dependsOn must be []

FILE TARGETING RULES:
- Target the correct directories for the ecosystem.
- New files: put in appropriate directories according to project conventions.`;

const TIER_RULES = {
  small: `\n\nIMPORTANT: Maximum 3 steps. Keep each step very simple.`,
  medium: `\n\nMaximum 4 steps. Keep steps focused and concrete.`,
  large: `\n\nUp to 6 steps allowed.`,
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

export async function generatePlan({ instruction, context: extraContext, metrics, projectDir }) {
  const tier = detectTier();
  const complexity = detectComplexity(instruction);
  const maxSteps = tier === "small" ? 3 : tier === "medium" ? 4 : 6;

  const contextData = buildContext(projectDir);
  const context = `FILES TO LOOK AT:\n${contextData.files.join(", ")}\n\nSNIPPETS:\n${contextData.snippets.map((s: any) => `=== ${s.path} ===\n${s.content}`).join("\n\n")}`;
  
  const historyData = loadHistory(projectDir);
  const memoryHint = historyData.history.length
    ? `\n[SESSION MEMORY] Recent task: ${historyData.history[0].task}. Modified files: ${historyData.history[0].files.join(", ")}`
    : "";
  
  const intel = getIntelligence();
  let biasHint = "";
  if (intel.successfulPatterns && intel.successfulPatterns.length > 0) {
    biasHint += `\n[INTELLIGENCE] Successful past patterns: ${intel.successfulPatterns.slice(-3).map(p => p.step).join(", ")}`;
  }
  if (intel.failedPatterns && intel.failedPatterns.length > 0) {
    biasHint += `\n[INTELLIGENCE] Avoid these previously failed files/approaches: ${intel.failedPatterns.slice(-3).map(p => p.step).join(", ")}`;
  }

  const stackHint = `This is a Node.js project. Follow common conventions and best practices for this ecosystem.`;
  
  log.info(`[STACK] Generating plan for node-basic...`);

  let system = `${context}${memoryHint}${biasHint}\n\n${stackHint}\n\n${BASE_SYSTEM}${TIER_RULES[tier]}`;

  if (complexity === "complex" && tier === "small") {
    system += `\n\nNOTE: This is a complex task. Create atomic steps with different target files.`;
  }

  const messages = [
    { role: "system", content: system },
    { role: "user", content: instruction },
  ];

  let raw = await chat(messages, { maxTokens: 600, metrics });

  try {
    let data;
    try {
      data = JSON.parse(extractJSON(raw));
    } catch (e) {
      log.warn("[PLANNER] Invalid JSON output, retrying once...");
      raw = await chat([...messages, { role: "assistant", content: raw }, { role: "user", content: "Invalid JSON. Return ONLY valid JSON object with 'steps' key." }], { maxTokens: 600, metrics });
      data = JSON.parse(extractJSON(raw));
    }

    const stepsArray = data.steps || data;
    
    if (!Array.isArray(stepsArray)) throw new Error("Not an array");
    
    const validatedSteps = stepsArray.slice(0, maxSteps).map((s) => ({
      id: Number(s.id || 0),
      type: String(s.type || "modify"),
      target: String(s.target || s.step || s),
      files: Array.isArray(s.files) ? s.files.map(String) : [],
      dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(Number) : [],
      role: s.role ? String(s.role) : undefined,
      pattern: s.pattern ? String(s.pattern) : undefined,
      testCode: s.testCode ? String(s.testCode) : undefined,
      intent: s.intent || { type: "modify", scope: "file", description: s.target || "Automated update" }
    }));

    // Enforce validation: step.target is missing
    for (const step of validatedSteps) {
      if (!step.target || step.target === "undefined" || step.target === "") {
        throw new Error(`INVALID_PLAN_STEP: Step ${step.id} has no target.`);
      }
    }

    return validatedSteps;
  } catch (err) {
    log.error(`[PLANNER] Failed to generate plan: ${err.message}`);
    return [{ id: 1, type: "modify", target: instruction, files: [], dependsOn: [], intent: { type: "modify", scope: "file", description: "Default fallback step" } }];
  }
}
