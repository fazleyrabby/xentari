import { runTest } from "../testRunner.js";
import { loadStack } from "../../core/loadStack.js";

(async () => {

await runTest("STACK: load node-basic", async () => {
  const stack = await loadStack("node-basic");

  if (!stack) throw new Error("Failed to load");
});

})();
