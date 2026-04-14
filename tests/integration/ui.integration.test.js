import { runTest } from "../testRunner.js";
import { setStatus, getState } from "../../core/ui/state.js";

(async () => {

await runTest("UI: state update reflects", async () => {
  setStatus({ text: "RUNNING" });

  const s = getState();

  if (s.status.text !== "RUNNING") {
    throw new Error("UI state broken");
  }
});

})();
