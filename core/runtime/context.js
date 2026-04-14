let runtime = {
  projectDir: process.cwd(),
  model: null,
  provider: null,
  apiUrl: null
};

export function setRuntime(update) {
  runtime = { ...runtime, ...update };
}

export function getRuntime() {
  return runtime;
}
