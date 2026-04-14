import { runTest } from "./testRunner.js";
import { safeExec } from "../core/execution/safeExec.js";

(async () => {
  console.log("🔥 Starting E11 — ATTACK TESTS (CRITICAL)\n");

  await runTest("ATTACK: command chaining", async () => {
    const res = await safeExec({
      command: "npm install && rm -rf /",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Chaining not blocked");
  });

  await runTest("ATTACK: pipe injection", async () => {
    const res = await safeExec({
      command: "npm install | cat",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Pipe not blocked");
  });

  await runTest("ATTACK: unicode bypass", async () => {
    const res = await safeExec({
      command: "npm install ＆＆ rm -rf /",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Unicode bypass allowed");
  });

  await runTest("ATTACK: sudo usage", async () => {
    const res = await safeExec({
      command: "sudo npm install",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("sudo not blocked");
  });

  await runTest("ATTACK: flag injection", async () => {
    const res = await safeExec({
      command: "node index.js --require hack.js",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Flag injection allowed");
  });

  await runTest("ATTACK: path traversal", async () => {
    const res = await safeExec({
      command: "node ../secret.js",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Traversal not blocked");
  });

  await runTest("ATTACK: relative escape", async () => {
    const res = await safeExec({
      command: "node ./../../secret.js",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Relative escape allowed");
  });

  await runTest("ATTACK: env injection", async () => {
    const res = await safeExec({
      command: "NODE_OPTIONS=--require hack.js node index.js",
      reason: "attack",
      stack: "node"
    });
    if (res.success) throw new Error("Env injection allowed");
  });

  console.log("\n🧪 Critical attack tests complete.");
})();
