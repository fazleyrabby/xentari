import { chat } from "./llm.js";
import { getSummary } from "./context.js";

const SYSTEM = `You are a strict code reviewer. You review unified diff patches for production readiness.

REJECT the patch (respond with "Issue: <reason>") if ANY of the following are true:
- Missing or incorrect import statements
- References to undefined variables or functions
- Incomplete implementation (TODO, placeholder, stub, or empty function bodies)
- Inconsistent naming (mixing camelCase and snake_case, typos in identifiers)
- Breaking changes to existing function signatures without updating callers
- Obvious logic errors (wrong operator, off-by-one, null dereference)
- Invalid diff format (missing headers, malformed hunks)
- Security issues (hardcoded secrets, SQL injection, unsanitized input)

ONLY respond with exactly "OK" if the patch is complete, correct, and production-ready.

Your response must be EITHER:
- "OK"
- "Issue: <specific problem description>"

No other output format is allowed.`;

export async function review(patch) {
  const messages = [
    { role: "system", content: `${getSummary()}\n\n${SYSTEM}` },
    { role: "user", content: patch },
  ];
  return chat(messages, { maxTokens: 300 });
}

export function isApproved(result) {
  return result.trim().toUpperCase() === "OK";
}
