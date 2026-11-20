/**
 * Estimate line types that are carried at face value.
 *
 * A prime-cost (PC) sum or provisional sum is an allowance the client reads
 * as a sum to be spent, not as the contractor's priced work. It is therefore
 * never multiplied by the overhead / risk / profit / discount adjustments:
 * the proposal shows exactly the figure the contractor typed, in its own
 * block, separate from the marked-up work.
 *
 * The stored column is plain TEXT with no CHECK constraint, so these values
 * need no migration; unknown stored values are carried through untouched and
 * keep their existing (fully marked-up) behaviour.
 */

export const FACE_VALUE_LINE_TYPES = ["pc_sum", "provisional_sum"] as const;

export type FaceValueLineType = (typeof FACE_VALUE_LINE_TYPES)[number];

export function isFaceValueLineType(value: string | null | undefined): value is FaceValueLineType {
    return FACE_VALUE_LINE_TYPES.includes(value as FaceValueLineType);
}
