import { runTest } from "./testRunner.js";
import { safeExec } from "../core/execution/safeExec.js";

// Skip interactive input
process.env.XEN_AUTO_APPROVE = "true";

(async () => {

const inputs = [
  "npm install;;;;",
  "node    -v",
  "node\t-v",
  "ＮＯＤＥ -v",
  "node -v && rm -rf /",
  "node ../secret.js",
  "fakecmd",
];

for (const input of inputs) {
  await runTest(`CHAOS: ${input}`, async () => {
    // We expect these to either return a failure object or be handled safely
    // (not crashing).
    const result = await safeExec({
      command: input,
      reason: "chaos test",
      stack: "node"
    });
    
    // Most should be 'success: false' except maybe 'node    -v' if normalization works
    if (input.includes("node") && input.includes("-v") && !input.includes("&&") && !input.includes(";")) {
       // normalized should pass
    } else {
       if (result.success) throw new Error(`Chaos input '${input}' unexpectedly succeeded`);
    }
  });
}

})();
