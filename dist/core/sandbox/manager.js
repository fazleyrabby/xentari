import fs from "fs";
import path from "path";
import os from "os";
export function createSandbox(projectRoot) {
    const sandboxRoot = path.join(os.tmpdir(), "xentari-sandbox-" + Date.now());
    fs.cpSync(projectRoot, sandboxRoot, {
        recursive: true
    });
    return sandboxRoot;
}
