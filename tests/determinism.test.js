import { runTest } from "./testRunner.js";
import { executionLoop } from "../core/execution/engine.js";
import fs from "node:fs";

// Skip interactive input
process.env.XEN_AUTO_APPROVE = "true";

(async () => {

await runTest("DETERMINISM: same plan same result", async () => {
  const plan = {
    steps: [{ command: "node -v" }]
  };

  const res1 = await executionLoop(plan, { stack: "node" });
  const res2 = await executionLoop(plan, { stack: "node" });

  if (JSON.stringify(res1) !== JSON.stringify(res2)) {
    throw new Error("Non-deterministic behavior detected");
  }
});

await runTest("SNAPSHOT: file written", async () => {
  const exists = fs.existsSync(".xentari/snapshots.log");

  if (!exists) {
    throw new Error("Snapshot not created");
  }
});

})();
