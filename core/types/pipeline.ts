export class Task {
  id = 0;
  step = "";
  files: string[] = [];
  dependsOn: number[] = [];
  type? = "";
  filePath? = "";
  functionName? = "";
}

export class Context {
  file? = "";
  imports?: string[] = [];
  functionBlock? = "";
  dependencies?: string[] = [];
}

export class PipelineResult {
  success = false;
  modifiedFiles: string[] = [];
  error? = "";
}

export class AgentOptions {
  task = "";
  projectDir = "";
  dryRun = false;
  autoMode = false;
  sandbox? = false;
}
