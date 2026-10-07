/**
 * Parity regression: one saved programme and one reviewed draft drive every
 * place a proposal appears.
 *
 * The journey below uses the real server actions against an in-memory
 * database: the programme is saved, the review screen's preview and pre-send
 * PDF are built from what was saved, the draft is saved and published, and
 * the client's page and PDF are built from the immutable snapshot. Each
 * surface is then required to state the same three stages, in the same
 * order, with the same dates, and the same price and payment stages.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { representativeInput } from "@/lib/__fixtures__/proposal";

const mocks = vi.hoisted(() => ({
    requireEditableProjectAccess: vi.fn(),
    requireProjectAccess: vi.fn(),
    requireAuth: vi.fn(),
    createAdminClient: vi.fn(),
    sendProposalEmail: vi.fn(),
}));
vi.mock("@/lib/supabase/project-resource-access", () => ({ requireEditableProjectAccess: mocks.requireEditableProjectAccess }));
vi.mock("@/lib/supabase/auth-utils", () => ({ requireProjectAccess: mocks.requireProjectAccess, requireAuth: mocks.requireAuth }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/email", () => ({ sendProposalEmail: mocks.sendProposalEmail }));
vi.mock("@/lib/ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/storage/public-image", () => ({ validatePublicImage: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { renderProposalBrochure } from "@/lib/pdf/proposal-brochure";
import { formatDateRange, programmePlanForProject, type ProgrammePlan } from "@/lib/programme-plan";
import { buildProposalDocument, type ProposalDocument } from "@/lib/proposal-document";
import { contentCheckCode, hashProposalContent, hashProposalPublication, type ProposalPublicationSnapshot } from "@/lib/proposal-publication";
import {
    buildPreviewSnapshot,
    buildProposalPayload,
    draftFromProject,
    presetPayments,
    reviewReadiness,
    type ProposalDraft,
    type ReviewContext,
} from "@/lib/proposal-review";
import { buildSimpleProgramme, viewForProject, type SimpleProgrammeInput } from "@/lib/simple-programme";
import { updatePhasesAction } from "../schedule/actions";
import { saveSimpleProgrammeAction } from "../schedule/simple-actions";
import { publishProposalAction, saveProposalDraftAction } from "./actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const ESTIMATE_ID = "33333333-3333-4333-8333-333333333333";
/** The moment the contractor reads the preview and sends: one working morning. */
const NOW = "2026-10-05T09:00:00.000Z";

const input = representativeInput();

/** Monday 2 November 2026, then three stages one after another. */
const PROGRAMME: SimpleProgrammeInput = {
    startDate: "2026-11-02",
    stages: [
        { name: "Strip out", workingDays: 3, unit: "days", source: null },
        { name: "First fix and tiling", workingDays: 10, unit: "weeks", source: null },
        { name: "Second fix and finish", workingDays: 4, unit: "days", source: null },
    ],
};

