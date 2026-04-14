import fs from "fs";
import path from "path";

export function buildContext(projectDir) {
  const files = fs.readdirSync(projectDir).filter(file => {
    const full = path.join(projectDir, file);
    return fs.statSync(full).isFile();
  }).slice(0, 3);

  return {
    snippets: files.map(file => {
      const full = path.join(projectDir, file);

      return {
        path: file,
        content: fs.readFileSync(full, "utf-8").slice(0, 500)
      };
    }),
    files
  };
}
