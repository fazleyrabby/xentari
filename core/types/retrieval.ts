export class RetrievalContract {
  required: string[] = [];
  optional: string[] = [];
  maxTokens = 0;
}

export class RetrievalValidationResult {
  valid = false;
  missing: string[] = [];
}
