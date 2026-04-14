import { runTest } from "../testRunner.js";
import { state, getState, addAction } from "../../core/ui/state.js";

(async () => {

await runTest("STATE: add action", async () => {
  addAction({ type: "TEST", target: "file.js", icon: "✔" });

  const s = getState();
  if (!s.actions.find(a => a.type === "TEST")) throw new Error("Action not added");
});

})();
