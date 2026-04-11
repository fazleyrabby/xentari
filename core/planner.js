import { chat } from "./llm.js";
import { getContext } from "./context.js";
import { detectTier, getTierProfile } from "./tier.js";

const BASE_SYSTEM = `You are a backend-focused planner. Given a coding task, produce a JSON array of steps.

Each step has:
- "step": a short implementation-focused description
- "files": array of keyword hints for relevant files

STRICT RULES:
- Only include backend/server-side steps (models, services, routes, controllers, schemas, migrations, APIs)
- DO NOT include frontend, UI, CSS, HTML, React, Vue, or Angular steps
- DO NOT include testing steps unless the task explicitly asks for tests
- DO NOT include deployment, CI/CD, or infrastructure steps
- Each step must be a concrete code change, not a plan or review
- Output ONLY valid JSON, no explanation, no markdown`;

const TIER_RULES = {
  small: `\n\nIMPORTANT: Maximum 3 steps. Keep each step very simple — one file change per step. No complex refactors.`,
  medium: `\n\nMaximum 4 steps. Keep steps focused and concrete.`,
  large: `\n\nUp to 5 steps allowed. Steps can involve multiple files and more complex implementations.`,
};

function extractJSON(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fenced ? fenced[1].trim() : raw.trim();
}

export async function plan(task) {
  const tier = detectTier();
  const profile = getTierProfile();
  const { context } = getContext(task);
  const system = `${context}\n\n${BASE_SYSTEM}${TIER_RULES[tier]}`;

  const messages = [
    { role: "system", content: system },
    { role: "user", content: task },
  ];

  const raw = await chat(messages, { maxTokens: 400 });

  try {
    const steps = JSON.parse(extractJSON(raw));
    if (!Array.isArray(steps)) throw new Error("Not an array");
    return steps.slice(0, profile.maxSteps).map((s) => ({
      step: String(s.step || ""),
      files: Array.isArray(s.files) ? s.files.map(String) : [],
    }));
  } catch {
    return [{ step: task, files: [] }];
  }
}
