import { chat } from "./llm.js";
import { getContext } from "./context.js";
import { detectTier, getTierProfile } from "./tier.js";
import { detectStack } from "./project/detector.js";
const BASE_SYSTEM = `You are a professional software architect and planner. Given a coding task, produce a JSON array of steps.

Each step has:
- "id": unique integer starting from 1
- "step": a short implementation-focused description
- "files": array of keyword hints for relevant files
- "dependsOn": array of step IDs that MUST be completed before this step

STRICT RULES:
- Only include server-side/core implementation steps.
- DO NOT include frontend, UI, CSS, HTML, React, Vue, or Angular steps unless explicitly asked.
- DO NOT include testing steps unless the task explicitly asks for tests.
- DO NOT include deployment, CI/CD, or infrastructure steps.
- Each step must be a concrete code change, not a plan or review.
- Output ONLY valid JSON, no explanation, no markdown.

DEPENDENCY RULES:
- If Step B adds logic that depends on an export from Step A → B dependsOn [A]
- If steps are independent → dependsOn must be []

FILE TARGETING RULES:
- Target the correct directories for the ecosystem (e.g., models/, services/, src/, etc.)
- New files: put in appropriate directories according to project conventions.`;
const TIER_RULES = {
    small: `\n\nIMPORTANT: Maximum 3 steps. Keep each step very simple — one file change per step. No complex refactors.`,
    medium: `\n\nMaximum 4 steps. Keep steps focused and concrete.`,
    large: `\n\nUp to 5 steps allowed. Steps can involve multiple files and more complex implementations.`,
};
function extractJSON(raw) {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    return fenced ? fenced[1].trim() : raw.trim();
}
export async function plan(task, projectDir) {
    const tier = detectTier();
    const profile = getTierProfile();
    const { context } = getContext(task, projectDir);
    const { stack, framework } = detectStack(projectDir || process.cwd());
    const stackHint = `This is a ${stack} project. ${framework ? `Framework: ${framework}.` : ""} Follow common conventions and best practices for this ecosystem.`;
    const system = `${context}\n\n${stackHint}\n\n${BASE_SYSTEM}${TIER_RULES[tier]}`;
    const messages = [
        { role: "system", content: system },
        { role: "user", content: task },
    ];
    const raw = await chat(messages, { maxTokens: 400 });
    try {
        const steps = JSON.parse(extractJSON(raw));
        if (!Array.isArray(steps))
            throw new Error("Not an array");
        return steps.slice(0, profile.maxSteps).map((s) => ({
            id: Number(s.id || 0),
            step: String(s.step || ""),
            files: Array.isArray(s.files) ? s.files.map(String) : [],
            dependsOn: Array.isArray(s.dependsOn) ? s.dependsOn.map(Number) : [],
        }));
    }
    catch {
        return [{ id: 1, step: task, files: [], dependsOn: [] }];
    }
}
