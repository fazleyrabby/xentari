import readline from "node:readline";

export function confirm(question) {
  return new Promise((resolve) => {
    process.stdout.write(`${question} (y/n) `);

    readline.emitKeypressEvents(process.stdin);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }

    const onKeypress = (str, key) => {
      const lower = (str || "").toLowerCase();
      
      if (lower === "y") {
        cleanup();
        resolve(true);
      } else if (lower === "n" || (key && key.ctrl && key.name === 'c')) {
        cleanup();
        resolve(false);
      } else if (key && key.name === "return") {
        // Default to yes on enter? No, force y/n
      }
    };

    function cleanup() {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw); // Restore previous state
        process.stdin.pause(); // Return to idle state for main loop
      }
      process.stdin.removeListener("keypress", onKeypress);
    }

    process.stdin.on("keypress", onKeypress);
  });
}