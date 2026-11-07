/**
 * A030: accreditations are still one saved text field. The profile edits it as
 * a list of the contractor's own free-text entries, one per line.
 *
 * - Nothing is split on commas or other punctuation: "CITB, FMB Member" is one entry.
 * - Until the list is changed, the stored text is posted back exactly as saved.
 * - Once changed, the value is the entries, each trimmed, blanks dropped, joined by "\n".
 * - Text left in the add box is part of what is saved, the same as if Add had been pressed.
 */
export const ACCREDITATION_SEPARATOR = "\n";

/** Entries shown for the stored text: one per non-blank line, nothing else split. */
export function accreditationEntries(stored: string | null | undefined): string[] {
    return (stored ?? "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

/** The value posted as `accreditations`. `edited` is null while the list is untouched. */
export function accreditationsValue(stored: string | null | undefined, edited: string[] | null, draft: string): string {
    if (edited === null && !draft.trim()) return stored ?? "";
    const entries = [...(edited ?? accreditationEntries(stored)), draft];
    return entries.map(entry => entry.trim()).filter(Boolean).join(ACCREDITATION_SEPARATOR);
}
