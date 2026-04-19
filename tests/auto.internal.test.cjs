const { runTest } = require("./testRunner");
const { askPermission } = require("../core/execution/permission");
const { executionLoop } = require("../core/execution/engine");

(async () => {

await runTest("AUTO: permission override only", async () => {
  const res = await askPermission({ command: "node -v", reason: "test", stack: "node" }, { auto: true });

  if (!res) throw new Error("AUTO should approve");
});

await runTest("AUTO: determinism preserved", async () => {
  const plan = { steps: [{ command: "node -v" }] };

  const a = await executionLoop(plan, { auto: true });
  const b = await executionLoop(plan, { auto: true });

  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error("AUTO broke determinism");
  }
});

})();
