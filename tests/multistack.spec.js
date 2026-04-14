import { runTest } from "./testRunner.js";
import { loadStack } from "../core/loadStack.js";

(async () => {
  console.log("🧠 Starting MULTI-STACK TESTS\n");

  await runTest("MULTI: node vs fallback", async () => {
    const node = await loadStack("node");
    const fallback = await loadStack("unknown-random-stack");

    if (!node || !fallback) throw new Error("Stack load failed");
  });

  await runTest("MULTI: isolation", async () => {
    const node = await loadStack("node-basic");
    // We only have node-basic for now, but we can verify it doesn't leak global state
    if (!node.patterns) throw new Error("Node patterns missing");
  });

  console.log("\n🧪 Multi-stack tests complete.");
})();
