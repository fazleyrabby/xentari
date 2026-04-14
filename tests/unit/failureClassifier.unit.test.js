import { runTest } from "../testRunner.js";
import { classifyFailure } from "../../core/execution/failureClassifier.js";

(async () => {

await runTest("FAILURE: classify code", async () => {
  const res = classifyFailure({ error: "syntax error" });

  if (res.type !== "CODE") throw new Error("Wrong type");
});

await runTest("FAILURE: classify environment", async () => {
  const res = classifyFailure({ error: "ENOENT" });

  if (res.type !== "ENVIRONMENT") throw new Error("Wrong type");
});

})();
