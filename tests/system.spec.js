import { runTest } from "./testRunner.js";
import fs from "node:fs";
import path from "node:path";

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file));
    }
  });

  return arrayOfFiles;
}

(async () => {
  console.log("🧠 Starting SYSTEM INVARIANT TESTS\n");

  await runTest("SYSTEM: no direct exec usage in core (outside safeExec)", async () => {
    const coreFiles = getAllFiles("./core");
    const violations = [];

    for (const file of coreFiles) {
      if (file.endsWith("safeExec.js")) continue; // Skip the safe wrapper itself
      if (file.endsWith(".ts") || file.endsWith(".js")) {
        const content = fs.readFileSync(file, "utf-8");
        // Check for direct exec( from child_process
        if (content.includes("exec(")) {
          violations.push(file);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(`Direct exec() found in core files: ${violations.join(", ")}`);
    }
  });

  console.log("\n🧪 System invariant tests complete.");
})();
