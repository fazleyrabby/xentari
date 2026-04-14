import { runTest } from "./testRunner.js";
import { safeExec } from "../core/execution/safeExec.js";

// Skip interactive permission gate for tests
process.env.XEN_AUTO_APPROVE = "true";

(async () => {

await runTest("SECURITY: unicode bypass", async () => {
  const res = await safeExec({
    command: "npm install ＆＆ rm -rf /",
    reason: "attack",
    stack: "node"
  });

  if (res.success) throw new Error("Unicode bypass allowed");
});

await runTest("SECURITY: path traversal", async () => {
  const res = await safeExec({
    command: "node ../secret.js",
    reason: "attack",
    stack: "node"
  });

  if (res.success) throw new Error("Traversal not blocked");
});

})();
