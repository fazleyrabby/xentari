import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as planner from "./planner.js";
import { validator, testRunner } from "./validator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const patterns = {
  controller: fs.readFileSync(path.join(__dirname, "patterns/controller.pattern.js"), "utf-8"),
  service: fs.readFileSync(path.join(__dirname, "patterns/service.pattern.js"), "utf-8"),
  model: fs.readFileSync(path.join(__dirname, "patterns/model.pattern.js"), "utf-8"),
  routes: fs.readFileSync(path.join(__dirname, "patterns/routes.pattern.js"), "utf-8")
};

export default {
  patterns,
  planner,
  validator,
  testRunner,
  rules: "Patterns use CommonJS (module.exports). Do NOT use ES modules. Do NOT use classes. Use function-based structures."
};
