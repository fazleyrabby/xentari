let runtime = {
  projectDir: process.cwd(),
  model: "",
  provider: "",
  apiUrl: ""
};

export function setRuntime(update) {
  runtime = { ...runtime, ...update };
}

export function getRuntime() {
  return runtime;
}
