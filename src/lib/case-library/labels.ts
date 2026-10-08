/**
 * Case-study library: discipline labels, suggestions and tag matching. Pure.
 * NOT USED BY THE APPLICATION YET. See `content.ts`.
 */

import { BRIEF_TRADES } from "@/lib/guided-brief";
import { PROJECT_TYPES_BY_TRADE } from "@/lib/project-types";
import { CONTENT_LIMITS, labelProblem, trimSpaces } from "./content";

export const DISCIPLINE_LIMITS = { active: 12, perStudy: CONTENT_LIMITS.disciplinesPerStudy, label: CONTENT_LIMITS.label, suggestions: 12 } as const;

/**
 * How two labels are compared: outer spaces removed, runs of spaces
 * collapsed, and the letters A to Z lowered. Only A to Z, on purpose, so the
 * application and every database give the same key. The same rule is
 * `public.case_library_label_key`.
 */
export function labelKey(label: string): string {
    return trimSpaces(label.replace(/ +/g, " ")).replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/** Tidies what someone typed into a label that may be saved, or null if it cannot be one. */
export function cleanLabel(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const label = trimSpaces(input.replace(/[\u0001-\u001F\u007F]/g, " ").replace(/ +/g, " "));
    return labelProblem(label) === null ? label : null;
}

/**
 * The names the rest of the product already uses for kinds of work: the
 * Brief's trades and the job types. A discipline given one of these names can
 * match a job exactly. One typed freely usually will not, and is still
 * useful as a filter the contractor taps.
 */
export const CANONICAL_WORK_NAMES: readonly string[] = Array.from(new Set([
    ...BRIEF_TRADES,
    ...Object.keys(PROJECT_TYPES_BY_TRADE).filter((name) => name !== "default"),
    ...Object.values(PROJECT_TYPES_BY_TRADE).flat().filter((name) => name !== "Other"),
]));

/**
 * Disciplines to offer once, from the contractor's setup answer. They are
 * suggestions: nothing is created until the contractor saves. The answer is
 * split on commas, as the rest of the product splits it; pieces that cannot
 * be labels, or that the contractor already has, are left out.
 */
export function suggestDisciplines(setupAnswer: unknown, existingLabels: readonly string[] = []): string[] {
    if (typeof setupAnswer !== "string") return [];
    const taken = new Set(existingLabels.map(labelKey));
    const suggestions: string[] = [];
    // The setup answer is at most 200 characters, so this is a handful of pieces.
    for (const piece of setupAnswer.slice(0, 400).split(",")) {
        const label = cleanLabel(piece);
        if (!label) continue;
        const key = labelKey(label);
        if (taken.has(key)) continue;
        taken.add(key);
        suggestions.push(label);
        if (suggestions.length >= DISCIPLINE_LIMITS.suggestions) break;
    }
    return suggestions;
}

export interface TaggedStudy {
    id: string;
    /** Labels of the study's active disciplines. */
    labels: readonly string[];
    /** Ids of the study's active disciplines. */
    disciplineIds: readonly string[];
}

export interface TagGroups<T extends TaggedStudy> {
    /** Tagged for this kind of work: by a chip the contractor tapped, or by an exact name match with the job. */
    tagged: T[];
    /** Tagged, but for other kinds of work. */
    other: T[];
    notTagged: T[];
    /** How `tagged` was decided, so a screen can say so. */
    basis: "chips" | "job" | "none";
}

/**
 * Sorts case studies into groups for a job. It never selects anything.
 *
 * If the contractor has tapped chips, those decide. Otherwise a study is
 * "tagged for this kind of work" only when one of its labels is exactly a
 * name the job carries (compared by `labelKey`). No near matches: "kitchen"
 * does not match "Kitchen Installation", and "framing" never appears for a
 * kitchen job because the words overlap.
 */
export function groupByTag<T extends TaggedStudy>(input: { studies: readonly T[]; jobSignals: readonly unknown[]; chosenDisciplineIds?: readonly string[] }): TagGroups<T> {
    const chosen = new Set(input.chosenDisciplineIds ?? []);
    const signals = new Set(input.jobSignals.filter((signal): signal is string => typeof signal === "string").map(labelKey).filter((key) => key !== ""));
    const basis: TagGroups<T>["basis"] = chosen.size > 0 ? "chips" : signals.size > 0 ? "job" : "none";

    const groups: TagGroups<T> = { tagged: [], other: [], notTagged: [], basis };
    for (const study of input.studies) {
        if (study.labels.length === 0 && study.disciplineIds.length === 0) {
            groups.notTagged.push(study);
        } else if (basis === "chips" ? study.disciplineIds.some((id) => chosen.has(id)) : basis === "job" && study.labels.some((label) => signals.has(labelKey(label)))) {
            groups.tagged.push(study);
        } else {
            groups.other.push(study);
        }
    }
    return groups;
}
