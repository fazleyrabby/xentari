import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDir = path.join(__dirname, "internal");

async function run() {
  console.log("🚀 Xentari — Internal Systems Test Runner\n");

  const files = fs.readdirSync(testDir).filter(f => f.endsWith(".test.ts"));
  let passed = 0;
  let failed = 0;
  const failures: any[] = [];

  for (const file of files) {
    const testPath = path.join(testDir, file);
    try {
      const module = await import(testPath);
      
      const assert = (condition: boolean, message: string) => {
        if (!condition) throw new Error(message);
      };

      if (typeof module.test === "function") {
        module.test(assert);
        console.log(`✅ PASS ${file}`);
        passed++;
      } else {
        console.log(`⚠️ SKIP ${file} (no test function)`);
      }
    } catch (err: any) {
      console.log(`❌ FAIL ${file} → "${err.message}"`);
      failed++;
      failures.push({
        test: file,
        reason: err.message,
        fixSuggestion: "Check if the core logic changed and update the test or fix the regression."
      });
    }
  }

  console.log("\n--- SUMMARY ---");
  console.log(`Total:  ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error("Runner Error:", err);
  process.exit(1);
});
