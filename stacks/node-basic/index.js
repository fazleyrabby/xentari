export const patterns = {
  controller: "module.exports = { ... }",
  service: "module.exports = { ... }",
  model: "module.exports = { ... }",
  routes: "module.exports = { ... }"
};

export const validator = (code) => {
  return { valid: true };
};

export const planner = {
  maxSteps: 4
};

export const testRunner = (code) => {
  return { success: true };
};

export default {
  patterns,
  validator,
  planner,
  testRunner
};
