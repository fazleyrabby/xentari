const { runTest } = require("./testRunner");
const { executionLoop } = require("../core/execution/engine");

(async () => {

await runTest("AUTO: skips approval", async () => {
  const plan = {
    steps: [{ command: "node -v" }]
  };

  const res = await executionLoop(plan, { auto: true });

  if (res.status !== "SUCCESS") {
    throw new Error("AUTO failed");
  }
});

await runTest("AUTO: still blocks unsafe", async () => {
  const plan = {
    steps: [{ command: "rm -rf /" }]
  };

  const res = await executionLoop(plan, { auto: true });

  // Assuming 'rm -rf /' is blocked by whitelist or policy
  if (res.status === "SUCCESS") {
    throw new Error("Unsafe allowed in AUTO");
  }
});

})();
