import fs from "fs";
import path from "path";
import { getState } from "../ui/state.js";
import { getRuntime } from "../runtime/context.js";

function getProjectFiles() {
  const { projectDir } = getRuntime();
  
  function walk(current, level) {
    if (level > depth) return [];

    try {
      return fs.readdirSync(current).flatMap(file => {
        const full = path.join(current, file);
        
        // Skip hidden files/folders and node_modules
        if (file.startsWith(".") || file === "node_modules") return [];

        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          return [{
            type: "dir",
            name: file,
            children: walk(full, level + 1)
          }];
        }

        return [{
          type: "file",
          name: file
        }];
      });
    } catch (err) {
      return [];
    }
  }

  return walk(projectDir, 0);
}

export function getContext() {
  const state = getState();

  return {
    stack: state.stack,
    phase: state.phase,
    mode: state.mode,
    trace: state.trace?.slice(-5) || [],
    actions: state.actions?.slice(-5) || [],
    files: getProjectFiles()
  };
}
