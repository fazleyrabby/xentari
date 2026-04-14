import { runTest } from "../testRunner.js";
import { handleFailure } from "../../core/execution/retryEngine.js";

(async () => {

await runTest("RETRY: allowed retry", async () => {
  const res = await handleFailure(
    { retries: 0 },
    { error: "syntax error" }
  );

  if (res.status !== "RETRY") throw new Error("Should retry");
});

await runTest("RETRY: max retries", async () => {
  const res = await handleFailure(
    { retries: 2 },
    { error: "syntax error" }
  );

  if (res.status === "RETRY") throw new Error("Should stop retry");
});

})();
