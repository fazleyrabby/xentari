import { buildPromptWithBudget, estimateTokens } from "../../core/runtime/contextBudget.ts";

export function test(assert) {
  const systemPrompt = "You are an AI assistant. ${contextText}";
  const userQuery = "Explain the code.";
  const files = [
    { path: "a.js", content: "const a = 1;".repeat(100), score: 10 },
    { path: "b.js", content: "const b = 2;".repeat(100), score: 20 },
  ];
  const history = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello" }
  ];

  // Test 1: No trimming needed
  const result1 = buildPromptWithBudget({
    systemPrompt,
    userQuery,
    files,
    history,
    maxTokens: 4000,
    reservedForOutput: 1000
  });
  assert(!result1.trimmed, "Should not be trimmed when budget is large");
  assert(result1.tokens.total <= 3000, "Total tokens should be within budget");

  // Test 2: Trimming files (low budget)
  const result2 = buildPromptWithBudget({
    systemPrompt,
    userQuery,
    files,
    history,
    maxTokens: 200, 
    reservedForOutput: 50
  });
  assert(result2.trimmed, "Should be trimmed when budget is small");
  assert(result2.tokens.total <= 150, "Total tokens should stay under budget even if trimmed");
  
  // Test 3: Priority - higher score files preserved
  const smallFiles = [
    { path: "low.js", content: "low".repeat(50), score: 5 },
    { path: "high.js", content: "high".repeat(50), score: 50 },
  ];
  const result3 = buildPromptWithBudget({
    systemPrompt,
    userQuery,
    files: smallFiles,
    history: [],
    maxTokens: 100, // Very small budget
    reservedForOutput: 20
  });
  assert(result3.messages[0].content.includes("high"), "High score file should be preserved");
  assert(!result3.messages[0].content.includes("low"), "Low score file should be dropped if no budget");
}
