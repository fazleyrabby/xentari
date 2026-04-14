import { runTest } from "../testRunner.js";
import { executionLoop } from "../../core/execution/engine.js";

// Skip interactive permission gate for tests
process.env.XEN_AUTO_APPROVE = "true";

(async () => {

await runTest("SYSTEM: full execution success", async () => {
  const plan = {
    steps: [
      { command: "node -v" }
    ]
  };

  const res = await executionLoop(plan, {});

  if (res.status !== "SUCCESS") {
    throw new Error(`Execution failed: ${JSON.stringify(res)}`);
  }
});

})();
