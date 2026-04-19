import { execSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import crypto from "node:crypto";
import { buildPlan } from "../planner/index.ts";

const FIXTURES_DIR = resolve("tests/fixtures");
const SNAPSHOTS_DIR = resolve("tests/plans");

const fixtures = ["project-a", "project-b"];

function getHash(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function getAnalysis(fixture: string): Promise<string> {
  const projectPath = join(FIXTURES_DIR, fixture);
  const cmd = `XEN_AUTO_APPROVE=true npx tsx bin/xen.ts "analyze" --project="${projectPath}"`;
  try {
    const stdout = execSync(cmd, { encoding: "utf8", env: { ...process.env, XEN_AUTO_APPROVE: "true" } });
    return stdout;
  } catch (err: any) {
    return err.stdout || err.message;
  }
}

function validatePlan(plan: any) {
  for (const step of plan.steps) {
    // 1. dependsOn always present
    if (!step.dependsOn) {
      throw new Error(`Step ${step.id} is missing dependsOn`);
    }

    // 2. arrays sorted
    const sortedDeps = [...step.dependsOn].sort();
    if (JSON.stringify(step.dependsOn) !== JSON.stringify(sortedDeps)) {
      throw new Error(`Step ${step.id} dependsOn is not sorted: ${JSON.stringify(step.dependsOn)}`);
    }

    // 3. no self-deps
    if (step.dependsOn.includes(step.id)) {
      throw new Error(`Step ${step.id} has self-dependency`);
    }

    // 4. meta exists and is correct
    if (!step.meta) {
      throw new Error(`Step ${step.id} is missing meta`);
    }
    if (typeof step.meta.capability !== "string") {
      throw new Error(`Step ${step.id} meta.capability must be a string`);
    }
    if (typeof step.meta.layer !== "string") {
      throw new Error(`Step ${step.id} meta.layer must be a string`);
    }
  }
}

async function main() {
  const isUpdate = process.argv.includes("--update");

  if (!existsSync(SNAPSHOTS_DIR)) mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  let total = 0;
  let pass = 0;
  let fail = 0;

  for (const fixture of fixtures) {
    total++;
    try {
      const analysis = await getAnalysis(fixture);
      const plan = buildPlan(analysis);
      
      // Run validation checks
      validatePlan(plan);

      const planStr = JSON.stringify(plan, null, 2);

      if (isUpdate) {
        writeFileSync(join(SNAPSHOTS_DIR, `${fixture}.plan.json`), planStr);
        pass++;
        continue;
      }

      const snapshotPath = join(SNAPSHOTS_DIR, `${fixture}.plan.json`);
      const snapshot = existsSync(snapshotPath) ? readFileSync(snapshotPath, "utf8") : null;

      if (planStr !== snapshot) {
        fail++;
        console.log(`\nFAIL CASE:\n* ${fixture}\n`);
        console.log(`PLAN HASH:     ${getHash(planStr)}`);
        console.log(`SNAPSHOT HASH: ${getHash(snapshot || "")}`);
        
        const planLines = planStr.split("\n");
        const snapLines = (snapshot || "").split("\n");
        for (let i = 0; i < Math.max(planLines.length, snapLines.length); i++) {
          if (planLines[i] !== snapLines[i]) {
            console.log(`DIFF: Line ${i + 1}`);
            console.log(`PLAN: ${planLines[i]}`);
            console.log(`SNAP: ${snapLines[i]}`);
            break;
          }
        }
      } else {
        pass++;
      }
    } catch (err: any) {
      fail++;
      console.error(`Error testing ${fixture}: ${err.message}`);
    }
  }

  console.log(`\nTOTAL: ${total}`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(console.error);
