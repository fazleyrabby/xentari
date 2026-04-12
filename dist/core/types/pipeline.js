export class Task {
    constructor() {
        this.id = 0;
        this.step = "";
        this.files = [];
        this.dependsOn = [];
        this.type = "";
        this.filePath = "";
        this.functionName = "";
    }
}
export class Context {
    constructor() {
        this.file = "";
        this.imports = [];
        this.functionBlock = "";
        this.dependencies = [];
    }
}
export class PipelineResult {
    constructor() {
        this.success = false;
        this.modifiedFiles = [];
        this.error = "";
    }
}
export class AgentOptions {
    constructor() {
        this.task = "";
        this.projectDir = "";
        this.dryRun = false;
        this.autoMode = false;
        this.sandbox = false;
    }
}
