import { runAgent } from "../core/runtime/runAgent.ts";
import { workspaceManager } from "../core/workspace/workspaceManager.js";
import { loadSession, listSessions } from "../core/session/store.ts";
import path from "path";
import fs from "fs";
import assert from "assert";

async function runTests() {
  const projectDir = process.cwd();
  console.log("🚀 Starting CORE TEST SUITE — ADVANCED\n");

  // 1. Session Store Test
  console.log("TEST 1: Session Store Initialization");
  const sessions = listSessions(projectDir);
  assert(Array.isArray(sessions), "listSessions should return an array");
  console.log("✓ Session store accessible\n");

  // 2. Workspace Management Test
  console.log("TEST 2: Workspace Discovery");
  const projects = workspaceManager.getProjects();
  assert(Array.isArray(projects), "workspaceManager should return projects array");
  console.log(`✓ Detected ${projects.length} projects\n`);

  // 3. Runtime Chat Test
  console.log("TEST 3: Runtime Agent Execution");
  try {
    const result = await runAgent({
      input: "ping",
      projectDir: projectDir,
      sessionId: "test-session"
    });
    assert(result.message, "Agent should return a message");
    console.log("✓ Agent chat functional\n");
  } catch (err) {
    console.error("✗ Agent chat failed:", err.message);
    process.exit(1);
  }

  // 4. Deterministic Context Test
  console.log("TEST 4: Context System Reliability");
  const contextDir = path.join(projectDir, ".xentari");
  assert(fs.existsSync(contextDir), ".xentari directory should exist");
  console.log("✓ Context structure verified\n");

  console.log("✨ ALL CORE TESTS PASSED");
}

runTests().catch(err => {
  console.error("CRITICAL TEST FAILURE:", err);
  process.exit(1);
});
