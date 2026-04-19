import { buildContext } from "../../core/context/buildContext.ts";

export function test(assert) {
  const projectDir = process.cwd();
  
  const res1 = buildContext(projectDir);
  const res2 = buildContext(projectDir);

  assert(res1.files.length === res2.files.length, "File count must be consistent");
  assert(JSON.stringify(res1.files) === JSON.stringify(res2.files), "File list must be identical");
  assert(res1.structure.length === res2.structure.length, "Structure count must be consistent");
}
