import { ApprovalType } from "../types/index.ts";

export const APPROVAL_TYPES: Record<string, ApprovalType> = {
  PATCH: "patch_apply",
  FILE_WRITE: "file_write",
  COMMAND: "command_exec",
};
