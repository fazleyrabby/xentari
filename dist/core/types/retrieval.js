export class RetrievalContract {
    constructor() {
        this.required = [];
        this.optional = [];
        this.maxTokens = 0;
    }
}
export class RetrievalValidationResult {
    constructor() {
        this.valid = false;
        this.missing = [];
    }
}