/** Worked out by hand from the calendar, Monday to Friday. Not read from the application. */
const EXPECTED_PLAN: ProgrammePlan = {
    basis: "mon_fri_working_days",
    start_date: "2026-11-02",
    end_date: "2026-11-24",
    working_days: 17,
    calendar_days: 23,
    duration_label: "17 working days",
    stages: [
        { name: "Strip out", start_date: "2026-11-02", end_date: "2026-11-04", working_days: 3, offset_days: 0, span_days: 3 },
        { name: "First fix and tiling", start_date: "2026-11-05", end_date: "2026-11-18", working_days: 10, offset_days: 3, span_days: 14 },
        { name: "Second fix and finish", start_date: "2026-11-19", end_date: "2026-11-24", working_days: 4, offset_days: 17, span_days: 6 },
    ],
};
const STAGE_LINES = [
    ["Strip out", "2 Nov to 4 Nov 2026", "3 working days"],
    ["First fix and tiling", "5 Nov to 18 Nov 2026", "2 weeks"],
    ["Second fix and finish", "19 Nov to 24 Nov 2026", "4 working days"],
];
const INTERNAL_BUILD_UP = /overhead|profit|margin|mark-?up|risk \(|risk allowance|prelims/i;

function world(projectPatch: Record<string, unknown> = {}) {
    const db = fakeSupabase({
        projects: [{
            ...input.project,
            id: PROJECT_ID,
            user_id: USER_ID,
            status: "Estimating",
            validity_days: 30,
            tc_overrides: null,
            client_email: "alex@example.test",
            is_vat_reverse_charge: false,
            current_proposal_publication_id: null,
            // A job that has been priced but has no programme and no payment stages yet.
            start_date: null,
            programme_phases: [],
            gantt_phases: null,
            payment_schedule: [],
            ...projectPatch,
        }],
        estimates: [{ ...input.estimate, id: ESTIMATE_ID, project_id: PROJECT_ID, is_active: true }],
        profiles: [{ ...input.profile, id: USER_ID }],
        proposal_publications: [],
        proposal_delivery_attempts: [],
    });
    db.onRpc((name, args) => name === "publish_proposal_publication"
        ? { data: [{ publication_id: args.p_publication_id, delivery_id: null }], error: null }
        : { data: null, error: null });
    const access = { user: { id: USER_ID }, supabase: db.client };
    mocks.requireEditableProjectAccess.mockResolvedValue(access);
    mocks.requireProjectAccess.mockResolvedValue(access);
    mocks.requireAuth.mockResolvedValue(access);
    mocks.createAdminClient.mockReturnValue(fakeSupabase({}).client);
    return db;
}

/** The project, estimate and profile exactly as the review page loads them. */
function reviewContext(db: ReturnType<typeof world>): ReviewContext {
    return {
        project: { ...db.tables.projects[0] } as unknown as ReviewContext["project"],
        profile: db.tables.profiles[0],
        estimate: db.tables.estimates[0] as unknown as ReviewContext["estimate"],
        nextVersion: 1,
    };
}

function keys() {
    let n = 0;
    return () => `stage-${n++}`;
}

const html = (doc: ProposalDocument) =>
    renderToStaticMarkup(createElement(ProposalDocumentView, { doc })).replace(/&amp;/g, "&").replace(/&#x27;/g, "'");

/** What a reader sees on the page: the words, without the markup and styling around them. */
const visible = (page: string) => page.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

/** The words in a PDF, read back out of the file as a PDF reader would. */
async function pdfWords(doc: ProposalDocument): Promise<string> {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(renderProposalBrochure(doc).doc.output("arraybuffer")));
    const { text } = await extractText(pdf, { mergePages: true });
    return text.replace(/\s+/g, " ").trim();
}

/** The programme part of a rendered page, from its heading to the next section. */
function programmeOf(page: string): string {
    const start = page.indexOf('id="doc-programme"');
    expect(start, "the document has a Programme section").toBeGreaterThan(-1);
    const next = page.indexOf("<section", start + 1);
    return page.slice(start, next === -1 ? undefined : next);
}

function expectInOrder(text: string, parts: string[], where: string) {
    let from = 0;
    for (const part of parts) {
        const at = text.indexOf(part, from);
        expect(at, `${where}: "${part}" appears, after what comes before it`).toBeGreaterThan(-1);
        from = at + part.length;
    }
}

describe("a three-stage programme and a payment preset, from the editor to the client", () => {
    let db: ReturnType<typeof world>;
    let context: ReviewContext;
    let draft: ProposalDraft;
    let preview: ProposalPublicationSnapshot;
    let previewDoc: ProposalDocument;
    let reviewed: string;
    let sent: ProposalPublicationSnapshot;
    let sentDoc: ProposalDocument;
    let draftPdf: string;
    let sentPdf: string;
    let publishResult: Awaited<ReturnType<typeof publishProposalAction>>;

    beforeAll(async () => {
        vi.useFakeTimers({ now: new Date(NOW), toFake: ["Date"] });
        db = world();

        // 1. The contractor saves three stages on the Programme screen.
        await expect(saveSimpleProgrammeAction(PROJECT_ID, PROGRAMME)).resolves.toEqual({ success: true });

        // 2. The review screen loads the project and the contractor picks a payment preset.
        context = reviewContext(db);
        draft = draftFromProject(context.project, keys());
        draft = { ...draft, payments: presetPayments("deposit_balance", keys(), draft.payments) };
        preview = buildPreviewSnapshot(context, draft, "acknowledgement", NOW)!;
        reviewed = await hashProposalContent(preview);
        previewDoc = buildProposalDocument(preview, { isDraft: true, draftCheckCode: contentCheckCode(reviewed) });
        draftPdf = await pdfWords(previewDoc);

        // 3. They tick the box and send: the draft is saved, then published.
        const built = buildProposalPayload(draft);
        if (!built.ok) throw new Error("the draft should be saveable");
        await expect(saveProposalDraftAction(PROJECT_ID, built.payload)).resolves.toEqual({ success: true });
        publishResult = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false, reviewedContent: reviewed });

        // 4. The client opens the link: everything comes from the immutable snapshot.
        const call = db.rpcCalls.find((entry) => entry.name === "publish_proposal_publication");
        sent = call?.args.p_snapshot as ProposalPublicationSnapshot;
        sentDoc = buildProposalDocument(sent, { snapshotHash: await hashProposalPublication(sent) });
        sentPdf = await pdfWords(sentDoc);
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    it("saves the programme, and the Programme screen reopens on the same three stages", () => {
        const project = db.tables.projects[0];
        expect(project.start_date).toBe("2026-11-02");
        expect((project.programme_phases as Array<{ name: string }>).map((phase) => phase.name)).toEqual(PROGRAMME.stages.map((stage) => stage.name));

        const view = viewForProject(project, keys());
        expect(view.kind).toBe("simple");
        if (view.kind !== "simple") return;
        expect(view.hasSaved).toBe(true);
        expect(view.draft.startDate).toBe("2026-11-02");
        expect(view.draft.stages.map((stage) => [stage.name, stage.duration, stage.unit])).toEqual([
            ["Strip out", "3", "days"],
            ["First fix and tiling", "2", "weeks"],
            ["Second fix and finish", "4", "days"],
        ]);
        // Saving what was reloaded changes nothing: no stage is lost, merged or renamed.
        const again = buildSimpleProgramme(view.draft);
        expect(again.ok && again.input.stages.map((stage) => [stage.name, stage.workingDays])).toEqual(PROGRAMME.stages.map((stage) => [stage.name, stage.workingDays]));
    });

    it("is published", () => {
        expect(publishResult).toMatchObject({ success: true, versionNumber: 1 });
        expect(sent).toBeDefined();
    });

    it("gives one programme to the review screen, the preview and the sent version", () => {
        expect(programmePlanForProject(context.project)).toEqual(EXPECTED_PLAN);
        expect(preview.programme_plan).toEqual(EXPECTED_PLAN);
        expect(sent.programme_plan).toEqual(EXPECTED_PLAN);
        // The older stage list kept beside the plan states the same stages.
        for (const snapshot of [preview, sent]) {
            expect(snapshot.programme.map((stage) => [stage.name, stage.start_date, stage.duration_days])).toEqual(
                EXPECTED_PLAN.stages.map((stage) => [stage.name, stage.start_date, stage.working_days]),
            );
        }
    });

    it("shows the same stages, in order, with the same dates in the preview and on the client's page", () => {
        for (const [where, doc] of [["preview", previewDoc], ["client's page", sentDoc]] as const) {
            const timeline = doc.sections.find((section) => section.id === "programme")?.blocks[0];
            expect(timeline, where).toEqual({ type: "timeline", plan: EXPECTED_PLAN });
            expect(doc.keyFacts.slice(1)).toEqual([
                { label: "Start on site", value: "2 Nov 2026" },
                { label: "Finish", value: "24 Nov 2026" },
                { label: "Duration", value: "17 working days" },
            ]);

            const programme = programmeOf(html(doc));
            expectInOrder(programme, STAGE_LINES.flat(), where);
            expect(programme).toContain("Monday 2 November 2026");
            expect(programme).toContain("Tuesday 24 November 2026");
            expect(programme.match(/<li /g), `${where}: one row per saved stage`).toHaveLength(3);
            expect(programme, `${where}: no invented stage`).not.toContain("General");
            expect(programme).not.toContain("Works on site");
        }
        expect(programmeOf(html(previewDoc))).toBe(programmeOf(html(sentDoc)));
    });

    it("prints the same stages and dates in the pre-send PDF and in the client's PDF", () => {
        for (const [where, words] of [["pre-send PDF", draftPdf], ["client's PDF", sentPdf]] as const) {
            expectInOrder(words, STAGE_LINES.map(([name]) => name), where);
            for (const stage of EXPECTED_PLAN.stages) expect(words, where).toContain(formatDateRange(stage.start_date, stage.end_date));
            expect(words).toContain("Monday 2 November 2026");
            expect(words).toContain("Tuesday 24 November 2026");
            expect(words).toContain("17 working days");
        }
    });

    it("the pre-send PDF is the PDF the client gets, apart from being marked as a draft", () => {
        expect(draftPdf).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");
        expect(draftPdf).toContain(`Check code ${contentCheckCode(reviewed)}.`);
        expect(sentPdf).not.toContain("DRAFT");

        // Take away only what marks one as a draft and the other as sent.
        const reference = sentDoc.reference;
        const body = (words: string) => words
            .replaceAll("DRAFT PREVIEW - NOT SENT TO THE CLIENT", "")
            .replace(/(Previewed|Issued):/g, "Dated:")
            .replace(/Check code [0-9A-F]{4}-[0-9A-F]{4}\./g, "")
            .replace(/Snapshot [0-9a-f]{12}\./g, "")
            .replaceAll(reference, "REF")
            .replace(/\bDraft\b/g, "REF")
            .replace(/\s+/g, " ")
            .trim();
        expect(body(draftPdf)).toBe(body(sentPdf));
    });

    it("the document the contractor read is the document that was sent, section for section", () => {
        const comparable = (doc: ProposalDocument) => ({ ...doc, isDraft: false, reference: "", snapshotRef: null, draftCheckCode: null });
        expect(comparable(previewDoc)).toEqual(comparable(sentDoc));
        expect(previewDoc.isDraft).toBe(true);
        expect(sentDoc.isDraft).toBe(false);
    });

    it("the server published the content that was reviewed, and says so with the same fingerprint", async () => {
        expect(publishResult).toMatchObject({ success: true, contentHash: reviewed });
        expect(await hashProposalContent(sent)).toBe(reviewed);
        // The draft differs from the sent version only in the three things a draft cannot know.
        expect({ ...preview, publication: { ...preview.publication, id: "", sent_at: "", expires_at: "" } })
            .toEqual({ ...sent, publication: { ...sent.publication, id: "", sent_at: "", expires_at: "" } });
        expect(preview.publication.id).not.toBe(sent.publication.id);
    });

    it("states the same price and payment stages everywhere, worked out from the preset", () => {
        for (const snapshot of [preview, sent]) {
            expect(snapshot.commercial).toMatchObject({ contract_sum_ex_vat: 7552.05, vat_rate: 20, vat_amount: 1510.41, contract_sum_inc_vat: 9062.46 });
            expect(snapshot.commercial.payment_schedule.map((row) => [row.stage, row.description, row.percentage, row.amount])).toEqual([
                ["Deposit", "On booking", 30, null],
                ["Balance", "On completion", 70, null],
            ]);
        }
        for (const [where, text] of [["preview", html(previewDoc)], ["client's page", html(sentDoc)], ["pre-send PDF", draftPdf], ["client's PDF", sentPdf]] as const) {
            for (const figure of ["£7,552.05", "£1,510.41", "£9,062.46"]) expect(text, where).toContain(figure);
            // Deposit and balance add up to the price before VAT, to the penny.
            expectInOrder(text, ["Deposit", "£2,265.61", "Balance", "£5,286.44"], where);
        }
    });

    it("asks only for a non-binding response and shows nothing of how the price was built up", () => {
        expect(sent.publication.response_mode).toBe("acknowledgement");
        expect(sent.response?.kind).toBe("acknowledgement");
        // The page shows the response area from the document's own wording; the PDF prints it.
        const notice = "It is not acceptance of the proposal and does not create a contract.";
        for (const doc of [previewDoc, sentDoc]) {
            expect(doc.response).toMatchObject({ kind: "acknowledgement", heading: "Confirm you have received this proposal", actionLabel: "Confirm receipt" });
            expect(doc.response.notice).toContain(notice);
        }
        for (const words of [draftPdf, sentPdf]) expect(words).toContain(notice);
        for (const [where, text] of [["preview", visible(html(previewDoc))], ["client's page", visible(html(sentDoc))], ["pre-send PDF", draftPdf], ["client's PDF", sentPdf]] as const) {
            expect(text, where).not.toMatch(INTERNAL_BUILD_UP);
            expect(text, where).not.toMatch(/accept this proposal|sign and accept/i);
        }
        expect(JSON.stringify(sent)).not.toMatch(/overhead_pct|profit_pct|risk_pct|prelims_pct|unit_rate|total_cost/);
    });
});

describe("the detailed planner's stages reach the proposal the same way", () => {
    it("keeps the names, order and dates of stages saved on the planner's weekly grid", async () => {
        const db = world();
        // As the planner saves them: working days, placed by calendar-day offsets, with a gap.
        const phases = [
            { name: "Demolition", calculatedDays: 5, manualDays: 3, manhours: 24, startOffset: 0 },
            { name: "Structure", calculatedDays: 10, manualDays: null, manhours: 80, startOffset: 7 },
            { name: "Finishes", calculatedDays: 5, manualDays: 5, manhours: 40, startOffset: 28 },
        ];
        await expect(updatePhasesAction(PROJECT_ID, phases, "2026-11-02")).resolves.toEqual({ success: true });

        const context = reviewContext(db);
        const draft = { ...draftFromProject(context.project, keys()), payments: presetPayments("completion", keys()) };
        const preview = buildPreviewSnapshot(context, draft, "acknowledgement", NOW)!;
        const stages = [
            ["Demolition", "2026-11-02", "2026-11-04"],
            ["Structure", "2026-11-09", "2026-11-20"],
            ["Finishes", "2026-11-30", "2026-12-04"],
        ];
        expect(programmePlanForProject(context.project)?.stages.map((stage) => [stage.name, stage.start_date, stage.end_date])).toEqual(stages);
        expect(preview.programme_plan?.stages.map((stage) => [stage.name, stage.start_date, stage.end_date])).toEqual(stages);

        const built = buildProposalPayload(draft);
        if (!built.ok) throw new Error("the draft should be saveable");
        await saveProposalDraftAction(PROJECT_ID, built.payload);
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false, reviewedContent: await hashProposalContent(preview) });
        expect(result).toMatchObject({ success: true });
        const sent = db.rpcCalls[0].args.p_snapshot as ProposalPublicationSnapshot;
        expect(sent.programme_plan).toEqual(preview.programme_plan);
        expect(programmeOf(html(buildProposalDocument(sent)))).not.toContain("General");
    });
});

