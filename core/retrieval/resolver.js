import { CONTRACTS } from "./contract.js";

export function resolveContract(taskType) {
  return CONTRACTS[taskType] || CONTRACTS.modify_function;
}
