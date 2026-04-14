import { runTest } from "./testRunner.js";
import { loadStack } from "../core/loadStack.js";

(async () => {
  console.log("🧠 Starting E10 — STACK ENGINE TESTS\n");

  await runTest("STACK: loads node-basic", async () => {
    const stack = await loadStack("node-basic");
    if (!stack) throw new Error("Stack not loaded");
  });

  await runTest("STACK: contract validation", async () => {
    const stack = await loadStack("node-basic");
    const required = ["patterns", "planner", "validator", "testRunner"];
    for (const key of required) {
      if (!stack[key]) throw new Error(`Missing required export: ${key}`);
    }
  });

  await runTest("STACK: planner exists", async () => {
    const stack = await loadStack("node-basic");
    if (typeof stack.planner.generatePlan !== "function") {
      throw new Error("Planner.generatePlan is not a function");
    }
  });

  await runTest("STACK: patterns isolated", async () => {
    const stack = await loadStack("node-basic");
    if (!stack.patterns || Object.keys(stack.patterns).length === 0) {
      throw new Error("Patterns are missing or empty");
    }
  });

  console.log("\n🧪 Stack tests complete.");
})();
