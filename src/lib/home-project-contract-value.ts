import { computeContractSumValue, type EstimateInput, type EstimateLineInput } from "@/lib/financial";

/** Home / active-project cards: canonical when an estimate exists; pipeline budget only when it does not. */
export function homeProjectContractValue(
    estimate: EstimateInput | undefined,
    lines: EstimateLineInput[],
    potentialValue: number | null | undefined,
): number {
    if (!estimate) return potentialValue ?? 0;
    return computeContractSumValue(estimate, lines);
}