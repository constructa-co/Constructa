/**
 * Case-study library: what each action does once the caller is known. Pure
 * of framework: the server actions authenticate, check the switch, and hand
 * this the contractor's id, their own-session reader and a way to make the
 * privileged client. Tests and fixtures hand it in-memory ones.
 *
 * Order in every function: validate what was sent; only then make the
 * privileged client; call ONE database function at a time with the
 * contractor's id from the session; turn the answer into fixed words.
 *
 * A call that fails without an answer is never reported as "nothing
 * changed". The function reads again with the contractor's own session and
 * says what it can actually see: saved, partly saved, or not known.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { approvalProblem, approvedProblem, approvedValue, contentFromInput, contentProblem, labelProblem, type ApprovedCaseStudy, type CaseStudyContent } from "./content";
import { cleanLabel } from "./labels";
import { draftFromLegacy } from "./legacy";
import { LIBRARY_MESSAGES as M, fieldMessage, fieldOf } from "./messages";
import { readStudyAtOneRevision, type LibraryReader, type StoredDiscipline, type StoredStudy } from "./store";

export interface LibraryContext {
    /** The contractor, from the authenticated session. Never from the request. */
    userId: string;
    /** Reads with the contractor's own session. */
    reader: LibraryReader;
    /** Makes the privileged client. Called only after validation, and only to run a write. */
    admin: () => Pick<SupabaseClient, "rpc">;
}

export type LibraryStatus =
    | "saved" | "unchanged" | "partial" | "conflict" | "unknown" | "invalid" | "not-found" | "limit" | "duplicate"
    | "unavailable" | "approved" | "not-approvable" | "unconfirmed" | "archived" | "already-adopted" | "legacy-missing"
    /** Set by the server actions, before this module is reached: the switch is off, or nobody is signed in. */
    | "off" | "signed-out";

/** A case study as the contractor's own screens see it. */
export interface StudyView {
    id: string;
    revision: number;
    content: CaseStudyContent;
    /** Active kinds of work it is tagged with. */
    disciplineIds: string[];
    approved: ApprovedCaseStudy | null;
    approvedRevision: number | null;
    archived: boolean;
    legacyIndex: number | null;
}

