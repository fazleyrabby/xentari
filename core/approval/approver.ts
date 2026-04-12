import readline from "readline";
import { loadConfig } from "../config.js";
import { ApprovalRequest } from "../types/approval.ts";

export async function askApproval({ type, message, details }: ApprovalRequest): Promise<boolean> {
  const config = loadConfig();
  
  // NON-INTERACTIVE MODE (SAFE DEFAULT)
  if (!config.interactive) {
    return true;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🔐 Approval Required: ${type}`);
    console.log(message);

    if (details) {
      console.log("\n--- Details (preview) ---");
      console.log(details.slice(0, 500));
    }

    rl.question("\nApprove? (y/n): ", (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}
