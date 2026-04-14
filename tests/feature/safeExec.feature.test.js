import { runTest } from "../testRunner.js";
import { safeExec } from "../../core/execution/safeExec.js";

// Skip interactive input
process.env.XEN_AUTO_APPROVE = "true";

(async () => {

await runTest("SAFEEXEC: allowed command", async () => {
  const res = await safeExec({
    command: "node -v",
    stack: "node"
  });

  if (!res.success) throw new Error("Execution failed");
});

await runTest("SAFEEXEC: block rm", async () => {
  const res = await safeExec({
    command: "rm -rf /",
    stack: "node"
  });

  if (res.success) throw new Error("Should block");
});

})();
