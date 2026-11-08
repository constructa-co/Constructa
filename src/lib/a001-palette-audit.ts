/**
 * Static checks for A001 brand palette: primary actions must not use legacy brand-blue CTAs.
 */

/** Legacy primary-action pattern that must not appear on dashboard / shared app surfaces. */
export const FORBIDDEN_PRIMARY_ACTION_RE =
    /bg-blue-600\s+hover:bg-blue-700/;

export function findForbiddenPrimaryActionLines(source: string): string[] {
    const hits: string[] = [];
    for (const line of source.split("\n")) {
        if (FORBIDDEN_PRIMARY_ACTION_RE.test(line)) {
            hits.push(line.trim());
        }
    }
    return hits;
}

export function assertNoForbiddenPrimaryActions(source: string, label: string): void {
    const hits = findForbiddenPrimaryActionLines(source);
    if (hits.length > 0) {
        throw new Error(`${label}: forbidden brand-blue primary action(s):\n${hits.join("\n")}`);
    }
}
