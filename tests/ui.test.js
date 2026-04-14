import { runTest } from "./testRunner.js";
import ui from "../core/ui/renderer.js";

(async () => {

await runTest("UI: render header", async () => {
  ui.header({
    project: "demo",
    stack: "node",
    mode: "strict"
  });
});

})();
