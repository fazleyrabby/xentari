export class ApprovalType {
  static PATCH_APPLY = "patch_apply";
  static FILE_WRITE = "file_write";
  static COMMAND_EXEC = "command_exec";
}

export class ApprovalRequest {
  type = "";
  message = "";
  details? = "";
}
