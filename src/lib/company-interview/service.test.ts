import { beforeEach, describe, expect, it, vi } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { fakeInterviewDb } from "./__fixtures__/fake-db";
import {
    INTERVIEW_ANSWER_CONFLICT,
    INTERVIEW_NOTHING_TO_DRAFT,
    INTERVIEW_SAVE_ERROR,
    INTERVIEW_STALE_ANSWERS,
    answersFingerprint,
    approve,
    buildDraft,
    loadInterview,
    saveAnswer,
    type InterviewState,
} from "./service";

const ALPHA = "aaaaaaaa-0000-4000-8000-000000000001";
const BETA = "bbbbbbbb-0000-4000-8000-000000000002";
const NOW = () => Date.parse("2026-10-08T09:00:00.000Z");
const PENDING_IMPORT = "Evil Website Ltd, NICEIC approved, 0900 123456";

type Db = ReturnType<typeof fakeInterviewDb>;
const seed = () => fakeInterviewDb({
    profiles: [
        { id: ALPHA, company_name: "Smith Builders", business_type: "Building", capability_statement: null, years_trading: null, accreditations: null, insurance_details: null, phone: "0113 000 0000" },
        { id: BETA, company_name: "Beta Joinery", business_type: "Joinery", capability_statement: "Beta in its own words", years_trading: 4, accreditations: null, insurance_details: null },
    ],
    // A website suggestion the contractor has NOT approved.
    pendingImport: [{ id: "import-1", user_id: ALPHA, items: [{ field: "company_name", proposed: PENDING_IMPORT, status: "pending" }, { field: "specialisms", proposed: PENDING_IMPORT, status: "pending" }] }],
});
const as = (db: Db, userId = ALPHA) => ({ supabase: db.user, admin: db.admin, userId, now: NOW });

const ANSWERS: Array<[string, string]> = [
    ["work", "Kitchen and bathroom fitting"],
    ["business_started", "2017"],
    ["career_experience", "22 years"],
    ["area", "Leeds"],
    ["strengths", "We tidy up every day"],
    ["memberships", "Gas Safe registered, number 123456"],
    ["insurance", "Public liability £2 million"],
];

async function answer(db: Db, key: string, text: string, userId = ALPHA) {
    const saved = (await loadInterview(as(db, userId)))!.answers[key as "work"];
    const result = await saveAnswer(as(db, userId), { key, answer: text, skipped: false, expectedRevision: saved?.revision ?? 0 });
    if (!result.ok) throw new Error(result.error);
    return result;
}
async function interviewed(db = seed()) {
    for (const [key, text] of ANSWERS) await answer(db, key, text);
    const built = await buildDraft(as(db));
    if (!built.ok) throw new Error(built.error);
    return { db, state: built.state, draft: built.state.draft! };
}
const introduction = (draft: InterviewState["draft"], text: string | null = draft!.text) =>
    ({ draftId: draft!.id, target: "introduction", text, expectedExisting: draft!.savedIntroduction });
const fact = (draft: InterviewState["draft"], field: string) =>
    ({ draftId: draft!.id, target: field, text: null, expectedExisting: draft!.facts.find((entry) => entry.field === field)!.existing });
