import { buildPromptWithBudget } from "../../core/runtime/contextBudget.ts";

export function test(assert) {
  const systemPrompt = "System context. ${contextText}";
  const userQuery = "User query.";
  const files = [
    { path: "core.js", content: "core logic".repeat(50), score: 100 }
  ];
  const history = [
    { role: "user", content: "old message".repeat(50) },
    { role: "assistant", content: "old response".repeat(50) }
  ];

  // Max tokens set to fit System + User + Files, but not History
  const result = buildPromptWithBudget({
    systemPrompt,
    userQuery,
    files,
    history,
    maxTokens: 300, 
    reservedForOutput: 50
  });

  assert(result.messages[0].content.includes("core logic"), "Core files should be preserved");
  assert(result.messages.length <= 3, "History should be trimmed before files are dropped");
  assert(result.messages.some(m => m.role === "system"), "System prompt must always be included");
  assert(result.messages.some(m => m.content === "User query."), "User query must always be included");
}
