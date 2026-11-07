import { draftFromProject, TEXT_LIMITS } from "./proposal-review";

export const SCOPE_NOTE_COLUMNS = ["exclusions_text", "clarifications_text", "contract_exclusions", "contract_clarifications"] as const;
export type PricingScopeNotesSource = Record<typeof SCOPE_NOTE_COLUMNS[number], string | null>;
export type PricingScopeNotes = { exclusions: string; clarifications: string };

export function pricingScopeNoteDraft(source: PricingScopeNotesSource): PricingScopeNotes {
    const draft = draftFromProject({ id: "pricing", name: "", ...source }, () => "unused");
    return { exclusions: draft.exclusions, clarifications: draft.clarifications };
}

export function pricingScopeNoteError(source: PricingScopeNotesSource, notes: PricingScopeNotes): string | null {
    if (notes.exclusions.length > TEXT_LIMITS.exclusions || notes.clarifications.length > TEXT_LIMITS.clarifications) {
        return "Keep each note field to 10,000 characters or fewer. Nothing has been shortened.";
    }
    if ((!notes.exclusions.trim() && source.contract_exclusions?.trim()) || (!notes.clarifications.trim() && source.contract_clarifications?.trim())) {
        return "Existing contract notes would reappear in the proposal if this field were blank. Review those contract notes before clearing it; they have not been changed here.";
    }
    return null;
}
