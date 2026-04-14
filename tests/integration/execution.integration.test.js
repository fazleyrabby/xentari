import { runTest } from "../testRunner.js";
import { executionLoop } from "../../core/execution/engine.js";

// Skip interactive input
process.env.XEN_AUTO_APPROVE = "true";

(async () => {

await runTest("EXECUTION: success flow", async () => {
  const plan = {
    steps: [{ command: "node -v" }]
  };

  const res = await executionLoop(plan, {});

  if (res.status !== "SUCCESS") {
    throw new Error("Execution failed");
  }
});

})();
