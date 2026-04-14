import { runTest } from "../testRunner.js";
import { isWhitelisted } from "../../core/execution/whitelist.js";

(async () => {

await runTest("WHITELIST: npm install allowed", async () => {
  const res = isWhitelisted({
    command: "npm",
    args: ["install"]
  });

  if (!res) throw new Error("Should allow npm install");
});

await runTest("WHITELIST: unknown command blocked", async () => {
  const res = isWhitelisted({
    command: "hack",
    args: []
  });

  if (res) throw new Error("Should block unknown");
});

})();
