export class PatchResult {
    constructor() {
        this.applied = false;
        this.valid = false;
        this.reason = "";
    }
}
export class PatchValidationResult {
    constructor() {
        this.valid = false;
        this.errors = [];
    }
}
export class FileUpdate {
    constructor() {
        this.file = "";
        this.content = "";
    }
}
