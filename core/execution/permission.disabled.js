import readline from "node:readline";

export function askPermission({ command, reason, stack }, context = {}) {
  // E16 — AUTO Mode: Controlled Automation
  if (context.auto === true || process.env.XEN_AUTO_APPROVE === "true") {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `\n[EXECUTION REQUEST]\nStack: ${stack}\nCommand: ${command}\nReason: ${reason}\nAllow? (y/n): `,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y");
      }
    );
  });
}
