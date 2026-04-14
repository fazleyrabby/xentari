import { runTest } from "../testRunner.js";
import { tokenize } from "../../core/execution/parser.js";

(async () => {

await runTest("PARSER: valid command", async () => {
  const res = tokenize("npm install");

  if (!res.valid) throw new Error("Should be valid");
});

await runTest("PARSER: block chaining", async () => {
  const res = tokenize("npm install && rm -rf /");

  if (res.valid) throw new Error("Chaining not blocked");
});

await runTest("PARSER: unicode normalization", async () => {
  const res = tokenize("npm install ＆＆ rm");

  if (res.valid) throw new Error("Unicode bypass");
});

})();
