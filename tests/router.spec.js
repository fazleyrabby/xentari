import { runTest } from "./testRunner.js";
import { route } from "../core/router/index.js";

(async () => {

await runTest("CHAT: normal conversation", async () => {
  const res = await route("hello");

  if (res.type !== "chat") {
    throw new Error("Should be chat");
  }
});

await runTest("EXEC: task input", async () => {
  // Mock engine dependency if needed, but integration testing the route itself works as requested.
  // Note: the original codebase might fail here if executionLoop tries to actually parse "create api" and expects files.
  // We'll let it execute because it's the requested test format.
  const res = await route("create api", { auto: true });

  if (res.type !== "exec") {
    throw new Error("Should be exec");
  }
});

})();
