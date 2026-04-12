import { CONTRACTS } from "./contract.ts";
export function resolveContract(taskType) {
    return CONTRACTS[taskType] || CONTRACTS.modify_function;
}
