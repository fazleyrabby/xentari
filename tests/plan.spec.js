import { runTest } from "./testRunner.js";
import { validatePlan } from "../core/validators/planValidator.js";

(async () => {
  console.log("🧠 Starting PLAN VALIDATION TESTS\n");

  await runTest("PLAN: valid structure", async () => {
    validatePlan({
      steps: [{ id: 1, type: "create", target: "file.js" }]
    });
  });

  await runTest("PLAN: missing steps", async () => {
    try {
      validatePlan({});
      throw new Error("Validation should have failed for missing steps");
    } catch (err) {
      if (err.message.includes("steps missing")) return;
      throw err;
    }
  });

  await runTest("PLAN: missing type", async () => {
    try {
      validatePlan({ steps: [{ id: 1, target: "file.js" }] });
      throw new Error("Validation should have failed for missing type");
    } catch (err) {
      if (err.message.includes("missing type")) return;
      throw err;
    }
  });

  await runTest("PLAN: missing target", async () => {
    try {
      validatePlan({ steps: [{ id: 1, type: "create" }] });
      throw new Error("Validation should have failed for missing target");
    } catch (err) {
      if (err.message.includes("missing target")) return;
      throw err;
    }
  });

  console.log("\n🧪 Plan tests complete.");
})();
