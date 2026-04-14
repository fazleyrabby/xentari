import { buildContext } from "./core/context/buildContext.ts";
const ctx = buildContext(process.cwd());
console.log("Files:", ctx.files);
console.log("Snippets:", ctx.snippets.map(s => s.path));
