export class ApprovalType {
}
ApprovalType.PATCH_APPLY = "patch_apply";
ApprovalType.FILE_WRITE = "file_write";
ApprovalType.COMMAND_EXEC = "command_exec";
export class ApprovalRequest {
    constructor() {
        this.type = "";
        this.message = "";
        this.details = "";
    }
}
