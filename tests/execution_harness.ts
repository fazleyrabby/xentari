import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import crypto from "node:crypto";
import { execute } from "../executor/index.ts";
import { ExecutionState } from "../executor/types.ts";
import { Plan } from "../planner/types.ts";

const SNAPSHOTS_DIR = resolve("tests/plans");
const EXECUTION_DIR = resolve("tests/execution");

const testCases = [
  {
    fixture: "project-a",
    state: { completed: [] }
  },
  {
    fixture: "project-a",
    state: { completed: ["struct-1", "struct-2", "struct-3"] }
  },
  {
    fixture: "project-a",
    state: { completed: ["struct-1", "struct-2", "struct-3", "auth-2"] }
  }
];

function getHash(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function main() {
  const isUpdate = process.argv.includes("--update");

  if (!existsSync(EXECUTION_DIR)) mkdirSync(EXECUTION_DIR, { recursive: true });

  let total = 0;
  let pass = 0;
  let fail = 0;

  for (const tc of testCases) {
    total++;
    const planPath = join(SNAPSHOTS_DIR, `${tc.fixture}.plan.json`);
    const plan = JSON.parse(readFileSync(planPath, "utf8")) as Plan;
    
    const result = execute(plan, tc.state as ExecutionState);
    const resultStr = JSON.stringify(result, null, 2);

    const testId = `${tc.fixture}-${tc.state.completed.length}`;
    const snapshotPath = join(EXECUTION_DIR, `${testId}.execution.json`);

    if (isUpdate) {
      writeFileSync(snapshotPath, resultStr);
      pass++;
      continue;
    }

    const snapshot = existsSync(snapshotPath) ? readFileSync(snapshotPath, "utf8") : null;

    if (resultStr !== snapshot) {
      fail++;
      console.log(`\nFAIL CASE:\n* ${testId}\n`);
      console.log(`EXECUTION HASH: ${getHash(resultStr)}`);
      console.log(`SNAPSHOT HASH:  ${getHash(snapshot || "")}`);
      
      const resLines = resultStr.split("\n");
      const snapLines = (snapshot || "").split("\n");
      for (let i = 0; i < Math.max(resLines.length, snapLines.length); i++) {
        if (resLines[i] !== snapLines[i]) {
          console.log(`DIFF: Line ${i + 1}`);
          console.log(`EXEC: ${resLines[i]}`);
          console.log(`SNAP: ${snapLines[i]}`);
          break;
        }
      }
    } else {
      pass++;
    }
  }

  console.log(`\nTOTAL: ${total}`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(console.error);
