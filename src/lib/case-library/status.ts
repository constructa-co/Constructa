/**
 * Case-study library: what state a case study is in, in words, and what has
 * changed since it was approved. Pure.
 */

import { approvedValue, type ApprovedCaseStudy, type CaseStudyContent } from "./content";
import { resolveSelectedCaseStudies, libraryTick } from "./resolve";
import type { ProposalCaseStudy } from "@/lib/proposal-publication";

export type StudyState = "draft" | "approved" | "approved-changed" | "archived";

export const STATE_LABEL: Record<StudyState, string> = {
    draft: "Draft: clients can't see this yet",
    approved: "Approved",
    "approved-changed": "Approved, with changes not yet approved",
    archived: "Archived",
};

const FIELD_NAMES: Array<[keyof CaseStudyContent, string]> = [
    ["title", "the job name"],
    ["work_type", "the type of work"],
    ["place", "the place"],
    ["duration_text", "how long it took"],
    ["delivered", "what you did"],
    ["value_added", "what it meant for the client"],
];

/**
 * What a client would see differently if this were approved again now.
 * Compares the approved copy with the copy an approval would make from the
 * saved draft and the current kinds of work. Empty means nothing a client
 * sees has changed, whatever else moved.
 */
export function changesSinceApproval(approved: ApprovedCaseStudy, draft: CaseStudyContent, currentLabels: readonly string[]): string[] {
    const next = approvedValue(draft, currentLabels);
    const changes = FIELD_NAMES.filter(([key]) => approved[key] !== next[key]).map(([, name]) => name);
    if (approved.client_display !== next.client_display || approved.client_text !== next.client_text) changes.push("how the client is referred to");
    if (approved.show_value !== next.show_value || approved.value_text !== next.value_text) changes.push("the price shown");
    if (approved.disciplines.length !== next.disciplines.length || approved.disciplines.some((label, index) => label !== next.disciplines[index])) changes.push("the kinds of work, or their order");
    return changes;
}

export function studyState(study: { archived: boolean; approved: ApprovedCaseStudy | null; content: CaseStudyContent }, currentLabels: readonly string[]): { state: StudyState; changes: string[] } {
    if (study.archived) return { state: "archived", changes: [] };
    if (!study.approved) return { state: "draft", changes: [] };
    const changes = changesSinceApproval(study.approved, study.content, currentLabels);
    return { state: changes.length > 0 ? "approved-changed" : "approved", changes };
}

const PREVIEW_ID = "00000000-0000-4000-8000-000000000000";

/**
 * An approved copy exactly as a proposal would carry it. Made by running it
 * through the same resolver publication uses, so this cannot drift from what
 * is sent. Null if the copy is not well formed.
 */
export function asProposalCaseStudy(approved: ApprovedCaseStudy): ProposalCaseStudy | null {
    const resolved = resolveSelectedCaseStudies({
        userId: "preview",
        olderStored: [],
        libraryRows: [{ id: PREVIEW_ID, user_id: "preview", approved, approved_revision: 1, archived_at: null }],
        selected: [libraryTick(PREVIEW_ID)],
    });
    return resolved.sendable ? resolved.studies[0] ?? null : null;
}
