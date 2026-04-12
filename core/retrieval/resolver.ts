import { CONTRACTS } from "./contract.ts";
import { RetrievalContract } from "../types/index.ts";

export function resolveContract(taskType: string): RetrievalContract {
  return CONTRACTS[taskType] || CONTRACTS.modify_function;
}
