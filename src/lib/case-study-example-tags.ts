/**
 * A037 — discipline and customer-sector tags on legacy profile case studies.
 * Disciplines: walkthrough discipline research → SETUP_WORK_SUGGESTIONS (first-session).
 * Sectors: brief client types only (domestic / commercial / public) — not discipline.
 *
 * Inferred tags are suggestions in the UI only. They are persisted only after an
 * explicit chip choice (`disciplineTagsExplicit` / `sectorTagsExplicit`).
 */

import { JOB_TYPE_EXAMPLES } from "./job-type-options";
import { SETUP_WORK_SUGGESTIONS } from "./first-session";
import type { ClientType } from "./guided-brief";

export const CASE_STUDY_DISCIPLINE_TAGS: readonly string[] = SETUP_WORK_SUGGESTIONS;

export type CaseStudySectorId = ClientType;

export const CASE_STUDY_SECTOR_TAGS: ReadonlyArray<{ id: CaseStudySectorId; label: string }> = [
    { id: "domestic", label: "Residential" },
    { id: "commercial", label: "Commercial" },
    { id: "public", label: "Public sector" },
] as const;

export const CASE_STUDY_TAG_LIMITS = { disciplines: 6, sectors: 3 } as const;

const disciplineSet = new Set<string>(CASE_STUDY_DISCIPLINE_TAGS);
const sectorIds = new Set<CaseStudySectorId>(CASE_STUDY_SECTOR_TAGS.map((entry) => entry.id));

export function normaliseDisciplineTags(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of value) {
        if (typeof item !== "string") continue;
        const trimmed = item.trim();
        if (!trimmed || !disciplineSet.has(trimmed) || seen.has(trimmed)) continue;
        seen.add(trimmed);
        out.push(trimmed);
        if (out.length >= CASE_STUDY_TAG_LIMITS.disciplines) break;
    }
    return out;
}

