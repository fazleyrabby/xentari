import { renderBox } from "../core/ui/box.js";
import { renderAction } from "../core/ui/action.js";
import { truncatePath } from "../core/ui/width.js";

async function runTest(name, fn) {
  try {
    console.log(`\n--- TEST: ${name} ---`);
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    console.error(`❌ FAIL: ${name} -> ${err.message}`);
  }
}

(async () => {
  console.log("🎨 Starting Xentari UI Stability Tests\n");

  await runTest("BOX: Standard Render", async () => {
    renderBox("XENTARI CORE", [
      "Status: ACTIVE",
      "Mode: DETERMINISTIC",
      "Layout: SAFE"
    ]);
  });

  await runTest("BOX: Overflow Handling", async () => {
    renderBox("OVERFLOW TEST", [
      "Short line",
      "This is a very very very very very very very very very very very very very very very very very very very very long line that should be truncated by the safety engine."
    ]);
  });

  await runTest("ACTION: Status Icons", async () => {
    renderAction("plan", "Scaffold user module", "success");
    renderAction("code", "Generating controllers", "active");
    renderAction("review", "Security audit", "pending");
    renderAction("patch", "Apply changes", "error");
  });

  await runTest("WIDTH: Path Truncation", async () => {
    const longPath = "/Users/rabbi/Desktop/Projects/ai/xentari/core/execution/safeExec.js";
    console.log("Full Path: ", longPath);
    console.log("Truncated (40): ", truncatePath(longPath, 40));
    console.log("Truncated (20): ", truncatePath(longPath, 20));
  });

  console.log("\n🧪 UI tests complete.");
})();
