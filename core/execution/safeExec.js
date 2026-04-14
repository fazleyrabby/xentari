import { spawn } from "node:child_process";
import { tokenize } from "./parser.js";
import { validatePolicy } from "./policy.js";
import { validateArgs } from "./argValidator.js";
import { isWhitelisted } from "./whitelist.js";
import { askPermission } from "./permission.js";

/**
 * E11 — Exploit-Resistant Execution Wrapper
 * Zero trust for command strings. Uses tokenized structures and spawn.
 */
export async function safeExec({ command, reason, stack }) {
  try {
    // 1. Tokenize (Normalization + Input Sanitization)
    const parsed = tokenize(command);
    if (!parsed.valid) {
      return { success: false, error: parsed.reason };
    }

    // 2. Policy Enforcement (Blocked Commands)
    const policy = validatePolicy(parsed);
    if (!policy.allowed) {
      return { success: false, error: policy.reason };
    }

    // 3. Structured Whitelist Check
    if (!isWhitelisted(parsed)) {
      return { success: false, error: `Command not in whitelist: ${command}` };
    }

    // 4. Argument Validation (Path Traversal + Absolute Paths)
    const argsCheck = validateArgs(parsed.command, parsed.args);
    if (!argsCheck.valid) {
      return { success: false, error: argsCheck.reason };
    }

    // 5. User Permission Gate
    const allowed = await askPermission({ command: parsed.raw, reason, stack });
    if (!allowed) {
      return { success: false, error: "User denied execution" };
    }

    // 6. Safe Execution (Spawn without shell)
    return new Promise((resolve) => {
      const child = spawn(parsed.command, parsed.args, {
        shell: false,
        stdio: "pipe"
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("error", (err) => {
        resolve({
          success: false,
          error: `Execution error: ${err.message}`,
          stdout,
          stderr
        });
      });

      child.on("close", (code) => {
        resolve({
          success: code === 0,
          code,
          stdout,
          stderr
        });
      });
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
}
