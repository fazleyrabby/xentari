import { chat } from "../llm.js";
import { getContext } from "../context.js";
import { detectTier } from "../tier.js";
import { log } from "../logger.js";
import { detectStack } from "../project/detector.js";
import { loadSession } from "../memory/session.js";
import { getIntelligence } from "../memory.js";
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

IMPORTANT CONTEXT:
- Follow the project's established conventions and structure.
- Use the appropriate language and tools for the detected stack.
- DO NOT generate code in languages that do not match the project.

OUTPUT FORMAT:
Output ONLY a JSON object with a "steps" key containing the array of steps.
Each step MUST have:
- "id": unique integer starting from 1
- "type": one of the allowed step types listed above
- "target": a short implementation-focused description or file path
- "dependsOn": array of step IDs that MUST be completed before this step

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
export async function plan(task, { metrics, projectDir } = {}) {
    const tier = detectTier();
    const complexity = detectComplexity(task);
    const maxSteps = tier === "small" ? 3 : tier === "medium" ? 4 : 6;
    const { context } = getContext(task, projectDir);
    const session = loadSession();
    const memoryHint = session.history.length
        ? `\n[SESSION MEMORY] Recent task: ${session.history[0].task}. Modified files: ${session.history[0].files.join(", ")}`
        : "";
    // Phase 47: Decision Biasing
    const intel = getIntelligence();
    let biasHint = "";
    if (intel.successfulPatterns && intel.successfulPatterns.length > 0) {
        biasHint += `\n[INTELLIGENCE] Successful past patterns: ${intel.successfulPatterns.slice(-3).map(p => p.step).join(", ")}`;
    }
    if (intel.failedPatterns && intel.failedPatterns.length > 0) {
        biasHint += `\n[INTELLIGENCE] Avoid these previously failed files/approaches: ${intel.failedPatterns.slice(-3).map(p => p.step).join(", ")}`;
    }
    const { stack, framework } = detectStack(projectDir || process.cwd());
    const stackHint = `This is a ${stack} project. Follow common conventions and best practices for this ecosystem.`;
    const frameworkHint = framework ? `Framework: ${framework}` : "";
    log.section("CONTEXT");
    log.info(`Stack detected: ${stack} ${framework ? `(${framework})` : ""}`);
    let system = `${context}${memoryHint}${biasHint}\n\n${stackHint}\n${frameworkHint}\n\n${BASE_SYSTEM}${TIER_RULES[tier]}`;
    if (complexity === "complex" && tier === "small") {
        system += `\n\nNOTE: This is a complex task. Create atomic steps with different target files.`;
    }
    const messages = [
        { role: "system", content: system },
        { role: "user", content: task },
    ];
    let raw = await chat(messages, { maxTokens: 600, metrics });
    try {
        let data;
        try {
            data = JSON.parse(extractJSON(raw));
        }
        catch (e) {
            log.warn("[PLANNER] Invalid JSON output, retrying once...");
            raw = await chat([...messages, { role: "assistant", content: raw }, { role: "user", content: "Invalid JSON. Return ONLY valid JSON object with 'steps' key." }], { maxTokens: 600, metrics });
            data = JSON.parse(extractJSON(raw));
        }
        const stepsArray = data.steps || data;
        if (!Array.isArray(stepsArray))
            throw new Error("Not an array");
        return stepsArray.slice(0, maxSteps).map((s) => ({
            id: Number(s.id || 0),
            type: String(s.type || "modify"),
            target: String(s.target || s.step || s),
            files: Array.isArray(s.files) ? s.files.map(String) : [],
            dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(Number) : [],
        }));
    }
    catch {
        return [{ id: 1, type: "modify", target: task, files: [], dependsOn: [] }];
    }
}
export function getTierRules() {
    return TIER_RULES[detectTier()];
}
