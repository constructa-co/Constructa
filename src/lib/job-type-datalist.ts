import { JOB_TYPE_EXAMPLES } from "./job-type-options";

/** Saved contractor text only — no inferred trade taxonomy. */
export type ExplicitJobTypeContext = {
    /** Distinct `projects.project_type` values already saved for this contractor. */
    priorProjectTypes?: readonly string[];
    /** `profiles.business_type` — contractor's own words from setup/profile. */
    businessType?: string | null;
    /** `profiles.specialisms` — services / work description. */
    specialisms?: string | null;
    /** `profiles.preferred_trades` — explicit trade selections when present. */
    preferredTrades?: readonly string[] | null;
};

const MAX_PRIOR = 12;

function cleanType(value: string): string {
    return value.trim();
}

function explicitHaystack(context: ExplicitJobTypeContext): string {
    return [
        context.businessType ?? "",
        context.specialisms ?? "",
        ...(context.preferredTrades ?? []),
    ]
        .map(cleanType)
        .filter(Boolean)
        .join("\n")
        .toLowerCase();
}

/** True when the example label (or a slash-separated segment) appears in saved text. */
export function standardExampleMentionedInExplicitText(example: string, haystackLower: string): boolean {
    const needle = example.toLowerCase();
    if (haystackLower.includes(needle)) return true;
    return example.split("/").some(part => {
        const segment = part.trim().toLowerCase();
        return segment.length > 0 && haystackLower.includes(segment);
    });
}

/**
 * Build datalist options: contractor history first, then standard examples with
 * explicit-text matches before the rest. Always ends with Other when present.
 * Does not call trade taxonomies or provider/AI helpers.
 */
export function buildJobTypeDatalistOptions(context: ExplicitJobTypeContext = {}): readonly string[] {
    const haystack = explicitHaystack(context);
    const prior = (context.priorProjectTypes ?? [])
        .map(cleanType)
        .filter(Boolean)
        .slice(0, MAX_PRIOR);

    const seen = new Set<string>();
    const ordered: string[] = [];

    const push = (value: string) => {
        if (!value || seen.has(value)) return;
        seen.add(value);
        ordered.push(value);
    };

    for (const value of prior) push(value);

    const standards = [...JOB_TYPE_EXAMPLES];
    const otherIndex = standards.lastIndexOf("Other");
    const other = otherIndex >= 0 ? standards[otherIndex] : null;
    const withoutOther = other ? standards.filter((_, i) => i !== otherIndex) : standards;

    const matched: string[] = [];
    const rest: string[] = [];
    for (const example of withoutOther) {
        if (haystack && standardExampleMentionedInExplicitText(example, haystack)) matched.push(example);
        else rest.push(example);
    }

    for (const example of matched) push(example);
    for (const example of rest) push(example);
    if (other) push(other);

    return ordered;
}

/** Gap note for tests/docs: trade-keyed lists are not authorised for this slice. */
export const JOB_TYPE_RELEVANCE_GAP =
    "Filtering or extending job-type examples via PROJECT_TYPES_BY_TRADE / getProjectTypes() is not authorised; only explicit saved strings and substring matches against the eight standard labels are used.";

export function priorProjectTypesFromRows(rows: readonly { project_type?: string | null }[]): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const row of rows) {
        const value = cleanType(row.project_type ?? "");
        if (!value || seen.has(value)) continue;
        seen.add(value);
        ordered.push(value);
    }
    return ordered;
}
