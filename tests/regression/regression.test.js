import { runTest } from "../testRunner.js";
import fs from "node:fs";
import path from "node:path";

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  });
  return fileList;
}

(async () => {

await runTest("REGRESSION: no exec usage", async () => {
  const files = getAllFiles("./core");
  
  for (const file of files) {
    if (!file.endsWith(".js") && !file.endsWith(".ts")) continue;
    
    const code = fs.readFileSync(file, "utf-8");
    if (code.includes("child_process.exec(") || code.includes(" exec(")) {
       // Note: we use spawn and execSync (where safe), 
       // but we should avoid the async 'exec' as per prompt.
       throw new Error(`Unsafe exec detected in ${file}`);
    }
  }
});

})();
