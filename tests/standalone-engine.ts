import { analyze } from "../core/engine/analyze.ts";
import path from "path";

async function test() {
  console.log("Starting standalone analysis...");
  const projectDir = "/Users/rabbi/Desktop/Projects/Laravel/rh-ecommerce";
  try {
    const result = await analyze(projectDir);
    console.log("Analysis Complete.");
    console.log(result.fullText.slice(0, 500) + "...");
  } catch (err) {
    console.error("Analysis Failed:", err);
    process.exit(1);
  }
}

test();