const contractorSeenByClients = (profile: Record<string, unknown>) =>
    buildProposalPublicationSnapshot({ ...representativeInput(), profile: { ...representativeInput().profile, ...profile } }).contractor;

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saveAnswer", () => {
    it("saves one answer at a time and numbers its revisions", async () => {
        const db = seed();
        expect(await saveAnswer(as(db), { key: "work", answer: "  Kitchens\nand   bathrooms ", skipped: false, expectedRevision: 0 })).toEqual({ ok: true, revision: 1, answer: "Kitchens and bathrooms", skipped: false });
        expect(await saveAnswer(as(db), { key: "work", answer: "Kitchens only", skipped: false, expectedRevision: 1 })).toMatchObject({ ok: true, revision: 2 });
        expect((await loadInterview(as(db)))!.answers.work).toEqual({ answer: "Kitchens only", skipped: false, revision: 2 });
        expect(db.profileWrites).toEqual([]);
    });

    it("refuses a save from a tab that has not seen the latest answer, and says what is saved", async () => {
        const db = seed();
        await answer(db, "work", "Kitchens");
        await answer(db, "work", "Kitchens and bathrooms");
        const stale = await saveAnswer(as(db), { key: "work", answer: "Roofing", skipped: false, expectedRevision: 1 });
        expect(stale).toEqual({ ok: false, error: INTERVIEW_ANSWER_CONFLICT, conflict: { answer: "Kitchens and bathrooms", skipped: false, revision: 2 } });
        expect((await loadInterview(as(db)))!.answers.work?.answer).toBe("Kitchens and bathrooms");
    });

    it("records a skip, and treats an empty answer as a skip", async () => {
        const db = seed();
        expect(await saveAnswer(as(db), { key: "area", answer: "ignored", skipped: true, expectedRevision: 0 })).toEqual({ ok: true, revision: 1, answer: "", skipped: true });
        expect(await saveAnswer(as(db), { key: "customers", answer: "   ", skipped: false, expectedRevision: 0 })).toMatchObject({ ok: true, skipped: true });
    });

    it("refuses unknown questions, bad years and over-long answers before any write", async () => {
        const db = seed();
        for (const input of [
            { key: "bank_details", answer: "x", skipped: false, expectedRevision: 0 },
            { key: "business_started", answer: "about nine years", skipped: false, expectedRevision: 0 },
            { key: "work", answer: "x".repeat(601), skipped: false, expectedRevision: 0 },
            { key: "work", answer: "x", skipped: false, expectedRevision: -1 },
        ]) expect((await saveAnswer(as(db), input)).ok, input.key).toBe(false);
        expect(db.rpcCalls).toEqual([]);
    });

    it("keeps what was typed out of the database when the save fails, and works on retry", async () => {
        const db = seed();
        db.fail("company_interview_save_answer");
        const input = { key: "work", answer: "Kitchens", skipped: false, expectedRevision: 0 };
        expect(await saveAnswer(as(db), input)).toEqual({ ok: false, error: INTERVIEW_SAVE_ERROR });
        expect(db.tables.company_interview_answers).toEqual([]);
        expect((await saveAnswer(as(db), input)).ok).toBe(true);
    });
});

describe("buildDraft", () => {
    it("puts a draft together from the saved answers and changes nothing on the profile", async () => {
        const before = JSON.stringify(seed().tables.profiles);
        const { db, draft } = await interviewed();

        expect(JSON.stringify(db.tables.profiles)).toBe(before);
        expect(db.profileWrites).toEqual([]);
        expect(draft).toMatchObject({ generator: "template", status: "draft", stale: false, savedIntroduction: null, approvedEdited: false });
        expect(draft.text).toBe("Smith Builders specialises in kitchen and bathroom fitting. We cover Leeds. The business has been trading since 2017. Experience in the trade: 22 years.\n\nHow we work: we tidy up every day.");
        expect(draft.facts.map((entry) => [entry.field, entry.proposed, entry.status])).toEqual([
            ["years_trading", "9", "pending"],
            ["accreditations", "Gas Safe registered, number 123456", "pending"],
            ["insurance_details", "Public liability £2 million", "pending"],
        ]);
        const saved = db.tables.company_narrative_drafts[0];
        expect(saved).toMatchObject({ user_id: ALPHA, generator: "template", generator_version: "intro-template-v1", model: null, question_set_version: "interview-v1" });
    });

    it("the fingerprint is the database's, and matches what the server can recompute from the answers", async () => {
        const { db, state } = await interviewed();
        expect(db.tables.company_narrative_drafts[0].answers_fingerprint).toBe(answersFingerprint(state.answers));
        expect(db.rpcCalls.find((call) => call.name === "company_narrative_save_draft")!.args).not.toHaveProperty("p_answers_fingerprint");
    });

    it("reads only the contractor's answers, drafts and saved profile, never a website suggestion", async () => {
        const { db, draft } = await interviewed();
        await approve(as(db), introduction(draft));
        expect(new Set(db.reads)).toEqual(new Set(["profiles", "company_interview_answers", "company_narrative_drafts"]));
        expect(JSON.stringify(db.tables.company_narrative_drafts)).not.toContain("Evil Website");
        expect(JSON.stringify(db.rpcCalls)).not.toContain("Evil Website");
        expect(JSON.stringify(db.profile(ALPHA))).not.toContain("NICEIC");
    });

    it("says so when there is nothing to draft from", async () => {
        const db = seed();
        expect(await buildDraft(as(db))).toEqual({ ok: false, error: INTERVIEW_NOTHING_TO_DRAFT });
        await saveAnswer(as(db), { key: "work", answer: "", skipped: true, expectedRevision: 0 });
        expect(await buildDraft(as(db))).toEqual({ ok: false, error: INTERVIEW_NOTHING_TO_DRAFT });
        expect(db.tables.company_narrative_drafts).toEqual([]);
    });

    it("never writes through the contractor's own client", async () => {
        const { db, draft } = await interviewed();
        await approve(as(db), introduction(draft));
        expect(db.deniedWrites).toEqual([]);
        expect((await db.user.from("company_interview_answers").insert({ user_id: ALPHA })).error.code).toBe("42501");
        expect((await db.user.from("company_narrative_drafts").update({ status: "approved" }).eq("id", draft.id)).error.code).toBe("42501");
    });
});

