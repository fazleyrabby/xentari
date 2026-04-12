export class PatchResult {
  applied = false;
  valid = false;
  reason? = "";
}

export class PatchValidationResult {
  valid = false;
  errors: string[] = [];
}

export class FileUpdate {
  file = "";
  content = "";
}
