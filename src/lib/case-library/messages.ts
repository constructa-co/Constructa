/**
 * Case-study library: the words a contractor is shown. Fixed text only. No
 * message carries a database error, a revision of someone else's row, or
 * anything about another contractor. Pure.
 */

import type { UnsendableReason } from "./resolve";

export const LIBRARY_MESSAGES = {
    off: "Case studies are managed on the Case Studies page.",
    signedOut: "Sign in again to carry on. Nothing was changed.",
    unavailable: "The new case-study library isn't available right now. Your older case studies still work.",
    notFound: "That case study isn't available.",
    disciplineNotFound: "That kind of work isn't available.",
    saved: "Saved.",
    unchanged: "Already saved. There was nothing new to save.",
    conflict: "This was changed somewhere else. Your wording is still here. Look at the latest below, then decide.",
    changing: "This case study is being changed somewhere else right now, so it couldn't be read reliably. Nothing was saved or approved. Your wording is still here. Try again in a moment.",
    changingOnOpen: "This case study is being changed somewhere else right now, so it couldn't be opened reliably. Go back and open it again in a moment.",
    unknown: "We couldn't confirm whether this was saved. Your wording is still here. Check the latest below before trying again.",
    unknownNotSeen: "We couldn't confirm the save, and the saved copy doesn't show your changes yet. Your wording is still here. Try again.",
    unknownCreate: "We couldn't confirm whether this was added. Check your case studies before adding it again.",
    partialTagsRefused: "Your wording was saved. The kinds of work were not, because they changed somewhere else. Choose them again.",
    partialTagsRemoved: "Your wording was saved. The kinds of work were not, because one of them has been removed. Choose them again.",
    partialTagsUnknown: "Your wording was saved. We couldn't confirm the kinds of work, and they currently show as not saved. Try again.",
    partialTagsUnread: "Your wording was saved. We couldn't confirm whether the kinds of work were saved. Check below before trying again.",
    limitStudies: "You have 50 case studies, which is the most you can have. Archive one to add another.",
    limitDisciplines: "You have 12 kinds of work, which is the most you can have. Archive one to add another.",
    duplicateDiscipline: "You already have that kind of work.",
    invalidDiscipline: "Give the kind of work a short name, up to 80 characters, on one line.",
    tooManyTags: "Choose up to 6 kinds of work for one case study.",
    unconfirmed: "Tick the box to say this is accurate and that you're happy for clients to see it.",
    archived: "This case study is archived. Bring it back before approving it.",
    approved: "Approved. Proposals can now use this version.",
    approvedDiffers: "This was approved, but the approved version is not the same as the one you were shown. Open it and check it now. If it is wrong, change it and approve again.",
    approveConflict: "This changed after you opened this check. Nothing was approved. Look at the latest below and check it again.",
    alreadyAdopted: "You've already started a new version of that older case study.",
    olderMissing: "That older case study isn't there any more. Nothing was started.",
    olderNoTitle: "That older case study has no job name, so a new version can't be started from it. Add a name to it first.",
    archivedOk: "Archived.",
    restoredOk: "Brought back.",
} as const;

/** What to say about each content rule. Keys are the codes the content rules return. */
const FIELD_MESSAGES: Record<string, string> = {
    title: "Say what the job was, in up to 200 characters, on one line.",
    work_type: "Keep the type of work to 200 characters, on one line.",
    place: "Keep the place to 200 characters, on one line.",
    client_text: "Keep how you refer to the client to 200 characters, on one line.",
    value_text: "Keep the price to 50 characters.",
    duration_text: "Keep how long it took to 100 characters.",
    delivered: "Keep what you did to 5,000 characters.",
    value_added: "Keep what it meant for the client to 5,000 characters.",
    client_text_missing: "Say how to refer to the client, or choose not to mention them.",
    client_not_confirmed: "To name the client, confirm that they've agreed to be named. Or choose not to name them.",
    value_text_missing: "Enter the price to show, or choose not to show one.",
};

export function fieldMessage(problem: string | null | undefined): string {
    return (problem && FIELD_MESSAGES[problem]) || "Something in this case study can't be saved as it is. Check each box and try again.";
}

/** Which box a content rule is about, so the screen can point at it. */
export function fieldOf(problem: string | null | undefined): string | null {
    if (!problem) return null;
    if (problem === "client_text_missing" || problem === "client_not_confirmed") return "client_text";
    if (problem === "value_text_missing") return "value_text";
    return problem in FIELD_MESSAGES ? problem : null;
}

/** Why a ticked case study cannot be sent, in words. */
export function unsendableMessage(reason: UnsendableReason, libraryAvailable: boolean): string {
    if (!libraryAvailable && reason === "library-missing") return "This case study is in the new library, which isn't available right now. It can't be sent. Untick it to carry on without it.";
    switch (reason) {
        case "library-archived": return "This case study has been archived, so it can't be sent. Untick it, or bring it back in Case Studies.";
        case "library-not-approved": return "This case study isn't approved, so it can't be sent. Untick it, or approve it in Case Studies.";
        case "ambiguous-with-older-entry": return "This choice could mean two different case studies. Untick it and choose again.";
        case "too-many": return "Too many past jobs are chosen.";
        case "library-approved-invalid": return "This case study's approved version can't be read, so it can't be sent. Untick it, or approve it again in Case Studies.";
        default: return "This case study is no longer available, so it can't be sent. Untick it to carry on without it.";
    }
}
