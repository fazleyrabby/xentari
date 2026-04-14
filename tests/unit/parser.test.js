import { runTest } from "../testRunner.js";
import { tokenize } from "../../core/execution/parser.js";

(async () => {

await runTest("PARSER: basic tokenize", async () => {
  const res = tokenize("npm install");

  if (!res.valid) throw new Error("Should be valid");
  if (res.command !== "npm") throw new Error("Wrong command");
});

await runTest("PARSER: block forbidden chars", async () => {
  const res = tokenize("npm install && rm -rf /");

  if (res.valid) throw new Error("Should block chaining");
});

})();
