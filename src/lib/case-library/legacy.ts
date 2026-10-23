/**
 * Case-study library: reading the older case studies in `profiles.case_studies`. Pure.
 * NOT USED BY THE APPLICATION YET. See `content.ts`.
 *
 * This describes the older entries exactly as the product treats them today.
 * It does not tidy, re-key or repair them: an entry is known by its place in
 * the list and, if it has one, by its `id`, and both can be shared or collide.
 */

import { contentFromInput, type CaseStudyContent } from "./content";

export interface LegacyCaseStudy {
    /** Its place in the stored list. */
    index: number;
    /** Its own id, if it has a non-empty one. Not guaranteed unique. */
    id: string | null;
    /** What the review screen saves when this entry is ticked: its id, or its place as text. */
    selectionId: string;
    title: string;
    workType: string;
    /** Every saved selection value that would include this entry in a proposal today. */
    matchedBy: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * The older entries a contractor can see and tick: those with a title, as on
 * the review screen today. Entries keep their original place, so an entry
 * without a title still counts towards the places of those after it.
 */
export function legacyCaseStudies(stored: unknown): LegacyCaseStudy[] {
    if (!Array.isArray(stored)) return [];
    const entries: LegacyCaseStudy[] = [];
    stored.forEach((entry, index) => {
        const row = isObject(entry) ? entry : {};
        const title = text(row.projectName);
        if (!title) return;
        const id = typeof row.id === "string" && row.id ? row.id : null;
        entries.push({
            index,
            id,
            selectionId: id ?? String(index),
            title,
            workType: text(row.projectType),
            // Publication includes an entry when the saved list holds its place as text, or its id.
            matchedBy: id !== null && id !== String(index) ? [String(index), id] : [String(index)],
        });
    });
    return entries;
}

export interface LegacyIdentityProblem {
    kind: "shared-id" | "id-is-another-place";
    value: string;
    /** Places of the entries involved. */
    indexes: number[];
}

/**
 * Where today's identity rule is ambiguous in a stored list: two entries
 * sharing an id (ticking one sends both), and an id that is also the place of
 * a different entry (ticking by that value sends both). Reported, not fixed.
 */
export function legacyIdentityProblems(stored: unknown): LegacyIdentityProblem[] {
    const entries = legacyCaseStudies(stored);
    const problems: LegacyIdentityProblem[] = [];
    const byId = new Map<string, number[]>();
    for (const entry of entries) if (entry.id !== null) byId.set(entry.id, [...(byId.get(entry.id) ?? []), entry.index]);
    for (const [value, indexes] of byId) {
        if (indexes.length > 1) problems.push({ kind: "shared-id", value, indexes });
        const other = entries.find((entry) => String(entry.index) === value && !indexes.includes(entry.index));
        if (other) problems.push({ kind: "id-is-another-place", value, indexes: [...indexes, other.index].sort((a, b) => a - b) });
    }
    return problems;
}

/**
 * A first draft from an older entry, for "bring into the library". Text only.
 * The client is NOT carried over as shown: the older entry never recorded a
 * choice, so the draft starts with the client hidden and the figure not
 * shown, and the contractor decides. Pictures are not carried at all.
 */
export function draftFromLegacy(entry: unknown): CaseStudyContent {
    const row = isObject(entry) ? entry : {};
    return contentFromInput({
        title: text(row.projectName).slice(0, 200),
        work_type: text(row.projectType).slice(0, 200),
        place: text(row.location).slice(0, 200),
        client_display: "hidden",
        client_text: text(row.client).slice(0, 200),
        client_named_ok: false,
        value_text: text(row.contractValue).slice(0, 50),
        show_value: false,
        duration_text: text(row.programmeDuration).slice(0, 100),
        delivered: typeof row.whatWeDelivered === "string" ? row.whatWeDelivered.trim().slice(0, 5000) : "",
        value_added: typeof row.valueAdded === "string" ? row.valueAdded.trim().slice(0, 5000) : "",
    });
}
