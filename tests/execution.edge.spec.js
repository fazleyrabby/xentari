import { runTest } from "./testRunner.js";
import { safeExec } from "../core/execution/safeExec.js";

(async () => {
  console.log("🧠 Starting E11 — DOS + EDGE TESTS\n");

  await runTest("EDGE: empty command", async () => {
    const res = await safeExec({
      command: "",
      reason: "test",
      stack: "node"
    });
    if (res.success) throw new Error("Empty command was allowed");
  });

  await runTest("EDGE: whitespace only", async () => {
    const res = await safeExec({
      command: "   ",
      reason: "test",
      stack: "node"
    });
    if (res.success) throw new Error("Whitespace-only command was allowed");
  });

  // yes command is whitelisted? No.
  await runTest("EDGE: unwhitelisted (yes)", async () => {
    const res = await safeExec({
      command: "yes",
      reason: "dos test",
      stack: "node"
    });
    if (res.success) throw new Error("Unwhitelisted 'yes' command allowed");
  });

  console.log("\n🧪 Edge tests complete.");
})();
