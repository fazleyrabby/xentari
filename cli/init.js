import fs from "node:fs";
import path from "node:path";
import { detectStack } from "../core/stackDetector.js";

function configExists() {
  return fs.existsSync(path.join(process.cwd(), ".xentari/config.json"));
}

function saveConfig(stack) {
  const dir = path.join(process.cwd(), ".xentari");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const config = {
    stack,
    strict: true
  };

  fs.writeFileSync(
    path.join(dir, "config.json"),
    JSON.stringify(config, null, 2)
  );
}

export function init() {
  if (configExists()) {
    console.log("✔ Xentari already initialized");
    return;
  }

  const result = detectStack(process.cwd());

  console.log(`\nDetected stack: ${result.stack}`);
  console.log(`Confidence: ${result.confidence}\n`);

  process.stdout.write("Select option:\n1. Confirm\n2. Change\n3. Manual\n> ");

  process.stdin.setEncoding("utf-8");
  process.stdin.once("data", (data) => {
    const choice = data.trim();

    if (choice === "1") {
      saveConfig(result.stack);
      console.log("✔ Config saved");
    } else {
      console.log("⚠ Manual selection required (implement later)");
    }

    process.exit();
  });
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  init();
}
