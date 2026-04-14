import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { log } from "../logger.js";

/**
 * 🧠 XENTARI — TEST RUNNER
 */

export type TestResult = {
  success: boolean;
  output: string;
  skipped?: boolean;
};

function hasTsx(projectDir: string): boolean {
  return existsSync(join(projectDir, "node_modules/tsx"));
}

export async function runTest(projectDir: string, testCode: string, targetFile: string): Promise<TestResult> {
  if (!hasTsx(projectDir)) {
    log.info("⚠ TEST SKIPPED (no runner)");
    return { success: true, output: "Skipped: tsx not found", skipped: true };
  }

  const xentariDir = join(projectDir, ".xentari");
  if (!existsSync(xentariDir)) mkdirSync(xentariDir, { recursive: true });

  const testFile = join(xentariDir, "temp_test.js");
  
  // Prepare test code to import the target file
  // Assuming targetFile is relative to projectDir
  const relativeTarget = targetFile.replace(/\\/g, "/");
  const testContent = `
import assert from 'node:assert';
import * as target from '../${relativeTarget}';

async function run() {
  ${testCode}
}

run().then(() => {
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
`;

  writeFileSync(testFile, testContent, "utf-8");

  try {
    const tsxPath = join(projectDir, "node_modules/tsx/dist/cli.mjs");
    const output = execSync(`${process.execPath} ${tsxPath} ${testFile}`, {
      cwd: projectDir,
      encoding: "utf-8",
      env: { ...process.env, NODE_OPTIONS: "--no-warnings" }
    });
    return { success: true, output };
  } catch (err: any) {
    return { success: false, output: err.stderr || err.stdout || err.message };
  } finally {
    // try { unlinkSync(testFile); } catch {}
  }
}

export function summarizeFailure(output: string): string {
  // Simple extraction for 2-3 lines of actionable feedback
  const lines = output.split("\n").filter(l => l.trim().length > 0 && !l.includes("node_modules"));
  return lines.slice(0, 3).join("\n");
}
