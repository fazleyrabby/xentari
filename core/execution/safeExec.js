import { exec } from "node:child_process";
import { validatePolicy } from "./policy.js";
import { isWhitelisted } from "./whitelist.js";
import { askPermission } from "./permission.js";

export function safeExec({ command, reason, stack }) {
  return new Promise(async (resolve) => {
    try {
      const policy = validatePolicy(command);
      if (!policy.allowed) {
        return resolve({
          success: false,
          error: policy.reason,
        });
      }

      if (!isWhitelisted(command)) {
        return resolve({
          success: false,
          error: "Command not in whitelist",
        });
      }

      const allowed = await askPermission({ command, reason, stack });
      if (!allowed) {
        return resolve({
          success: false,
          error: "User denied execution",
        });
      }

      exec(command, (error, stdout, stderr) => {
        if (error) {
          return resolve({
            success: false,
            stderr,
            error: error.message,
          });
        }

        resolve({
          success: true,
          stdout,
          stderr,
          code: 0,
        });
      });
    } catch (err) {
      resolve({
        success: false,
        error: err.message,
      });
    }
  });
}
