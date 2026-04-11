import { chat } from "./llm.js";
import { loadConfig } from "./config.js";

export async function advisorFix({ task, patch, feedback }) {
  const prompt = `
You are a senior engineer fixing a broken patch.

Task:
${task}

Current patch:
${patch || "No patch generated"}

Reviewer feedback:
${feedback || "No feedback available"}

Fix the patch.

STRICT RULES:
- Return ONLY a valid unified diff
- NO explanations
- NO markdown
- Must include "diff --git" and "@@" headers
`;

  // We use a lower temperature for the advisor to ensure deterministic and correct patch generation
  const res = await chat([{ role: "user", content: prompt }], {
    temperature: 0.2,
    maxTokens: 1000
  });

  return res;
}

export function isAdvisorCallAllowed(task, opts) {
  const { skipAdvisor = false } = opts || {};
  if (skipAdvisor) return false;

  const config = loadConfig();
  if (config.disableAdvisor) return false;

  return true;
}