describe("approve", () => {
    it("saves the introduction unchanged and records that it was not edited", async () => {
        const { db, draft } = await interviewed();
        const result = await approve(as(db), introduction(draft));
        expect(result).toMatchObject({ ok: true, outcome: "applied", edited: false });
        expect(db.profile(ALPHA).capability_statement).toBe(draft.text);
        expect(db.profileWrites.map((write) => write.field)).toEqual(["capability_statement"]);
        expect(result.ok && result.state.draft).toMatchObject({ status: "approved", approvedEdited: false, savedIntroduction: draft.text });
        // Facts were not approved with it.
        expect(db.profile(ALPHA)).toMatchObject({ years_trading: null, accreditations: null, insurance_details: null });
    });

    it("records the contractor's own edit as theirs, even when it adds a claim", async () => {
        const { db, draft } = await interviewed();
        const own = "Smith Builders fits kitchens and bathrooms across Leeds.\n\nWe are NICEIC approved and have won two awards.";
        const result = await approve(as(db), introduction(draft, own));
        expect(result).toMatchObject({ ok: true, outcome: "applied", edited: true });
        expect(db.profile(ALPHA).capability_statement).toBe(own);
        expect(db.tables.company_narrative_drafts[0]).toMatchObject({ status: "approved", approved_edited: true, approved_text: own, generator: "template" });
    });

    it("refuses an edit that is not plain text or is too long, before any write", async () => {
        const { db, draft } = await interviewed();
        const calls = db.rpcCalls.length;
        for (const text of ["", "   ", "We are <script>alert(1)</script>", "x".repeat(2001), null]) {
            expect((await approve(as(db), introduction(draft, text))).ok, String(text).slice(0, 20)).toBe(false);
        }
        expect(db.rpcCalls.length).toBe(calls);
        expect(db.profile(ALPHA).capability_statement).toBeNull();
    });

    it("approves each fact on its own, in the contractor's exact words", async () => {
        const { db, draft } = await interviewed();
        const result = await approve(as(db), fact(draft, "accreditations"));
        expect(result).toMatchObject({ ok: true, outcome: "applied" });
        expect(db.profile(ALPHA)).toMatchObject({ accreditations: "Gas Safe registered, number 123456", insurance_details: null, years_trading: null, capability_statement: null });
        expect(result.ok && result.state.draft!.facts.map((entry) => entry.status)).toEqual(["pending", "applied", "pending"]);

        await approve(as(db), fact(result.ok ? result.state.draft : draft, "years_trading"));
        expect(db.profile(ALPHA).years_trading).toBe(9);
        expect(db.profile(ALPHA).insurance_details).toBeNull();
    });

    it("takes a fact's value from the saved draft, never from the request", async () => {
        const { db, draft } = await interviewed();
        await approve(as(db), { ...fact(draft, "accreditations"), text: "NICEIC approved contractor", proposed: "NICEIC", value: "NICEIC" });
        expect(db.profile(ALPHA).accreditations).toBe("Gas Safe registered, number 123456");
        expect(db.rpcCalls.at(-1)!.args).toEqual({ p_user_id: ALPHA, p_draft_id: draft.id, p_target: "accreditations", p_text: null, p_expected_existing: null });
    });

    it("cannot be pointed at a column outside its list", async () => {
        const { db, draft } = await interviewed();
        const calls = db.rpcCalls.length;
        for (const target of ["specialisms", "phone", "company_name", "bank_details", "id", "logo_url"]) {
            expect(await approve(as(db), { draftId: draft.id, target, text: "x", expectedExisting: null }), target).toEqual({ ok: false, error: INTERVIEW_SAVE_ERROR });
        }
        expect(db.rpcCalls.length).toBe(calls);
    });

    it("does not overwrite an introduction typed by hand after the draft was shown", async () => {
        const { db, draft } = await interviewed();
        db.profile(ALPHA).capability_statement = "Typed by hand in another tab";

        const stale = await approve(as(db), introduction(draft));
        expect(stale).toMatchObject({ ok: true, outcome: "conflict" });
        expect(db.profile(ALPHA).capability_statement).toBe("Typed by hand in another tab");
        expect(stale.ok && stale.state.draft).toMatchObject({ status: "draft", savedIntroduction: "Typed by hand in another tab" });

        // Shown the newer value, they replace it knowingly.
        const again = await approve(as(db), introduction(stale.ok ? stale.state.draft : draft));
        expect(again).toMatchObject({ ok: true, outcome: "applied" });
        expect(db.profile(ALPHA).capability_statement).toBe(draft.text);
    });

    it("cannot be told the profile is unchanged: the value shown must match what is saved", async () => {
        const { db, draft } = await interviewed();
        db.profile(ALPHA).years_trading = 3;
        // The browser claims nothing was saved. The database disagrees and writes nothing.
        expect(await approve(as(db), { draftId: draft.id, target: "years_trading", text: null, expectedExisting: null })).toMatchObject({ ok: true, outcome: "conflict" });
        expect(db.profile(ALPHA).years_trading).toBe(3);
    });

    it("refuses everything in a draft once an answer changes, and rebuilds from the latest answers", async () => {
        const { db, draft } = await interviewed();
        // A late answer, for example from another tab, after the draft was built.
        await answer(db, "area", "Leeds and Bradford");

        const result = await approve(as(db), introduction(draft));
        expect(result).toMatchObject({ ok: false, error: INTERVIEW_STALE_ANSWERS });
        expect(db.profile(ALPHA).capability_statement).toBeNull();
        const factResult = await approve(as(db), fact(draft, "accreditations"));
        expect(factResult.ok).toBe(false);
        expect(db.profile(ALPHA).accreditations).toBeNull();
        expect(db.profileWrites).toEqual([]);

        // What comes back is a fresh draft built from the new answer, and that one can be approved.
        const rebuilt = !factResult.ok && factResult.state ? factResult.state.draft! : null;
        expect(rebuilt?.text).toContain("We cover Leeds and Bradford.");
        expect(rebuilt?.id).not.toBe(draft.id);
        expect(await approve(as(db), introduction(rebuilt))).toMatchObject({ ok: true, outcome: "applied" });
    });

    it("the staleness decision is the database's: a client cannot assert a draft is current", async () => {
        const { db, draft } = await interviewed();
        await answer(db, "work", "Roofing only");
        const forged = await approve(as(db), { ...introduction(draft), stale: false, answersFingerprint: "anything", expectedRevision: 99 });
        expect(forged.ok).toBe(false);
        expect(db.profile(ALPHA).capability_statement).toBeNull();
        expect(Object.keys(db.rpcCalls.find((call) => call.name === "company_narrative_approve")!.args).sort()).toEqual(["p_draft_id", "p_expected_existing", "p_target", "p_text", "p_user_id"]);
    });

    it("changes nothing when the approval cannot be recorded, says so, and works on retry", async () => {
        const { db, draft } = await interviewed();
        db.fail("record-approval");
        expect(await approve(as(db), introduction(draft))).toEqual({ ok: false, error: INTERVIEW_SAVE_ERROR });
        expect(db.profile(ALPHA).capability_statement).toBeNull();
        expect(db.profileWrites).toEqual([]);
        expect(db.tables.company_narrative_drafts[0].status).toBe("draft");
        expect(await approve(as(db), introduction(draft))).toMatchObject({ ok: true, outcome: "applied" });
    });

    it("approves an introduction once, including when two tabs press save together", async () => {
        const { db, draft } = await interviewed();
        const tabs = await Promise.all([approve(as(db), introduction(draft)), approve(as(db), introduction(draft))]);
        expect(tabs.map((tab) => (tab.ok ? tab.outcome : "failed")).sort()).toEqual(["applied", "unavailable"]);
        expect(db.profileWrites).toHaveLength(1);
    });
});