export interface LibraryResult {
    status: LibraryStatus;
    message: string;
    /** The box the message is about, when it is about one. */
    field?: string | null;
    id?: string;
    revision?: number;
    /** The case study as saved now, when it was read. */
    latest?: StudyView;
    disciplines?: StoredDiscipline[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTENT_KEYS = ["version", "title", "work_type", "place", "client_display", "client_text", "client_named_ok", "value_text", "show_value", "duration_text", "delivered", "value_added"] as const;

export function sameContent(a: unknown, b: CaseStudyContent): boolean {
    if (contentProblem(a) !== null) return false;
    const saved = a as CaseStudyContent;
    return CONTENT_KEYS.every((key) => saved[key] === b[key]);
}
export function sameTags(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((id) => b.includes(id));
}

export function viewOf(study: StoredStudy, disciplines: readonly StoredDiscipline[]): StudyView {
    const active = new Set(disciplines.filter((entry) => !entry.archived).map((entry) => entry.id));
    return {
        id: study.id,
        revision: study.revision,
        content: contentProblem(study.draft) === null ? (study.draft as CaseStudyContent) : contentFromInput(study.draft),
        disciplineIds: study.disciplineIds.filter((id) => active.has(id)),
        approved: study.approved === null || study.approved === undefined ? null : (study.approved as ApprovedCaseStudy),
        approvedRevision: study.approvedRevision,
        archived: study.archived,
        legacyIndex: study.legacyIndex,
    };
}

type Answer = { kind: "answer"; data: Record<string, unknown> } | { kind: "missing" } | { kind: "no-answer" };

/** Runs one database function. "missing" means it certainly did not run; "no-answer" means nobody knows. */
async function call(context: LibraryContext, name: string, args: Record<string, unknown>): Promise<Answer> {
    try {
        const { data, error } = await context.admin().rpc(name, { p_user_id: context.userId, ...args });
        if (error) {
            console.error("case library call failed", { name, code: (error as { code?: string }).code });
            return ["PGRST202", "42883", "PGRST205", "42P01"].includes(String((error as { code?: string }).code)) ? { kind: "missing" } : { kind: "no-answer" };
        }
        if (!data || typeof data !== "object" || typeof (data as { outcome?: unknown }).outcome !== "string") return { kind: "no-answer" };
        return { kind: "answer", data: data as Record<string, unknown> };
    } catch (error) {
        console.error("case library call threw", { name, message: error instanceof Error ? error.message : "unknown" });
        return { kind: "no-answer" };
    }
}

const unavailable = (): LibraryResult => ({ status: "unavailable", message: M.unavailable });

/**
 * The case study as saved now: its row, its tags and the kinds of work, all
 * at one revision. Never a mixture of two (see `readStudyAtOneRevision`).
 * "changing" means it could not be read at one revision; callers treat that
 * as not knowing, never as a state to compare against or act on.
 */
async function current(context: LibraryContext, id: string): Promise<{ state: "ok"; study: StoredStudy | null; disciplines: StoredDiscipline[] } | { state: "unavailable" } | { state: "changing" }> {
    const read = await readStudyAtOneRevision(context.reader, context.userId, id);
    if (read.state === "ok") return { state: "ok", study: read.study, disciplines: read.disciplines };
    if (read.state === "missing") return { state: "ok", study: null, disciplines: [] };
    return { state: read.state };
}

const changing = (): LibraryResult => ({ status: "conflict", message: M.changing });

function validTags(ids: unknown): ids is string[] {
    return Array.isArray(ids) && ids.length <= 6 && ids.every((id) => typeof id === "string" && UUID.test(id)) && new Set(ids).size === ids.length;
}

/** Saves the kinds of work, and says honestly what happened. `wordingSaved` shapes the words: this is the second of two calls. */
async function saveTags(context: LibraryContext, id: string, revision: number, wanted: string[], wordingSaved: boolean): Promise<LibraryResult> {
    const answer = await call(context, "case_study_set_disciplines", { p_id: id, p_expected_revision: revision, p_discipline_ids: wanted });
    const partial = (message: string, extra: Partial<LibraryResult> = {}): LibraryResult => ({ status: wordingSaved ? "partial" : "conflict", message, revision, ...extra });

    if (answer.kind === "answer") {
        const outcome = answer.data.outcome;
        if (outcome === "saved") return { status: "saved", message: M.saved, id, revision: Number(answer.data.revision) };
        const after = await current(context, id);
        const latest = after.state === "ok" && after.study ? { latest: viewOf(after.study, after.disciplines), revision: after.study.revision, disciplines: after.disciplines } : {};
        if (outcome === "not-found") return { status: "not-found", message: M.notFound };
        if (outcome === "unknown-discipline") return partial(wordingSaved ? M.partialTagsRemoved : M.conflict, latest);
        if (outcome === "invalid") return { status: wordingSaved ? "partial" : "invalid", message: wordingSaved ? M.partialTagsRefused : M.tooManyTags, ...latest };
        return partial(wordingSaved ? M.partialTagsRefused : M.conflict, latest);
    }
    if (answer.kind === "missing") return wordingSaved ? { status: "partial", message: M.partialTagsUnread, revision } : unavailable();

    // No answer. Look, with the contractor's own session, at what is actually saved.
    const after = await current(context, id);
    if (after.state !== "ok" || !after.study) return { status: wordingSaved ? "partial" : "unknown", message: wordingSaved ? M.partialTagsUnread : M.unknown, revision };
    const latest = viewOf(after.study, after.disciplines);
    if (sameTags(latest.disciplineIds, wanted)) return { status: "saved", message: M.saved, id, revision: latest.revision, latest, disciplines: after.disciplines };
    return { status: wordingSaved ? "partial" : "unknown", message: wordingSaved ? M.partialTagsUnknown : M.unknownNotSeen, revision: latest.revision, latest, disciplines: after.disciplines };
}

/** Adds a case study as a draft, then its kinds of work if any were chosen. */
export async function createStudy(context: LibraryContext, input: { content: unknown; disciplineIds: unknown }): Promise<LibraryResult> {
    const content = contentFromInput(input?.content);
    const problem = contentProblem(content);
    if (problem) return { status: "invalid", message: fieldMessage(problem), field: fieldOf(problem) };
    if (!validTags(input?.disciplineIds)) return { status: "invalid", message: M.tooManyTags, field: "disciplines" };

    const answer = await call(context, "case_study_create", { p_content: content, p_legacy_index: null });
    if (answer.kind === "missing") return unavailable();
    if (answer.kind === "no-answer") return { status: "unknown", message: M.unknownCreate };
    const { outcome } = answer.data;
    if (outcome === "limit") return { status: "limit", message: M.limitStudies };
    if (outcome === "invalid") return { status: "invalid", message: fieldMessage(String(answer.data.problem ?? "")), field: fieldOf(String(answer.data.problem ?? "")) };
    if (outcome !== "saved") return { status: "unknown", message: M.unknownCreate };

    const id = String(answer.data.id);
    if (input.disciplineIds.length === 0) return { status: "saved", message: M.saved, id, revision: 1 };
    const tags = await saveTags(context, id, 1, input.disciplineIds, true);
    return { ...tags, id };
}

/**
 * Saves wording and kinds of work. Reads first; calls only what differs;
 * chains the revision; and reports saved, already saved, partly saved,
 * conflict or not known, each only when that is what can be seen.
 */
export async function saveStudy(context: LibraryContext, input: { id: unknown; revision: unknown; content: unknown; disciplineIds: unknown }): Promise<LibraryResult> {
    if (typeof input?.id !== "string" || !UUID.test(input.id)) return { status: "not-found", message: M.notFound };
    if (!Number.isInteger(input.revision) || (input.revision as number) < 1) return { status: "conflict", message: M.conflict };
    const content = contentFromInput(input.content);
    const problem = contentProblem(content);
    if (problem) return { status: "invalid", message: fieldMessage(problem), field: fieldOf(problem) };
    if (!validTags(input.disciplineIds)) return { status: "invalid", message: M.tooManyTags, field: "disciplines" };
    const { id } = input;
    const wanted = input.disciplineIds;
    let revision = input.revision as number;

    const before = await current(context, id);
    // Not read at one revision: there is nothing sound to compare with, so nothing is called and nothing is claimed.
    if (before.state === "changing") return changing();
    if (before.state !== "ok") return unavailable();
    if (!before.study) return { status: "not-found", message: M.notFound };
    const saved = viewOf(before.study, before.disciplines);
    const wordingSame = sameContent(before.study.draft, content);
    const tagsSame = sameTags(saved.disciplineIds, wanted);

    if (saved.revision !== revision) {
        // The saved copy moved. Only if it already holds exactly this is that not a conflict.
        return wordingSame && tagsSame
            ? { status: "unchanged", message: M.unchanged, id, revision: saved.revision, latest: saved, disciplines: before.disciplines }
            : { status: "conflict", message: M.conflict, revision: saved.revision, latest: saved, disciplines: before.disciplines };
    }
    if (wordingSame && tagsSame) return { status: "unchanged", message: M.unchanged, id, revision, latest: saved, disciplines: before.disciplines };

    let wordingSaved = false;
    if (!wordingSame) {
        const answer = await call(context, "case_study_save_draft", { p_id: id, p_expected_revision: revision, p_content: content });
        if (answer.kind === "missing") return unavailable();
        if (answer.kind === "answer") {
            const { outcome } = answer.data;
            if (outcome === "not-found") return { status: "not-found", message: M.notFound };
            if (outcome === "invalid") return { status: "invalid", message: fieldMessage(String(answer.data.problem ?? "")), field: fieldOf(String(answer.data.problem ?? "")) };
            if (outcome !== "saved") {
                const after = await current(context, id);
                const latest = after.state === "ok" && after.study ? { latest: viewOf(after.study, after.disciplines), revision: after.study.revision, disciplines: after.disciplines } : {};
                return { status: "conflict", message: M.conflict, ...latest };
            }
            revision = Number(answer.data.revision);
        } else {
            // No answer: the write may or may not have landed. Look.
            const after = await current(context, id);
            if (after.state !== "ok" || !after.study) return { status: "unknown", message: M.unknown };
            const latest = viewOf(after.study, after.disciplines);
            if (!sameContent(after.study.draft, content)) return { status: "unknown", message: M.unknownNotSeen, revision: latest.revision, latest, disciplines: after.disciplines };
            revision = latest.revision;
            if (sameTags(latest.disciplineIds, wanted)) return { status: "saved", message: M.saved, id, revision, latest, disciplines: after.disciplines };
        }
        wordingSaved = true;
    }
    if (tagsSame) return { status: "saved", message: M.saved, id, revision };
    return saveTags(context, id, revision, wanted, wordingSaved);
}

export interface ApprovalCheck {
    study: StudyView;
    /** Active kinds of work, in the order an approval would capture them. */
    labels: string[];
    /** Exactly the approved copy that would be made from what is saved now. */
    wouldApprove: ApprovedCaseStudy;
    /** Why it cannot be approved yet, in words, or null. */
    problem: string | null;
    problemField: string | null;
}

/** What "check and approve" shows: the latest saved copy, read now, and the approved copy it would make. */
export async function loadForApproval(context: LibraryContext, id: unknown): Promise<{ status: "ok"; check: ApprovalCheck } | LibraryResult> {
    if (typeof id !== "string" || !UUID.test(id)) return { status: "not-found", message: M.notFound };
    const now = await current(context, id);
    // Shown only if the wording, the tags and their labels were all read at one revision. Otherwise nothing is shown.
    if (now.state === "changing") return changing();
    if (now.state !== "ok") return unavailable();
    if (!now.study) return { status: "not-found", message: M.notFound };
    const study = viewOf(now.study, now.disciplines);
    const labels = now.disciplines.filter((entry) => !entry.archived && study.disciplineIds.includes(entry.id)).map((entry) => entry.label);
    const problem = approvalProblem(study.content);
    return { status: "ok", check: { study, labels, wouldApprove: approvedValue(study.content, labels), problem: problem ? fieldMessage(problem) : null, problemField: fieldOf(problem) } };
}

/** Whether two approved copies are the same in everything a client would see, and in the order of the tags. */
export function sameApprovedCopy(a: ApprovedCaseStudy, b: ApprovedCaseStudy): boolean {
    return CONTENT_KEYS.every((key) => a[key] === b[key])
        && a.disciplines.length === b.disciplines.length
        && a.disciplines.every((label, index) => label === b.disciplines[index]);
}

/**
 * Approves exactly what the contractor was shown.
 *
 * Two bindings, both required:
 *
 *   1. `shown` is the approved copy the check screen displayed. Before any
 *      write, the saved copy is read again at one revision and the copy an
 *      approval would make from it is worked out. If that is not identical
 *      to what was shown, or the revision is not the one named, nothing is
 *      approved. So a check screen that somehow showed stale labels cannot
 *      be used to approve different ones.
 *   2. The database then approves only if the revision is still the one
 *      named, so a change after that read is refused too.
 */
export async function approveStudy(context: LibraryContext, input: { id: unknown; revision: unknown; confirmed: unknown; shown: unknown }): Promise<LibraryResult> {
    if (typeof input?.id !== "string" || !UUID.test(input.id)) return { status: "not-found", message: M.notFound };
    if (input.confirmed !== true) return { status: "unconfirmed", message: M.unconfirmed };
    if (!Number.isInteger(input.revision)) return { status: "conflict", message: M.approveConflict };
    // What was shown must come back, whole and well formed. Without it there is nothing to hold the approval to.
    const shownProblem = approvedProblem(input.shown);
    if (shownProblem !== null && ["client_text_missing", "client_not_confirmed", "value_text_missing"].includes(shownProblem)) {
        // What was shown could not be approved in the first place, and the screen said why.
        return { status: "not-approvable", message: fieldMessage(shownProblem), field: fieldOf(shownProblem) };
    }
    if (shownProblem !== null) return { status: "conflict", message: M.approveConflict };
    const { id } = input;
    const shown = input.shown as ApprovedCaseStudy;

    const before = await current(context, id);
    if (before.state === "changing") return changing();
    if (before.state !== "ok") return unavailable();
    if (!before.study) return { status: "not-found", message: M.notFound };
    const saved = viewOf(before.study, before.disciplines);
    const savedNow = { latest: saved, revision: saved.revision, disciplines: before.disciplines };
    if (saved.archived) return { status: "archived", message: M.archived, ...savedNow };
    if (saved.revision !== input.revision) return { status: "conflict", message: M.approveConflict, ...savedNow };
    const labels = before.disciplines.filter((entry) => !entry.archived && saved.disciplineIds.includes(entry.id)).map((entry) => entry.label);
    // Not what was on the screen: refused before anything is written.
    if (!sameApprovedCopy(approvedValue(saved.content, labels), shown)) return { status: "conflict", message: M.approveConflict, ...savedNow };

    const answer = await call(context, "case_study_approve", { p_id: id, p_expected_revision: input.revision, p_confirmed: true });
    if (answer.kind === "missing") return unavailable();

    const after = await current(context, id);
    const latest = after.state === "ok" && after.study ? { latest: viewOf(after.study, after.disciplines), revision: after.study.revision, disciplines: after.disciplines } : {};
    // What is now stored as approved, if it can be read. It should be what was shown; if it is not, that is said.
    const storedCopy = after.state === "ok" && after.study?.approvedRevision === input.revision ? (after.study.approved as ApprovedCaseStudy | null) : null;
    const done = (): LibraryResult => (storedCopy && !sameApprovedCopy(storedCopy, shown)
        ? { status: "approved", message: M.approvedDiffers, id, ...latest }
        : { status: "approved", message: M.approved, id, ...latest });

    if (answer.kind === "no-answer") {
        // Approved only if the saved copy now says this very revision is the approved one.
        const confirmed = after.state === "ok" && after.study?.approvedRevision === input.revision && after.study?.revision === input.revision;
        return confirmed ? done() : { status: "unknown", message: M.unknown, ...latest };
    }
    switch (answer.data.outcome) {
        case "approved": return done();
        case "unconfirmed": return { status: "unconfirmed", message: M.unconfirmed };
        case "not-found": return { status: "not-found", message: M.notFound };
        case "archived": return { status: "archived", message: M.archived, ...latest };
        case "not-approvable": return { status: "not-approvable", message: fieldMessage(String(answer.data.problem ?? "")), field: fieldOf(String(answer.data.problem ?? "")), ...latest };
        default: return { status: "conflict", message: M.approveConflict, ...latest };
    }
}

/** Archives a case study, or brings it back. */
export async function archiveStudy(context: LibraryContext, input: { id: unknown; revision: unknown; archived: unknown }): Promise<LibraryResult> {
    if (typeof input?.id !== "string" || !UUID.test(input.id)) return { status: "not-found", message: M.notFound };
    if (typeof input.archived !== "boolean" || !Number.isInteger(input.revision)) return { status: "conflict", message: M.conflict };
    const answer = await call(context, "case_study_archive", { p_id: input.id, p_expected_revision: input.revision, p_archived: input.archived });
    if (answer.kind === "missing") return unavailable();
    if (answer.kind === "no-answer") return { status: "unknown", message: M.unknown };
    switch (answer.data.outcome) {
        case "saved": return { status: "saved", message: input.archived ? M.archivedOk : M.restoredOk, id: input.id, revision: Number(answer.data.revision) };
        case "not-found": return { status: "not-found", message: M.notFound };
        case "limit": return { status: "limit", message: M.limitStudies };
        case "already-adopted": return { status: "already-adopted", message: M.alreadyAdopted };
        default: return { status: "conflict", message: M.conflict, revision: Number(answer.data.revision) || undefined };
    }
}

function disciplineOutcome(answer: Answer, saved: string): LibraryResult {
    if (answer.kind === "missing") return unavailable();
    if (answer.kind === "no-answer") return { status: "unknown", message: M.unknown };
    switch (answer.data.outcome) {
        case "saved": return { status: "saved", message: saved, id: String(answer.data.id), revision: Number(answer.data.revision) };
        case "not-found": return { status: "not-found", message: M.disciplineNotFound };
        case "duplicate": return { status: "duplicate", message: M.duplicateDiscipline };
        case "limit": return { status: "limit", message: M.limitDisciplines };
        case "invalid": return { status: "invalid", message: M.invalidDiscipline, field: "label" };
        default: return { status: "conflict", message: M.conflict, revision: Number(answer.data.revision) || undefined };
    }
}

/** Adds a kind of work (no id, revision 0) or renames one (its id and the revision shown). A new one goes to the end of the list. */
export async function saveDiscipline(context: LibraryContext, input: { id: unknown; revision: unknown; label: unknown }): Promise<LibraryResult> {
    const label = cleanLabel(input?.label);
    if (label === null || labelProblem(label) !== null) return { status: "invalid", message: M.invalidDiscipline, field: "label" };
    const adding = input.id === null || input.id === undefined;
    if (!adding && (typeof input.id !== "string" || !UUID.test(input.id))) return { status: "not-found", message: M.disciplineNotFound };
    if (!adding && !Number.isInteger(input.revision)) return { status: "conflict", message: M.conflict };

    const existing = await context.reader.disciplines(context.userId);
    if (existing.state !== "ok") return unavailable();
    let position: number;
    if (adding) {
        position = Math.min(1000, existing.value.reduce((highest, entry) => Math.max(highest, entry.position + 1), 0));
    } else {
        const row = existing.value.find((entry) => entry.id === input.id);
        if (!row) return { status: "not-found", message: M.disciplineNotFound };
        position = row.position;
    }
    const answer = await call(context, "case_library_discipline_save", { p_id: adding ? null : input.id, p_expected_revision: adding ? 0 : input.revision, p_label: label, p_position: position });
    const result = disciplineOutcome(answer, M.saved);
    const after = await context.reader.disciplines(context.userId);
    return after.state === "ok" ? { ...result, disciplines: after.value } : result;
}

export async function archiveDiscipline(context: LibraryContext, input: { id: unknown; revision: unknown; archived: unknown }): Promise<LibraryResult> {
    if (typeof input?.id !== "string" || !UUID.test(input.id)) return { status: "not-found", message: M.disciplineNotFound };
    if (typeof input.archived !== "boolean" || !Number.isInteger(input.revision)) return { status: "conflict", message: M.conflict };
    const answer = await call(context, "case_library_discipline_archive", { p_id: input.id, p_expected_revision: input.revision, p_archived: input.archived });
    const result = disciplineOutcome(answer, input.archived ? M.archivedOk : M.restoredOk);
    const after = await context.reader.disciplines(context.userId);
    return after.state === "ok" ? { ...result, disciplines: after.value } : result;
}

/**
 * Starts a new version from an older case study. The server reads the older
 * entry itself to build the draft: client hidden, no price shown, no
 * pictures. The database function then reads the entry AGAIN and records
 * its place and a fingerprint of what IT read. The two reads can differ.
 * Nothing here says the draft matches the older entry.
 */
export async function startFromOlder(context: LibraryContext, input: { index: unknown }): Promise<LibraryResult> {
    if (!Number.isInteger(input?.index) || (input.index as number) < 0 || (input.index as number) > 9999) return { status: "legacy-missing", message: M.olderMissing };
    const index = input.index as number;
    const entry = await context.reader.olderEntry(context.userId, index);
    if (entry.state !== "ok") return unavailable();
    if (!entry.value || typeof entry.value !== "object" || Array.isArray(entry.value)) return { status: "legacy-missing", message: M.olderMissing };
    const draft = draftFromLegacy(entry.value);
    if (contentProblem(draft) !== null) return { status: "invalid", message: M.olderNoTitle };

    const answer = await call(context, "case_study_create", { p_content: draft, p_legacy_index: index });
    if (answer.kind === "missing") return unavailable();
    if (answer.kind === "no-answer") return { status: "unknown", message: M.unknownCreate };
    switch (answer.data.outcome) {
        case "saved": return { status: "saved", message: M.saved, id: String(answer.data.id), revision: 1 };
        case "already-adopted": return { status: "already-adopted", message: M.alreadyAdopted };
        case "legacy-missing": return { status: "legacy-missing", message: M.olderMissing };
        case "limit": return { status: "limit", message: M.limitStudies };
        default: return { status: "invalid", message: M.olderNoTitle };
    }
}
