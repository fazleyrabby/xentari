import { selectContext, formatContext } from "./retrieval/contextEngine.ts";
import { loadConfig } from "./config.js";

export function getContext(task, projectDir = process.cwd()) {
  const bundle = selectContext(task, projectDir);
  return {
    context: formatContext(bundle),
    bundle
  };
}

export function getContextBundle(targetPath, projectDir = process.cwd()) {
  return selectContext(targetPath, projectDir);
}
