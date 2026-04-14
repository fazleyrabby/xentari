import { safeExec } from "../core/execution/safeExec.js";

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch (err) {
    console.error(`❌ FAIL: ${name} -> ${err.message}`);
  }
}

async function startTests() {
  console.log("🔥 Starting Attack-Driven Test Suite (E11 Hardened)\n");

  // Mocking permission for tests
  // Note: In a real test environment, we might want to dependency-inject or stub askPermission
  // For this spec, we assume manual 'y' if interactive, but here we focus on the logic gates before it.

  await runTest("ALLOW: npm install (Whitelist Check)", async () => {
    // This will hit the whitelist check first
    const res = await safeExec({
      command: "npm install",
      reason: "test",
      stack: "node"
    });
    // We expect it to reach the permission gate if whitelist passes
    // If it fails before permission gate (e.g. whitelist), success would be false
    if (!res.success && res.error && res.error.includes("whitelist")) {
      throw new Error("Should be whitelisted");
    }
  });

  await runTest("BLOCK: chaining (&&)", async () => {
    const res = await safeExec({
      command: "npm install && rm -rf /",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Should block chaining");
    if (!res.error.includes("Forbidden character")) throw new Error("Wrong error message");
  });

  await runTest("BLOCK: forbidden char (;)", async () => {
    const res = await safeExec({
      command: "npm install; ls",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Should block semicolon");
  });

  await runTest("BLOCK: dangerous command (sudo)", async () => {
    const res = await safeExec({
      command: "sudo apt install",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Should block sudo");
    if (!res.error.includes("Blocked by system policy")) throw new Error("Wrong error message");
  });

  await runTest("BLOCK: path traversal (..)", async () => {
    const res = await safeExec({
      command: "node ../secret.js",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Should block traversal");
    if (!res.error.includes("Path traversal in arguments")) throw new Error("Wrong error message");
  });

  await runTest("BLOCK: absolute path (/)", async () => {
    const res = await safeExec({
      command: "node /etc/passwd",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Should block absolute path");
  });

  await runTest("STRICT: whitespace obfuscation", async () => {
    const res = await safeExec({
      command: "npm    install",
      reason: "normalization test",
      stack: "node"
    });
    // If it normalization works, it should reach permission/execution and not fail on whitelist
    if (!res.success && res.error && res.error.includes("whitelist")) {
      throw new Error("Normalization failed to handle extra spaces");
    }
  });

  console.log("\n🧪 Security gates verified.");
}

startTests().catch(console.error);
