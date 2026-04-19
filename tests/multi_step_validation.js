import fs from "node:fs";
import path from "node:path";
import { executionLoop } from "../core/execution/engine.js";

const TEST_ROOT = "/Users/rabbi/Desktop/xentari-tests";
process.env.XEN_AUTO_APPROVE = "true";

async function runValidation(name, plan, setupFiles = {}) {
  const dir = path.join(TEST_ROOT, name);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const originalCwd = process.cwd();
  process.chdir(dir);
  
  // Setup files for the test
  for (const [file, content] of Object.entries(setupFiles)) {
    fs.writeFileSync(file, content);
  }

  console.log(`\n🚀 RUNNING TEST: ${name}`);
  const res = await executionLoop(plan, { stack: "node" });
  console.log(`🏁 RESULT: ${name} -> ${res.status} (${res.reason || "OK"})`);
  
  process.chdir(originalCwd);
}

(async () => {
  console.log("🎨 Starting Multi-Step Validation Suite (E10-E12 Ready)\n");

  // TEST 1: Basic Success
  await runValidation("test-01-basic-success", {
    steps: [
      { command: "node app.js", description: "run app" }
    ]
  }, {
    "app.js": "console.log('Xentari Ready');"
  });

  // TEST 2: Failure + Retry (CODE error)
  // helper.js will fail the first time, then success
  await runValidation("test-02-retry-code", {
    steps: [
      { command: "node helper.js" }
    ]
  }, {
    "helper.js": `
const fs = require('fs');
if (!fs.existsSync('fixed')) {
  fs.writeFileSync('fixed', '1');
  console.error('syntax error in model');
  process.exit(1);
}
console.log('Fixed successfully');
`
  });

  // TEST 3: Non-retryable (ENVIRONMENT)
  await runValidation("test-03-non-retry", {
    steps: [
      { command: "non-existent-cmd" }
    ]
  });

  // TEST 4: Mixed Flow
  await runValidation("test-04-mixed", {
    steps: [
      { command: "node app.js" },
      { command: "node helper.js" },
      { command: "node app.js" }
    ]
  }, {
    "app.js": "console.log('App OK');",
    "helper.js": "const fs = require('fs'); if (!fs.existsSync('f2')) { fs.writeFileSync('f2', '1'); console.error('syntax error'); process.exit(1); }"
  });

  // TEST 5: Security Block
  await runValidation("test-05-security", {
    steps: [
      { command: "rm -rf /" }
    ]
  });

  // TEST 6: Multiple Retries (Max 2)
  await runValidation("test-06-multi-retry", {
    steps: [
      { command: "node multi_helper.js" }
    ]
  }, {
    "multi_helper.js": `
const fs = require('fs');
const f = 'retries';
let c = 0;
if (fs.existsSync(f)) c = parseInt(fs.readFileSync(f, 'utf8'));
if (c < 2) {
  fs.writeFileSync(f, (c+1).toString());
  console.error('syntax error');
  process.exit(1);
}
console.log('Success on 3rd attempt');
`
  });

  // TEST 7: Plan Validation
  await runValidation("test-07-plan-validation", {
    steps: [
      { target: "oops-no-command" }
    ]
  });

  // TEST 8: UI Consistency (History Cap)
  await runValidation("test-08-ui", {
    steps: Array.from({ length: 25 }, (_, i) => ({ command: "node app.js", description: `Step ${i}` }))
  }, {
    "app.js": "console.log('OK');"
  });

  // TEST 9: Sequential Stress
  await runValidation("test-09-sequential", {
    steps: Array.from({ length: 10 }, (_, i) => ({ command: "node app.js" }))
  }, {
    "app.js": "console.log('Step');"
  });

  // TEST 10: Full Pipeline simulation
  await runValidation("test-10-pipeline", {
    steps: [
      { command: "node app.js" },
      { command: "node helper.js" },
      { command: "node app.js" }
    ]
  }, {
    "app.js": "console.log('Pipeline step OK');",
    "helper.js": "const fs = require('fs'); if (!fs.existsSync('p')) { fs.writeFileSync('p', '1'); console.error('syntax error'); process.exit(1); }"
  });

  console.log("\n🧪 All multi-step validation tests complete.");
})();
