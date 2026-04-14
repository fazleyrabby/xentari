import { runTest } from "./testRunner.js";
import { getState, setTimeline } from "../core/ui/state.js";

(async () => {

await runTest("UI: timeline updates", async () => {
  setTimeline([{ type: "STEP", command: "node -v", time: Date.now() }]);

  const s = getState();

  if (!s.timeline.length) {
    throw new Error("Timeline not set");
  }
  
  if (s.timeline[0].command !== "node -v") {
    throw new Error("Timeline content mismatch");
  }
});

})();
