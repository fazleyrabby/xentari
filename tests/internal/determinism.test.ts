import { buildPromptWithBudget } from "../../core/runtime/contextBudget.ts";

export function test(assert) {
  const systemPrompt = "Context: ${contextText}";
  const userQuery = "test";
  const files = [
    { path: "src/app.js", content: "console.log(1)", score: 10 },
    { path: "src/utils.js", content: "console.log(2)", score: 5 }
  ];
  const history = [{ role: "user", content: "hello" }];

  const run1 = buildPromptWithBudget({ systemPrompt, userQuery, files, history });
  const run2 = buildPromptWithBudget({ systemPrompt, userQuery, files, history });

  assert(JSON.stringify(run1.messages) === JSON.stringify(run2.messages), "Prompt output must be identical across runs");
  assert(run1.tokens.total === run2.tokens.total, "Token count must be identical across runs");
}
