import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import crypto from "node:crypto";
import { projectPlan, AdapterTarget } from "../adapter/index.ts";
import { Plan } from "../planner/types.ts";

const PLAN_SNAPSHOTS_DIR = resolve("tests/plans");
const ADAPTER_SNAPSHOTS_DIR = resolve("tests/adapters");

const testCases: { fixture: string, target: AdapterTarget }[] = [
  { fixture: "project-a", target: "node" },
  { fixture: "project-a", target: "laravel" }
];

function getHash(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function main() {
  const isUpdate = process.argv.includes("--update");

  if (!existsSync(ADAPTER_SNAPSHOTS_DIR)) mkdirSync(ADAPTER_SNAPSHOTS_DIR, { recursive: true });

  let total = 0;
  let pass = 0;
  let fail = 0;

  for (const tc of testCases) {
    total++;
    const planPath = join(PLAN_SNAPSHOTS_DIR, `${tc.fixture}.plan.json`);
    const plan = JSON.parse(readFileSync(planPath, "utf8")) as Plan;
    
    const result = projectPlan(plan, tc.target);
    const resultStr = JSON.stringify(result, null, 2);

    const snapshotPath = join(ADAPTER_SNAPSHOTS_DIR, `${tc.fixture}.${tc.target}.json`);

    if (isUpdate) {
      writeFileSync(snapshotPath, resultStr);
      pass++;
      continue;
    }

    const snapshot = existsSync(snapshotPath) ? readFileSync(snapshotPath, "utf8") : null;

    if (resultStr !== snapshot) {
      fail++;
      console.log(`\nFAIL CASE:\n* ${tc.fixture} (${tc.target})\n`);
      console.log(`ADAPTER HASH:  ${getHash(resultStr)}`);
      console.log(`SNAPSHOT HASH: ${getHash(snapshot || "")}`);
      
      const resLines = resultStr.split("\n");
      const snapLines = (snapshot || "").split("\n");
      for (let i = 0; i < Math.max(resLines.length, snapLines.length); i++) {
        if (resLines[i] !== snapLines[i]) {
          console.log(`DIFF: Line ${i + 1}`);
          console.log(`ADAP: ${resLines[i]}`);
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