describe("a job with no usable programme", () => {
    it("is a blocker with a fix, and shows no invented stage anywhere", async () => {
        const db = world({ payment_schedule: [{ id: "p", stage: "Payment on completion", description: "", percentage: 100 }] });
        const context = reviewContext(db);
        const draft = draftFromProject(context.project, keys());

        const readiness = reviewReadiness(context, draft);
        expect(readiness.ready).toBe(false);
        expect(readiness.missing).toEqual([{ key: "programme", label: "Programme", ok: false, fix: "Add the start date and how long the job takes in Programme." }]);

        const preview = buildPreviewSnapshot(context, draft, "acknowledgement", NOW)!;
        expect(preview.programme_plan).toBeUndefined();
        expect(preview.programme).toEqual([]);
        const page = html(buildProposalDocument(preview, { isDraft: true }));
        expect(page).not.toContain('id="doc-programme"');
        expect(page).not.toContain("General");
        expect(page).not.toMatch(/1 week|5 working days/);

        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false, reviewedContent: await hashProposalContent(preview) });
        expect(result).toMatchObject({ success: false });
        if (!result.success) expect(result.error).toContain("Add the start date and how long the job takes in Programme.");
        expect(db.rpcCalls).toEqual([]);
    });

    it("a stage that was suggested but never given a start is not a programme", () => {
        // What the planner used to save just by being opened: one estimate section, a placeholder week, no start date.
        const db = world({ programme_phases: [{ name: "General", calculatedDays: 5, manualDays: null, manhours: 0, startOffset: 0 }] });
        const context = reviewContext(db);
        const draft = draftFromProject(context.project, keys());
        expect(reviewReadiness(context, draft).missing.map((item) => item.key)).toContain("programme");
        const preview = buildPreviewSnapshot(context, draft, "acknowledgement", NOW)!;
        expect(preview.programme).toEqual([]);
        expect(html(buildProposalDocument(preview, { isDraft: true }))).not.toContain('id="doc-programme"');
    });

    it("a saved stage with no length blocks sending rather than being left out", async () => {
        const db = world({
            start_date: "2026-11-02",
            payment_schedule: [{ id: "p", stage: "Payment on completion", description: "", percentage: 100 }],
            programme_phases: [
                { name: "Strip out", calculatedDays: 3, manualDays: 3, manhours: 0, startOffset: 0 },
                { name: "First fix", calculatedDays: 0, manualDays: null, manhours: 0, startOffset: 3 },
                { name: "Finish", calculatedDays: 4, manualDays: 4, manhours: 0, startOffset: 17 },
            ],
        });
        const context = reviewContext(db);
        const draft = draftFromProject(context.project, keys());
        expect(reviewReadiness(context, draft).missing).toEqual([{
            key: "programme",
            label: "Programme",
            ok: false,
            fix: "One of your programme stages has no name or no length. Fix or remove it in Programme.",
        }]);
        const result = await publishProposalAction(PROJECT_ID, { responseKind: "acknowledgement", deliverByEmail: false, reviewedContent: "a".repeat(64) });
        expect(result).toMatchObject({ success: false });
        if (!result.success) expect(result.error).toContain("One of your programme stages has no name or no length.");
        expect(db.rpcCalls).toEqual([]);
    });
});
