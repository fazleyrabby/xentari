import readline from "node:readline";

export function askPermission({ command, reason, stack }) {
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
