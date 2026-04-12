import fs from "fs";

export function cleanupSandbox(sandboxRoot) {
  try {
    fs.rmSync(sandboxRoot, { recursive: true, force: true });
  } catch (e) {
    console.warn("Sandbox cleanup failed");
  }
}
