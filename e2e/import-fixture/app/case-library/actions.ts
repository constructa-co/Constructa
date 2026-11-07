"use server";

/**
 * Fixture harness for the case-study library. TEST ONLY.
 *
 * Like the harnesses beside it, these files are copied into the app only for
 * a fixture browser run and removed afterwards, and every entry point refuses
 * to work unless CONSTRUCTA_IMPORT_FIXTURE is "1".
 *
 * The real screens and the real library service run over an in-memory
 * library with the database's rules. There is no Supabase, no sign-in, no
 * network and no provider here, so this is NOT evidence of an authenticated
 * hosted run. Sign-in and the on/off switch live in the real pages and
 * server actions, which this harness does not use; they are covered by unit
 * tests. The "publish" here is a stand-in that builds the publication with
 * the application's own builder and applies the same checks the real action
 * applies.
 */

import { notFound } from "next/navigation";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { fakeLibrary } from "@/lib/case-library/__fixtures__/fake-library";
import { legacyCaseStudies } from "@/lib/case-library/legacy";
import type { ProposalLibrary } from "@/lib/case-library/past-jobs";
import { readProposalLibrary } from "@/lib/case-library/proposal-read";
import {
    approveStudy, archiveDiscipline, archiveStudy, createStudy, loadForApproval, saveDiscipline, saveStudy, startFromOlder, viewOf,
    type LibraryContext, type StudyView,
} from "@/lib/case-library/service";
import { readStudyAtOneRevision, type StoredDiscipline } from "@/lib/case-library/store";
import { buildProposalPublicationSnapshot, hashProposalContent } from "@/lib/proposal-publication";
import { REVIEW_CHANGED_ERROR, type ReviewContext } from "@/lib/proposal-review";

const ME = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OLDER = Array.from({ length: 7 }, (_, index) => ({ id: `o${index + 1}`, projectName: `Older job ${index + 1}`, projectType: "Refurbishment", client: "Mrs Older", location: "Leeds", whatWeDelivered: `Older job ${index + 1}: work delivered.`, valueAdded: "", photos: ["", "", ""] }));

interface Run { db: ReturnType<typeof fakeLibrary>; selected: string[]; libraryOff: boolean; delayMs: number; published: unknown[] }
const store = globalThis as unknown as { __constructaCaseLibraryFixture?: Record<string, Run> };

function guard() {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
}

function runFor(run: string): Run {
    store.__constructaCaseLibraryFixture ??= {};
    store.__constructaCaseLibraryFixture[run] ??= { db: fakeLibrary({ olderByUser: { [ME]: structuredClone(OLDER) } }), selected: [], libraryOff: false, delayMs: 0, published: [] };
    return store.__constructaCaseLibraryFixture[run];
}

