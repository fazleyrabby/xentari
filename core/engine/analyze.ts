import { runAgent } from "../runtime/runAgent.ts";

/**
 * Xentari Core Engine Entry Point
 * 
 * Standalone function for deterministic project analysis.
 * Follows the principle: Same input -> Byte-identical output.
 */
export async function analyze(projectDir: string, task: string = "analyze this project") {
  return runAgent({
    input: task,
    projectDir
  });
}
