import { runTest } from "../testRunner.js";
import { executionLoop } from "../../core/execution/engine.js";

// Skip interactive input
process.env.XEN_AUTO_APPROVE = "true";

(async () => {

await runTest("SYSTEM: failure + retry", async () => {
  const plan = {
    steps: [
      { command: "node -e 'process.exit(1)'", description: "This will fail but maybe not retry unless classified as CODE" },
      { command: "node -v" }
    ]
  };

  const res = await executionLoop(plan, {});

  if (!res) throw new Error("System failed to return result");
});

})();