export function normaliseSectorTags(value: unknown): CaseStudySectorId[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<CaseStudySectorId>();
    const out: CaseStudySectorId[] = [];
    for (const item of value) {
        if (typeof item !== "string") continue;
        const id = item.trim() as CaseStudySectorId;
        if (!sectorIds.has(id) || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
        if (out.length >= CASE_STUDY_TAG_LIMITS.sectors) break;
    }
    return out;
}

export function toggleDisciplineTag(selected: readonly string[], tag: string): string[] {
    if (!disciplineSet.has(tag)) return [...selected];
    const has = selected.includes(tag);
    const next = has ? selected.filter((value) => value !== tag) : [...selected, tag];
    return normaliseDisciplineTags(next);
}

export function toggleSectorTag(selected: readonly CaseStudySectorId[], id: CaseStudySectorId): CaseStudySectorId[] {
    if (!sectorIds.has(id)) return [...selected];
    const has = selected.includes(id);
    const next = has ? selected.filter((value) => value !== id) : [...selected, id];
    return normaliseSectorTags(next);
}

/** Evidence-based defaults for the eight job-type datalist examples (not a closed taxonomy). */
export const JOB_TYPE_EXAMPLE_TAG_HINTS: Readonly<
    Record<(typeof JOB_TYPE_EXAMPLES)[number], { disciplines: readonly string[]; sectors: readonly CaseStudySectorId[] }>
> = {
    Extension: { disciplines: ["General building", "Carpentry & joinery"], sectors: ["domestic", "commercial"] },
    "Loft Conversion": { disciplines: ["General building", "Carpentry & joinery"], sectors: ["domestic"] },
    "New Build": { disciplines: ["General building", "Groundworks & civils"], sectors: ["domestic", "commercial"] },
    Renovation: { disciplines: ["Refurbishment & fit-out"], sectors: ["domestic", "commercial"] },
    "Bathroom/Kitchen": { disciplines: ["Refurbishment & fit-out", "Plumbing & heating"], sectors: ["domestic"] },
    Roofing: { disciplines: ["Roofing"], sectors: ["domestic", "commercial"] },
    "General Works": { disciplines: ["General building"], sectors: ["domestic", "commercial", "public"] },
    Other: { disciplines: [], sectors: [] },
};

function normalisedJobTypeKey(projectType: string): (typeof JOB_TYPE_EXAMPLES)[number] | null {
    const trimmed = projectType.trim();
    if (!trimmed) return null;
    const exact = JOB_TYPE_EXAMPLES.find((example) => example.toLowerCase() === trimmed.toLowerCase());
    return exact ?? null;
}

export function disciplineHintsForExample(projectType: string): string[] {
    const key = normalisedJobTypeKey(projectType);
    if (!key) return [];
    return normaliseDisciplineTags([...JOB_TYPE_EXAMPLE_TAG_HINTS[key].disciplines]);
}

export function sectorHintsForExample(projectType: string): CaseStudySectorId[] {
    const key = normalisedJobTypeKey(projectType);
    if (!key) return [];
    return normaliseSectorTags([...JOB_TYPE_EXAMPLE_TAG_HINTS[key].sectors]);
}

const CLIENT_SECTOR_PATTERNS: ReadonlyArray<{ id: CaseStudySectorId; patterns: readonly RegExp[] }> = [
    { id: "public", patterns: [/\bcouncil\b/i, /\bpublic\s+sector\b/i, /\bnhs\b/i, /\bschool\b/i, /\blocal\s+authority\b/i] },
    { id: "commercial", patterns: [/\bltd\b/i, /\bplc\b/i, /\bcompany\b/i, /\bbusiness\b/i, /\bcommercial\b/i, /\bretail\b/i, /\boffice\b/i] },
    {
        id: "domestic",
        patterns: [/\bhomeowner\b/i, /\bprivate\b/i, /\bresidential\b/i, /\bmr\b/i, /\bmrs\b/i, /\bhouse\b/i, /\bflat\b/i],
    },
];

/** Substring/keyword match on saved client text only — no AI inference. */
export function sectorHintsFromClientText(client: string): CaseStudySectorId[] {
    const haystack = client.trim();
    if (!haystack) return [];
    const matched: CaseStudySectorId[] = [];
    for (const row of CLIENT_SECTOR_PATTERNS) {
        if (row.patterns.some((pattern) => pattern.test(haystack))) matched.push(row.id);
    }
    return normaliseSectorTags(matched);
}

export interface LegacyCaseStudyTagFields {
    disciplineTags: string[];
    sectorTags: CaseStudySectorId[];
}

export interface LegacyCaseStudyTagState extends LegacyCaseStudyTagFields {
    disciplineTagsExplicit: boolean;
    sectorTagsExplicit: boolean;
}

type TagCarrier = {
    projectType?: string;
    client?: string;
    disciplineTags?: unknown;
    sectorTags?: unknown;
    disciplineTagsExplicit?: unknown;
    sectorTagsExplicit?: unknown;
};

function disciplineSelectionExplicit(fields: TagCarrier): boolean {
    if (fields.disciplineTagsExplicit === true) return true;
    return Array.isArray(fields.disciplineTags) && fields.disciplineTags.length > 0;
}

function sectorSelectionExplicit(fields: TagCarrier): boolean {
    if (fields.sectorTagsExplicit === true) return true;
    return Array.isArray(fields.sectorTags) && fields.sectorTags.length > 0;
}

/** Stored selections only — never merges inferred hints. */
export function readStoredExampleTags(fields: TagCarrier): LegacyCaseStudyTagState {
    const disciplineTagsExplicit = disciplineSelectionExplicit(fields);
    const sectorTagsExplicit = sectorSelectionExplicit(fields);
    return {
        disciplineTags: disciplineTagsExplicit ? normaliseDisciplineTags(fields.disciplineTags) : [],
        sectorTags: sectorTagsExplicit ? normaliseSectorTags(fields.sectorTags) : [],
        disciplineTagsExplicit,
        sectorTagsExplicit,
    };
}

/** UI suggestions from job type and client text — not written to storage by themselves. */
export function exampleTagSuggestions(fields: { projectType?: string; client?: string }): LegacyCaseStudyTagFields {
    const projectType = typeof fields.projectType === "string" ? fields.projectType : "";
    const client = typeof fields.client === "string" ? fields.client : "";
    return {
        disciplineTags: disciplineHintsForExample(projectType),
        sectorTags: normaliseSectorTags([...sectorHintsForExample(projectType), ...sectorHintsFromClientText(client)]),
    };
}

/** Suggested discipline ids that are not already selected. */
export function suggestedDisciplineChips(selected: readonly string[], suggestions: readonly string[]): string[] {
    const chosen = new Set(selected);
    return suggestions.filter((tag) => !chosen.has(tag));
}

/** Suggested sector ids that are not already selected. */
export function suggestedSectorChips(selected: readonly CaseStudySectorId[], suggestions: readonly CaseStudySectorId[]): CaseStudySectorId[] {
    const chosen = new Set(selected);
    return suggestions.filter((id) => !chosen.has(id));
}

/** Drop tag arrays that were never explicitly chosen — suggestions must not reach storage. */
export function legacyCaseStudyForSave<T extends TagCarrier>(entry: T): T {
    const copy = { ...(entry as TagCarrier & T) };
    if (copy.disciplineTagsExplicit === true) {
        copy.disciplineTags = normaliseDisciplineTags(copy.disciplineTags);
    } else {
        delete copy.disciplineTags;
        delete copy.disciplineTagsExplicit;
    }
    if (copy.sectorTagsExplicit === true) {
        copy.sectorTags = normaliseSectorTags(copy.sectorTags);
    } else {
        delete copy.sectorTags;
        delete copy.sectorTagsExplicit;
    }
    return copy as T;
}