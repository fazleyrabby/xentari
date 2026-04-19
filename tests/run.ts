import { execSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import crypto from "node:crypto";

const FIXTURES_DIR = resolve("tests/fixtures");
const SNAPSHOTS_DIR = resolve("tests/snapshots");

const fixtures = ["project-a", "project-b"];

function getHash(data: string) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

async function runCLI(fixture: string): Promise<string> {
  const projectPath = join(FIXTURES_DIR, fixture);
  const cmd = `XEN_AUTO_APPROVE=true npx tsx bin/xen.ts "analyze" --project="${projectPath}"`;
  try {
    const stdout = execSync(cmd, { encoding: "utf8", env: { ...process.env, XEN_AUTO_APPROVE: "true" } });
    return stdout;
  } catch (err: any) {
    return err.stdout || err.message;
  }
}

async function runAPI(fixture: string): Promise<string> {
  const projectPath = join(FIXTURES_DIR, fixture);
  
  // POST /analyze
  const postRes = await fetch("http://localhost:3005/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectPath })
  });
  const { jobId } = await postRes.json() as { jobId: string };

  // Poll /job/:id
  while (true) {
    const getRes = await fetch(`http://localhost:3005/job/${jobId}`);
    const job = await getRes.json() as { status: string, result?: string, error?: string };
    if (job.status === "done") return job.result!;
    if (job.status === "error") throw new Error(job.error);
    await new Promise(r => setTimeout(r, 500));
  }
}

async function main() {
  const isUpdate = process.argv.includes("--update");

  if (!existsSync(SNAPSHOTS_DIR)) mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  let total = 0;
  let pass = 0;
  let fail = 0;
  const failCases: string[] = [];

  // Start API server
  console.log("Starting API server...");
  const server = spawn("npx", ["tsx", "core/api/server.js"], {
    env: { ...process.env, PORT: "3005" },
    stdio: "inherit"
  });

  // Wait for server to be ready
  await new Promise(r => setTimeout(r, 2000));

  for (const fixture of fixtures) {
    total++;
    console.log(`Testing ${fixture}...`);

    try {
      const cliOutput = await runCLI(fixture);
      
      if (isUpdate) {
        writeFileSync(join(SNAPSHOTS_DIR, `${fixture}.json`), cliOutput);
        console.log(`Updated snapshot for ${fixture}`);
        pass++;
        continue;
      }

      const apiOutput = await runAPI(fixture);
      const snapshotPath = join(SNAPSHOTS_DIR, `${fixture}.json`);
      const snapshot = existsSync(snapshotPath) ? readFileSync(snapshotPath, "utf8") : null;

      let mismatch = false;
      if (cliOutput !== apiOutput) {
        mismatch = true;
      }
      if (snapshot !== null && cliOutput !== snapshot) {
        mismatch = true;
      }

      if (mismatch) {
        fail++;
        failCases.push(fixture);
        console.log(`\nFAIL CASE:\n* ${fixture}\n`);
        console.log(`CLI HASH:   ${getHash(cliOutput)}`);
        console.log(`API HASH:   ${getHash(apiOutput)}`);
        
        // Simple DIFF (first mismatch line)
        const cliLines = cliOutput.split("\n");
        const apiLines = apiOutput.split("\n");
        for (let i = 0; i < Math.max(cliLines.length, apiLines.length); i++) {
          if (cliLines[i] !== apiLines[i]) {
            console.log(`DIFF: Line ${i + 1}`);
            console.log(`CLI: ${cliLines[i]}`);
            console.log(`API: ${apiLines[i]}`);
            break;
          }
        }
      } else {
        pass++;
      }
    } catch (err: any) {
      fail++;
      failCases.push(fixture);
      console.error(`Error testing ${fixture}: ${err.message}`);
    }
  }

  console.log(`\nTOTAL: ${total}`);
  console.log(`PASS: ${pass}`);
  console.log(`FAIL: ${fail}`);

  server.kill();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
