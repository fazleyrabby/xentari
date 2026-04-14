import { runTest } from "../testRunner.js";
import { validatePolicy } from "../../core/execution/policy.js";

(async () => {

await runTest("POLICY: allow npm", async () => {
  const res = validatePolicy({ valid: true, command: "npm" });

  if (!res.allowed) throw new Error("Should allow npm");
});

await runTest("POLICY: block rm", async () => {
  const res = validatePolicy({ valid: true, command: "rm" });

  if (res.allowed) throw new Error("rm should be blocked");
});

})();
