import { chat } from "../llm.js";
import { buildContext } from "../context/buildContext.ts";

const NODE_GLOBALS = [
  "console", "process", "Buffer", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
  "require", "module", "exports", "global", "globalThis", "Array", "Object", "String", "Number",
  "Boolean", "Date", "Error", "Promise", "Map", "Set", "JSON", "Math", "RegExp", "Symbol"
];

const BASE_SYSTEM = `You are a strict code reviewer. You review unified diff patches for production readiness.

REJECT the patch (respond with "Issue: <reason>") if ANY of the following are true:
- Syntax errors that would prevent the code from running
- References to undefined custom functions or variables (not built-in globals)
- Incomplete implementation (TODO, placeholder, stub, or empty function bodies)
- Breaking changes to existing function signatures without updating callers
- Obvious logic errors (wrong operator, off-by-one, null dereference)
- Invalid diff format (missing headers, malformed hunks)
- Security issues (hardcoded secrets, SQL injection, unsanitized input)

DO NOT REJECT for:
- Node.js built-in globals: ${NODE_GLOBALS.join(", ")}
- Standard JavaScript APIs
- Any code that uses console.log, process.env, Buffer, setTimeout, etc.

ONLY respond with exactly "OK" if the patch is complete, correct, and production-ready.

Your response must be EITHER:
- "OK"
- "Issue: <specific problem description>"

No other output format is allowed.`;

export async function review(patch, projectDir = process.cwd()) {
  const contextData = buildContext(projectDir);
  const context = `Context Files: ${contextData.files.join(", ")}`;
  const messages = [
    { role: "system", content: `${context}\n\n${BASE_SYSTEM}` },
    { role: "user", content: patch },
  ];
  return chat(messages, { maxTokens: 300 });
}

export function isApproved(result) {
  return result.trim().toUpperCase() === "OK";
}

export async function reviewWithRetry(patch, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await review(patch);
    if (isApproved(result)) {
      return { approved: true, result };
    }
    if (attempt === maxRetries) {
      return { approved: false, result };
    }
  }
  return { approved: false, result: "Max retries reached" };
}