describe("tenant isolation", () => {
    it("gives another contractor nothing to read and nothing to approve", async () => {
        const { db, draft } = await interviewed();
        const profiles = JSON.stringify(db.tables.profiles);
        const state = await loadInterview(as(db, BETA));
        expect(state).toMatchObject({ companyName: "Beta Joinery", answers: {}, draft: null });

        const attempt = await approve(as(db, BETA), { draftId: draft.id, target: "introduction", text: null, expectedExisting: "Beta in its own words" });
        expect(attempt.ok).toBe(false);
        expect(JSON.stringify(db.tables.profiles)).toBe(profiles);
        expect(db.tables.company_narrative_drafts.every((row) => row.user_id === ALPHA)).toBe(true);
    });

    it("keeps each contractor's answers, drafts and approvals their own", async () => {
        const { db } = await interviewed();
        await answer(db, "work", "Bespoke joinery", BETA);
        const beta = await buildDraft(as(db, BETA));
        if (!beta.ok) throw new Error(beta.error);
        expect(beta.state.draft!.text).toBe("Beta Joinery specialises in bespoke joinery.");
        expect(beta.state.draft!.savedIntroduction).toBe("Beta in its own words");

        await approve(as(db, BETA), introduction(beta.state.draft));
        expect(db.profile(BETA).capability_statement).toBe("Beta Joinery specialises in bespoke joinery.");
        expect(db.profile(ALPHA).capability_statement).toBeNull();
        expect(new Set(db.rpcCalls.filter((call) => call.args.p_user_id === BETA).map((call) => call.name)).size).toBe(3);
        expect((await loadInterview(as(db)))!.answers.work?.answer).toBe("Kitchen and bathroom fitting");
    });
});

