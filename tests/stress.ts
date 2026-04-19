import { execSync, spawn } from "node:child_process";
import { resolve, join } from "node:path";
import crypto from "node:crypto";

const FIXTURES_DIR = resolve("tests/fixtures");

function getHash(data: string) {
  return crypto.createHash("sha256").update(data || "").digest("hex");
}

async function runCLI(fixture: string): Promise<string> {
  const projectPath = join(FIXTURES_DIR, fixture);
  const cmd = `XEN_AUTO_APPROVE=true npx tsx bin/xen.ts "analyze" --project="${projectPath}"`;
  return execSync(cmd, { encoding: "utf8", env: { ...process.env, XEN_AUTO_APPROVE: "true" } });
}

async function runAPI(fixture: string, port: number): Promise<string> {
  const projectPath = join(FIXTURES_DIR, fixture);
  const postRes = await fetch(`http://localhost:${port}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectPath })
  });
  const { jobId } = await postRes.json() as { jobId: string };

  while (true) {
    const getRes = await fetch(`http://localhost:${port}/job/${jobId}`);
    const job = await getRes.json() as { status: string, result?: string, error?: string };
    if (job.status === "done") return job.result!;
    if (job.status === "error") throw new Error(job.error);
    await new Promise(r => setTimeout(r, 200));
  }
}

async function testRepeatability() {
  console.log("Running Test 1: Repeatability (10x CLI runs)...");
  const fixture = "project-a";
  const outputs: string[] = [];
  
  for (let i = 0; i < 10; i++) {
    const output = await runCLI(fixture);
    outputs.push(output);
  }

  const firstHash = getHash(outputs[0]);
  const allIdentical = outputs.every(o => getHash(o) === firstHash);

  if (allIdentical) {
    console.log("PASS: All 10 outputs are byte-identical.");
    return true;
  } else {
    console.log("FAIL: Non-deterministic output detected in repeatability test.");
    return false;
  }
}

async function testConcurrency() {
  console.log("\nRunning Test 2: API Concurrency (10 parallel requests)...");
  const port = 3006;
  const server = spawn("npx", ["tsx", "core/api/server.js"], {
    env: { ...process.env, PORT: port.toString() },
    stdio: "ignore"
  });

  await new Promise(r => setTimeout(r, 2000));

  const fixture = "project-b";
  try {
    const promises = Array.from({ length: 10 }, () => runAPI(fixture, port));
    const results = await Promise.all(promises);

    const firstHash = getHash(results[0]);
    const allIdentical = results.every(o => getHash(o) === firstHash);

    if (allIdentical) {
      console.log("PASS: All 10 parallel API responses are byte-identical.");
      server.kill();
      return true;
    } else {
      console.log("FAIL: API output mismatch under concurrency.");
      server.kill();
      return false;
    }
  } catch (err: any) {
    console.log(`FAIL: API error during concurrency test: ${err.message}`);
    server.kill();
    return false;
  }
}

async function main() {
  const repeatabilityPass = await testRepeatability();
  const concurrencyPass = await testConcurrency();

  console.log("\nSTRESS TEST SUMMARY:");
  console.log(`Repeatability: ${repeatabilityPass ? "PASS" : "FAIL"}`);
  console.log(`Concurrency:   ${concurrencyPass ? "PASS" : "FAIL"}`);

  process.exit(repeatabilityPass && concurrencyPass ? 0 : 1);
}

main().catch(console.error);
