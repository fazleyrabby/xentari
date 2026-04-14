import { runTest } from "../testRunner.js";
import { safeExec } from "../../core/execution/safeExec.js";

// Skip interactive permission gate for tests
process.env.XEN_AUTO_APPROVE = "true";

(async () => {

await runTest("SAFEEXEC: valid command", async () => {
  const res = await safeExec({
    command: "node -v",
    reason: "test",
    stack: "node"
  });

  if (!res.success) throw new Error(`Execution failed: ${res.error}`);
});

await runTest("SAFEEXEC: block attack", async () => {
  const res = await safeExec({
    command: "node -v && rm -rf /",
    reason: "attack",
    stack: "node"
  });

  if (res.success) throw new Error("Attack not blocked");
});

})();
