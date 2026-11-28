/**
 * Static checks for A001 brand palette: primary actions must not use legacy brand-blue CTAs.
 */

import {
    FORBIDDEN_PRIMARY_ACTION_RE,
    findLinesMatching,
} from "./a001-brand-consistency-guard";

export { FORBIDDEN_PRIMARY_ACTION_RE };

export function findForbiddenPrimaryActionLines(source: string): string[] {
    return findLinesMatching(source, FORBIDDEN_PRIMARY_ACTION_RE);
}

export function assertNoForbiddenPrimaryActions(source: string, label: string): void {
    const hits = findForbiddenPrimaryActionLines(source);
    if (hits.length > 0) {
        throw new Error(`${label}: forbidden brand-blue primary action(s):\n${hits.join("\n")}`);
    }
}
