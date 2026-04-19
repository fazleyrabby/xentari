import { runTest } from "./testRunner.js";
import { getContext } from "../core/context/contextEngine.js";

(async () => {

await runTest("Context: structure exists", async () => {
  const ctx = getContext();

  // Based on current state and dummy files scan
  if (!ctx.files) {
    throw new Error("Files missing from context");
  }
  
  console.log("Context structure verification passed");
});

})();
