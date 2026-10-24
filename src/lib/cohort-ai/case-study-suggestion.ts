/**
 * A case-study suggestion waiting for the contractor's decision. Pure.
 *
 * A reply never replaces what is in the form. It is held here, beside a
 * snapshot of the text it was written from, until the contractor chooses
 * "use" or "keep" for each section. If they have edited a section since
 * asking, the suggestion for it is out of date and says so: using it then is
 * a knowing replacement of the newer text, never a silent one.
 */

import type { CaseStudyResult, CaseStudySection } from "./case-study-enhance";

export interface PendingCaseStudySuggestion {
    /** The text each section held when the contractor asked. */
    askedFrom: Record<CaseStudySection, string>;
    /** Suggested wording, only for sections that were reworded and differ from what was asked. */
    suggestions: Partial<Record<CaseStudySection, string>>;
}

/** Null when there is nothing to decide: nothing was suggested, or every suggestion equals the text it came from. */
export function pendingFrom(result: CaseStudyResult, askedFrom: Record<CaseStudySection, string>): PendingCaseStudySuggestion | null {
    if (!result.suggested) return null;
    const suggestions: Partial<Record<CaseStudySection, string>> = {};
    for (const section of result.sections ?? []) {
        const text = (result[section] ?? "").trim();
        if (text && text !== askedFrom[section].trim()) suggestions[section] = text;
    }
    return Object.keys(suggestions).length > 0 ? { askedFrom: { ...askedFrom }, suggestions } : null;
}

/**
 * - `none`   nothing is waiting for this section;
 * - `fresh`  a suggestion is waiting and the section is as it was when asked;
 * - `stale`  a suggestion is waiting but the contractor has changed the section since.
 */
export function sectionState(pending: PendingCaseStudySuggestion | null, section: CaseStudySection, current: string): "none" | "fresh" | "stale" {
    if (!pending || pending.suggestions[section] === undefined) return "none";
    return current === pending.askedFrom[section] ? "fresh" : "stale";
}

/** The suggestion for one section is settled, used or kept. Null once nothing is left to decide. */
export function settle(pending: PendingCaseStudySuggestion | null, section: CaseStudySection): PendingCaseStudySuggestion | null {
    if (!pending) return null;
    const suggestions = { ...pending.suggestions };
    delete suggestions[section];
    return Object.keys(suggestions).length > 0 ? { ...pending, suggestions } : null;
}
