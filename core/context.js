import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "./config.js";

let _summary;

export function getSummary() {
  if (_summary !== undefined) return _summary;
  try {
    _summary = readFileSync(
      join(loadConfig().root, "context", "summary.md"),
      "utf-8"
    );
  } catch {
    _summary = "";
  }
  return _summary;
}
