import fs from "fs";
import path from "path";
import { getState } from "../ui/state.js";
import { getRuntime } from "../runtime/context.js";

function getProjectFiles() {
  try {
    const { projectDir } = getRuntime();
    if (!projectDir) return [];

    function walk(current, depth = 0) {
      if (typeof depth !== "number") depth = 0;
      
      const maxDepth = 2;
      if (depth > maxDepth) return [];
      if (!current.startsWith(projectDir)) return [];

      try {
        const entries = fs.readdirSync(current);
        return entries.flatMap(file => {
          const full = path.join(current, file);

          if (file.startsWith(".") || file === "node_modules") return [];

          try {
            const stat = fs.statSync(full);

            if (stat.isDirectory()) {
              return [{
                type: "dir",
                name: file,
                children: walk(full, depth + 1)
              }];
            }

            return [{
              type: "file",
              name: file
            }];
          } catch {
            return [];
          }
        });
      } catch {
        return [];
      }
    }

    return walk(projectDir);
  } catch (err) {
    console.error("Critical error in getProjectFiles:", err);
    return [];
  }
}

export function getContext() {
  try {
    const state = getState();

    return {
      stack: state.stack || null,
      phase: state.phase || null,
      mode: state.mode || "safe",
      trace: state.trace?.slice(-5) || [],
      actions: state.actions?.slice(-5) || [],
      files: getProjectFiles() || []
    };
  } catch (e) {
    console.error("Context error:", e);
    return {
      stack: null,
      phase: null,
      mode: "safe",
      trace: [],
      actions: [],
      files: []
    };
  }
}