async function contextFor(run: string): Promise<LibraryContext> {
    const state = runFor(run);
    // Lets the spec act while a request is on its way.
    if (state.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
    return { userId: ME, reader: state.db.reader, admin: () => state.db.admin };
}

type LibraryPageData = { available: boolean; studies: StudyView[]; disciplines: StoredDiscipline[]; older: Array<{ index: number; title: string }> };
type EditorPageData = { study: StudyView | null; disciplines: StoredDiscipline[] };
type ReviewPageData = { context: ReviewContext; older: Array<{ id: string; index: number; title: string; projectType: string }> };

export async function fixtureLibrary(run: string): Promise<LibraryPageData> {
    guard();
    const state = runFor(run);
    const library = await state.db.reader.library(ME);
    const older = legacyCaseStudies(state.db.older[ME]).map((entry) => ({ index: entry.index, title: entry.title }));
    if (library.state !== "ok") return { available: false, studies: [], disciplines: [], older };
    return { available: true, studies: library.value.studies.map((study) => viewOf(study, library.value.disciplines)), disciplines: library.value.disciplines, older };
}

export async function fixtureStudy(run: string, id: string | null): Promise<EditorPageData> {
    guard();
    const state = runFor(run);
    if (id) {
        // As the real page reads it: wording, tags and revision as they stood together.
        const read = await readStudyAtOneRevision(state.db.reader, ME, id);
        if (read.state === "ok") return { study: viewOf(read.study, read.disciplines), disciplines: read.disciplines };
    }
    const disciplines = await state.db.reader.disciplines(ME);
    return { study: null, disciplines: disciplines.state === "ok" ? disciplines.value : [] };
}

export async function fixtureCreate(run: string, input: { content: unknown; disciplineIds: unknown }) {
    guard();
    return createStudy(await contextFor(run), input);
}

export async function fixtureSave(run: string, input: { id: unknown; revision: unknown; content: unknown; disciplineIds: unknown }) {
    guard();
    return saveStudy(await contextFor(run), input);
}

export async function fixtureCheck(run: string, id: string) {
    guard();
    return loadForApproval(await contextFor(run), id);
}

export async function fixtureApprove(run: string, input: { id: unknown; revision: unknown; confirmed: unknown; shown: unknown }) {
    guard();
    return approveStudy(await contextFor(run), input);
}

export async function fixtureArchiveStudy(run: string, input: { id: unknown; revision: unknown; archived: unknown }) {
    guard();
    return archiveStudy(await contextFor(run), input);
}

export async function fixtureSaveDiscipline(run: string, input: { id: unknown; revision: unknown; label: unknown }) {
    guard();
    return saveDiscipline(await contextFor(run), input);
}

export async function fixtureArchiveDiscipline(run: string, input: { id: unknown; revision: unknown; archived: unknown }) {
    guard();
    return archiveDiscipline(await contextFor(run), input);
}

export async function fixtureStartFromOlder(run: string, input: { index: unknown }) {
    guard();
    return startFromOlder(await contextFor(run), input);
}

async function proposalParts(run: string): Promise<{ context: ReviewContext; library: ProposalLibrary | undefined }> {
    const state = runFor(run);
    const base = representativeInput();
    // Switched off, the library is not read at all, as on the real page.
    const library = state.libraryOff ? undefined : await readProposalLibrary(state.db.reader, ME, state.selected);
    return {
        context: {
            project: { ...base.project, selected_case_study_ids: [...state.selected] } as ReviewContext["project"],
            profile: { ...base.profile, case_studies: state.db.older[ME] as never },
            estimate: base.estimate,
            nextVersion: state.published.length + 1,
            ...(library ? { caseStudyLibrary: library } : {}),
        },
        library,
    };
}

export async function fixtureReview(run: string): Promise<ReviewPageData> {
    guard();
    const { context } = await proposalParts(run);
    const older = legacyCaseStudies(runFor(run).db.older[ME]).map((entry) => ({ id: entry.selectionId, index: entry.index, title: entry.title, projectType: entry.workType }));
    return { context, older };
}

export async function fixtureSaveDraft(run: string, payload: { caseStudyIds?: unknown }) {
    guard();
    runFor(run).selected = Array.isArray(payload?.caseStudyIds) ? payload.caseStudyIds.map((id) => String(id)) : [];
    return { success: true as const };
}

/** A stand-in for publishing: the application's own builder, a fresh library read, and the same "is this what was reviewed" check. */
export async function fixturePublish(run: string, input: { responseKind: "acknowledgement" | "non_binding_intent"; reviewedContent: string }) {
    guard();
    const state = runFor(run);
    const { context, library } = await proposalParts(run);
    const base = representativeInput();
    let snapshot;
    try {
        snapshot = buildProposalPublicationSnapshot({
            ...base,
            project: context.project as never,
            profile: context.profile,
            versionNumber: context.nextVersion,
            responseKind: input.responseKind,
            ...(library ? { caseStudyLibrary: { userId: ME, rows: library.rows } } : {}),
        });
    } catch (error) {
        return { success: false as const, error: error instanceof Error ? error.message : "The proposal could not be published." };
    }
    const contentHash = await hashProposalContent(snapshot);
    if (contentHash !== input.reviewedContent) return { success: false as const, error: REVIEW_CHANGED_ERROR, changed: true as const };
    state.published.push(snapshot);
    return { success: true as const, url: "https://app.example.test/proposal/fixture", versionNumber: context.nextVersion, publicationId: "33333333-3333-4333-8333-333333333333", delivery: { status: "not_requested" as const }, contentHash };
}

/** What the spec reads back, and the things it makes happen "somewhere else". */
export async function fixtureLibraryControl(run: string, op: {
    failBefore?: string; failAfter?: string; unavailable?: boolean; delayMs?: number; libraryOff?: boolean; select?: string[];
    editElsewhere?: { id: string; delivered: string }; archiveElsewhere?: string; renameElsewhere?: { from: string; to: string }; publish?: boolean; loseSaveAndLook?: boolean;
}) {
    guard();
    const state = runFor(run);
    const { db } = state;
    if (op.failBefore) db.failBefore(op.failBefore);
    if (op.failAfter) db.failAfter(op.failAfter);
    if (typeof op.unavailable === "boolean") db.setUnavailable(op.unavailable);
    if (op.loseSaveAndLook) {
        // The next save of the wording lands, its answer is lost, and the look straight afterwards fails too.
        db.failAfter("case_study_save_draft");
        db.beforeNext("case_study_save_draft", () => db.failRead("*"));
    }
    if (typeof op.delayMs === "number") state.delayMs = op.delayMs;
    if (typeof op.libraryOff === "boolean") state.libraryOff = op.libraryOff;
    if (op.select) state.selected = op.select;
    if (op.editElsewhere) {
        const row = db.studies.find((study) => study.id === op.editElsewhere!.id)!;
        await db.admin.rpc("case_study_save_draft", { p_user_id: ME, p_id: row.id, p_expected_revision: row.revision, p_content: { ...row.draft, delivered: op.editElsewhere.delivered } });
    }
    if (op.renameElsewhere) {
        const row = db.disciplines.find((entry) => entry.user_id === ME && entry.label === op.renameElsewhere!.from)!;
        await db.admin.rpc("case_library_discipline_save", { p_user_id: ME, p_id: row.id, p_expected_revision: row.revision, p_label: op.renameElsewhere.to, p_position: row.position });
    }
    if (op.archiveElsewhere) {
        const row = db.studies.find((study) => study.id === op.archiveElsewhere)!;
        await db.admin.rpc("case_study_archive", { p_user_id: ME, p_id: row.id, p_expected_revision: row.revision, p_archived: true });
    }
    let publish: unknown = null;
    if (op.publish) publish = await fixturePublish(run, { responseKind: "acknowledgement", reviewedContent: "0".repeat(64) });
    return {
        studies: db.studies.filter((study) => study.user_id === ME).map((study) => ({
            id: study.id, revision: study.revision, draft: study.draft, title: study.draft.title, delivered: study.draft.delivered, clientDisplay: study.draft.client_display, clientNamedOk: study.draft.client_named_ok,
            showValue: study.draft.show_value, approvedRevision: study.approved_revision, approved: study.approved as Record<string, unknown> | null, archived: study.archived, legacyIndex: study.legacy_index,
            tags: db.links.filter((link) => link.study === study.id).map((link) => db.disciplines.find((entry) => entry.id === link.discipline)!.label),
        })),
        disciplines: db.disciplines.filter((entry) => entry.user_id === ME).map((entry) => ({ label: entry.label, revision: entry.revision, archived: entry.archived })),
        older: (db.older[ME] as Array<{ projectName: string }>).map((entry) => entry.projectName),
        selected: state.selected,
        calls: db.rpcCalls.map((call) => call.name),
        publish,
    };
}