describe("resume", () => {
    it("brings back answers and the draft, and marks the draft stale after a late answer", async () => {
        const { db, draft } = await interviewed();
        const resumed = (await loadInterview(as(db)))!;
        expect(Object.keys(resumed.answers)).toHaveLength(7);
        expect(resumed.draft).toMatchObject({ id: draft.id, stale: false });

        await answer(db, "customers", "Homeowners");
        const later = (await loadInterview(as(db)))!;
        expect(later.draft).toMatchObject({ id: draft.id, stale: true });
        expect(later.answers.customers?.answer).toBe("Homeowners");
    });

    it("compares offered facts with the profile as it is now, without writing", async () => {
        const { db } = await interviewed();
        const calls = db.rpcCalls.length;
        db.profile(ALPHA).accreditations = "gas safe registered,  number 123456";
        const facts = (await loadInterview(as(db)))!.draft!.facts;
        expect(facts.find((entry) => entry.field === "accreditations")).toMatchObject({ status: "same", existing: "gas safe registered,  number 123456" });
        expect(db.rpcCalls.length).toBe(calls);
    });

    it("returns nothing rather than a half-loaded interview when a read fails", async () => {
        const { db } = await interviewed();
        db.fail("select:company_interview_answers");
        expect(await loadInterview(as(db))).toBeNull();
    });
});

describe("immutable proposals", () => {
    it("answers and an unapproved draft never appear in a published snapshot", async () => {
        const { db, draft } = await interviewed();
        const published = JSON.stringify(contractorSeenByClients(db.profile(ALPHA)));
        expect(published).not.toContain("specialises in kitchen");
        expect(published).not.toContain("Gas Safe");
        expect(published).not.toContain("tidy up");
        expect(draft.text.length).toBeGreaterThan(0);
    });

    it("only what was approved reaches a later snapshot", async () => {
        const { db, draft } = await interviewed();
        await approve(as(db), introduction(draft));
        const published = contractorSeenByClients(db.profile(ALPHA));
        expect(published.capability_statement).toBe(draft.text);
        // Memberships and insurance were answered but not approved.
        expect(published.accreditations).not.toBe("Gas Safe registered, number 123456");
        expect(JSON.stringify(published)).not.toContain("Gas Safe");
        expect(JSON.stringify(published)).not.toContain("Public liability £2 million");
        expect(JSON.stringify(published)).not.toContain("Evil Website");
    });
});
