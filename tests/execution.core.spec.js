import { runTest } from "./testRunner.js";
import { safeExec } from "../core/execution/safeExec.js";

(async () => {
  console.log("🧠 Starting E11 — EXECUTION CORE TESTS\n");

  await runTest("EXEC: allow npm install", async () => {
    const res = await safeExec({
      command: "npm install",
      reason: "test",
      stack: "node"
    });
    // If it reached the permission gate, the whitelist pass was successful
    if (!res.success && res.error && res.error.includes("whitelist")) {
      throw new Error("Execution failed at whitelist");
    }
  });

  await runTest("EXEC: deny unknown command", async () => {
    const res = await safeExec({
      command: "unknowncmd",
      reason: "test",
      stack: "node"
    });
    if (res.success) throw new Error("Should have blocked unknown command");
    if (!res.error.includes("whitelist")) throw new Error("Wrong error: " + res.error);
  });

  console.log("\n🧪 Core execution tests complete.");
})();
