import { parseArgs } from "node:util";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const API_BASE = process.env.XENTARI_API_URL || "http://localhost:3005";

async function callApi(endpoint: string, body: any) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

async function pollJob(jobId: string, parseJson: boolean = true) {
  while (true) {
    try {
      const response = await fetch(`${API_BASE}/job/${jobId}`);
      const job = await response.json();

      if (job.status === "done") {
        if (parseJson) {
          try {
            return JSON.parse(job.result);
          } catch {
            return job.result;
          }
        }
        return job.result;
      } else if (job.status === "error") {
        throw new Error(job.error);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err: any) {
      console.error(JSON.stringify({ error: err.message }));
      process.exit(1);
    }
  }
}

async function applyFlow(projectPath: string, targetStack: string = "node-basic", commit: boolean = false) {
  // 1. Analyze
  const { jobId: analyzeId } = await callApi("/analyze", { projectPath });
  await pollJob(analyzeId, false);

  // 2. Plan
  const { jobId: planId } = await callApi("/plan", { projectPath });
  const plan = await pollJob(planId);

  // 3. Project
  const projectedPlan = await callApi("/project", { plan, target: targetStack });

  // 4. Patch
  const patches = await callApi("/patch", { projectedPlan });

  // 5. Render
  const rendered = await callApi("/render", { patches: patches.patches });

  // 6. Apply
  const result = await callApi("/apply", { files: rendered.files, root: projectPath });

  if (commit) {
    if (!existsSync(join(projectPath, ".git"))) {
      console.error(JSON.stringify({ error: "Git repository not found in " + projectPath }));
      process.exit(1);
    }

    if (result.created.length > 0) {
      try {
        const filesToStage = result.created.join(" ");
        execSync(`git add ${filesToStage}`, { cwd: projectPath });
        
        const message = `feat(xentari): apply deterministic plan\n\n- created: ${result.created.length} files\n- skipped: ${result.skipped.length} files`;
        execSync(`git commit -m "${message}"`, { cwd: projectPath });
        result.committed = true;
      } catch (err: any) {
        console.error(JSON.stringify({ error: `Git commit failed: ${err.message}` }));
        process.exit(1);
      }
    } else {
      result.committed = false;
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      target: { type: "string" },
      help: { type: "boolean", short: "h" },
      dry: { type: "boolean" },
      write: { type: "boolean" },
      force: { type: "boolean" },
      commit: { type: "boolean" },
    },
  });

  const command = positionals[0];
  const arg = positionals[1];

  if (values.help || !command) {
    console.log("Usage: xen <command> [arg] [--target=<stack>] [--write] [--force] [--dry] [--commit]");
    process.exit(0);
  }

  if (values.commit && !values.write) {
    console.error(JSON.stringify({ error: "commit requires --write" }));
    process.exit(1);
  }

  switch (command) {
    case "analyze": {
      const { jobId } = await callApi("/analyze", { projectPath: arg });
      const result = await pollJob(jobId, false);
      console.log(result);
      break;
    }
    case "plan": {
      const { jobId } = await callApi("/plan", { projectPath: arg });
      const result = await pollJob(jobId);
      console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
      break;
    }
    case "execute": {
      // Assuming execute takes plan from stdin or a file for this wrapper
      console.error(JSON.stringify({ error: "execute command requires structured input, use apply flow" }));
      process.exit(1);
      break;
    }
    case "project": {
      // Expects plan as JSON from stdin
      let input = "";
      process.stdin.on("data", (chunk) => (input += chunk));
      process.stdin.on("end", async () => {
        const plan = JSON.parse(input);
        const result = await callApi("/project", { plan, target: values.target || "node-basic" });
        console.log(JSON.stringify(result, null, 2));
      });
      break;
    }
    case "patch": {
      let input = "";
      process.stdin.on("data", (chunk) => (input += chunk));
      process.stdin.on("end", async () => {
        const projectedPlan = JSON.parse(input);
        const result = await callApi("/patch", { projectedPlan });

        if (values.dry || !values.write) {
          // Analysis -> plan -> project -> patch -> render -> git/patch
          console.log("\n=== XENTARI DRY RUN (NO FILES WRITTEN) ===\n");
          const rendered = await callApi("/render", { patches: result.patches });
          const gitPatch = await callApi("/git/patch", { files: rendered.files });
          console.log(gitPatch.patch);
        } else {
          console.log(JSON.stringify(result, null, 2));
        }
      });
      break;
    }
    case "render": {
      let input = "";
      process.stdin.on("data", (chunk) => (input += chunk));
      process.stdin.on("end", async () => {
        const patches = JSON.parse(input);
        const result = await callApi("/render", { patches: patches.patches || patches });
        console.log(JSON.stringify(result, null, 2));
      });
      break;
    }
    case "apply": {
      if (arg && !arg.startsWith("{")) {
        const isWriteMode = values.write && !values.dry;

        if (!isWriteMode) {
          if (values.commit) {
            console.error(JSON.stringify({ error: "commit requires --write" }));
            process.exit(1);
          }
          // 1. Analyze
          const { jobId: analyzeId } = await callApi("/analyze", { projectPath: arg });
          await pollJob(analyzeId, false);

          // 2. Plan
          const { jobId: planId } = await callApi("/plan", { projectPath: arg });
          const plan = await pollJob(planId);

          // 3. Project
          const projectedPlan = await callApi("/project", { plan, target: values.target || "node-basic" });

          // 4. Patch
          const patches = await callApi("/patch", { projectedPlan });

          // 5. Render
          const rendered = await callApi("/render", { patches: patches.patches });

          // 6. Git Patch
          const gitPatch = await callApi("/git/patch", { files: rendered.files });
          console.log("\n=== XENTARI DRY RUN (NO FILES WRITTEN) ===\n");
          console.log(gitPatch.patch);
        } else {
          // Safety Confirmation
          if (!values.force) {
            process.stdout.write("Apply changes? (y/N): ");
            const input = await new Promise<string>((resolve) => {
              process.stdin.once("data", (data) => resolve(data.toString().trim().toLowerCase()));
            });
            if (input !== "y") {
              console.log("Aborted.");
              process.exit(0);
            }
          }

          console.log("\n=== XENTARI APPLY MODE ===\n");
          // Direct flow if path is provided
          await applyFlow(arg, values.target, !!values.commit);
        }
      } else {
        // Manual apply from JSON stdin
        let input = "";
        process.stdin.on("data", (chunk) => (input += chunk));
        process.stdin.on("end", async () => {
          const { files, root } = JSON.parse(input);
          const result = await callApi("/apply", { files, root });
          console.log(JSON.stringify(result, null, 2));
        });
      }
      break;
    }
    default:
      console.error(JSON.stringify({ error: `Unknown command: ${command}` }));
      process.exit(1);
  }
}

main();
