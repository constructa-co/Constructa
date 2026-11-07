import { beforeEach, describe, expect, it, vi } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { fakeInterviewDb } from "./__fixtures__/fake-db";
import { approve, buildDraft, loadInterview, saveAnswer } from "./service";

/**
 * A draft must be bound to the exact sources it was written from.
 *
 * The service reads the answers and the business name, writes the text, and
 * only then asks the database to save it. Anything that changes in that gap
 * (another tab, the Profile form) must not end up "vouched for" by a draft
 * whose words came from the older values.
 */

const ALPHA = "aaaaaaaa-0000-4000-8000-000000000001";
const NOW = () => Date.parse("2026-10-08T09:00:00.000Z");

type Db = ReturnType<typeof fakeInterviewDb>;
const seed = () => fakeInterviewDb({
    profiles: [{ id: ALPHA, company_name: "Smith Builders", business_type: "Building", capability_statement: null, years_trading: null, accreditations: null, insurance_details: null }],
});
const as = (db: Db) => ({ supabase: db.user, admin: db.admin, userId: ALPHA, now: NOW });

async function answer(db: Db, key: string, text: string, skipped = false) {
    const saved = (await loadInterview(as(db)))!.answers[key as "work"];
    const result = await saveAnswer(as(db), { key, answer: text, skipped, expectedRevision: saved?.revision ?? 0 });
    if (!result.ok) throw new Error(result.error);
}
async function answered() {
    const db = seed();
    await answer(db, "work", "Kitchen fitting");
    await answer(db, "area", "Leeds");
    await answer(db, "business_started", "2017");
    await answer(db, "memberships", "Gas Safe registered");
    return db;
}
const drafts = (db: Db) => db.tables.company_narrative_drafts;
const live = (db: Db) => drafts(db).filter((row) => row.status !== "superseded");
const approveAll = async (db: Db) => {
    const draft = (await loadInterview(as(db)))!.draft!;
    const results = [await approve(as(db), { draftId: draft.id, target: "introduction", text: draft.text, expectedExisting: draft.savedIntroduction })];
    for (const fact of draft.facts) results.push(await approve(as(db), { draftId: draft.id, target: fact.field, text: null, expectedExisting: fact.existing }));
    return results;
};
const published = (db: Db) => JSON.stringify(buildProposalPublicationSnapshot({ ...representativeInput(), profile: { ...representativeInput().profile, ...db.profile(ALPHA) } }).contractor);

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("a change between reading the sources and saving the draft", () => {
    it.each([
        ["an answer used in the introduction is changed", (db: Db) => answer(db, "work", "Roofing only"), "Kitchen fitting", "roofing only"],
        ["an answer behind an offered fact is changed", (db: Db) => answer(db, "memberships", "NICEIC approved contractor"), "Gas Safe registered", "NICEIC approved contractor"],
        ["the year behind years trading is changed", (db: Db) => answer(db, "business_started", "2021"), "since 2017", "since 2021"],
        ["an answer is skipped", (db: Db) => answer(db, "area", "", true), "We cover Leeds", null],
        ["a new question is answered", (db: Db) => answer(db, "strengths", "We tidy up every day"), null, "we tidy up every day"],
        ["the business name is changed on the Profile form", (db: Db) => { db.profile(ALPHA).company_name = "Smith & Daughters Ltd"; }, "Smith Builders", "Smith & Daughters Ltd"],
    ])("when %s, no draft carries the old content as current", async (_name, change, oldText, newText) => {
        const db = await answered();
        db.beforeNext("company_narrative_save_draft", () => change(db));

        const built = await buildDraft(as(db));

        // Whatever is saved as the current draft was written from the sources as they are now.
        const current = live(db);
        expect(current).toHaveLength(1);
        const content = JSON.stringify([current[0].draft_text, current[0].facts]);
        if (oldText) expect(content).not.toContain(oldText);
        if (newText) expect(content).toContain(newText);
        expect(built.ok && built.state.draft).toMatchObject({ stale: false });

        // And approving it, then publishing, never carries the old content.
        const results = await approveAll(db);
        expect(results.every((result) => result.ok)).toBe(true);
        if (oldText) expect(published(db)).not.toContain(oldText);
    });

    it("rejects the stale save outright: nothing is inserted and the earlier draft is not retired by it", async () => {
        const db = await answered();
        const first = await buildDraft(as(db));
        if (!first.ok) throw new Error(first.error);
        const firstId = first.state.draft!.id;

        // Change an answer, then make every later attempt race again, so the service must give up.
        await answer(db, "work", "Roofing only");
        let flip = 0;
        const race = () => { db.beforeNext("company_narrative_save_draft", race); return answer(db, "area", `Leeds ${flip++}`); };
        db.beforeNext("company_narrative_save_draft", race);

        const result = await buildDraft(as(db));
        expect(result.ok).toBe(false);
        // Bounded: a fixed number of attempts, each refused by the database.
        const attempts = db.rpcCalls.filter((call) => call.name === "company_narrative_save_draft").length - 1;
        expect(attempts).toBe(3);
        // Nothing new was stored, and the earlier draft was not superseded by a refused save.
        expect(drafts(db)).toHaveLength(1);
        expect(drafts(db)[0]).toMatchObject({ id: firstId, status: "draft" });
        // That earlier draft is itself out of date now, and cannot be approved.
        expect((await loadInterview(as(db)))!.draft).toMatchObject({ id: firstId, stale: true });
        expect((await approve(as(db), { draftId: firstId, target: "introduction", text: null, expectedExisting: null })).ok).toBe(false);
        expect(db.profileWrites).toEqual([]);
    });

    it("a fresh attempt after the sources settle succeeds from the latest values", async () => {
        const db = await answered();
        db.beforeNext("company_narrative_save_draft", () => answer(db, "work", "Roofing only"));
        const built = await buildDraft(as(db));
        expect(built.ok && built.state.draft!.text).toContain("specialises in roofing only");
        // One refused save, one accepted.
        expect(db.rpcCalls.filter((call) => call.name === "company_narrative_save_draft")).toHaveLength(2);
        expect(drafts(db)).toHaveLength(1);
    });

    it("the same answer saved again at the same moment still counts as a change of source", async () => {
        const db = await answered();
        // Same words, new revision: the draft must be bound to the revision it read.
        db.beforeNext("company_narrative_save_draft", () => answer(db, "work", "Kitchen fitting"));
        const built = await buildDraft(as(db));
        expect(built.ok).toBe(true);
        expect(db.rpcCalls.filter((call) => call.name === "company_narrative_save_draft")).toHaveLength(2);
        expect(built.ok && built.state.draft!.basedOn).toContainEqual({ kind: "answer", key: "work", revision: 2 });
    });
});

describe("the business name is a source too", () => {
    it("a draft goes stale when the business name changes after it was built, and cannot be approved", async () => {
        const db = await answered();
        const built = await buildDraft(as(db));
        if (!built.ok) throw new Error(built.error);
        expect(built.state.draft!.text).toContain("Smith Builders specialises in");

        db.profile(ALPHA).company_name = "Smith & Daughters Ltd";
        expect((await loadInterview(as(db)))!.draft).toMatchObject({ stale: true });

        const draft = built.state.draft!;
        const result = await approve(as(db), { draftId: draft.id, target: "introduction", text: draft.text, expectedExisting: null });
        expect(result.ok).toBe(false);
        expect(db.profile(ALPHA).capability_statement).toBeNull();
        // What comes back is rebuilt with the name as it is now.
        expect(!result.ok && result.state?.draft?.text).toContain("Smith & Daughters Ltd specialises in");
        expect(!result.ok && result.state?.draft?.text).not.toContain("Smith Builders");
    });

    it("the saved introduction being replaced is a separate check from the sources", async () => {
        const db = await answered();
        const built = await buildDraft(as(db));
        if (!built.ok) throw new Error(built.error);
        const draft = built.state.draft!;
        // The introduction saved on the profile changes; no source did.
        db.profile(ALPHA).capability_statement = "Typed by hand";
        expect((await loadInterview(as(db)))!.draft).toMatchObject({ stale: false, savedIntroduction: "Typed by hand" });
        expect(await approve(as(db), { draftId: draft.id, target: "introduction", text: draft.text, expectedExisting: null })).toMatchObject({ ok: true, outcome: "conflict" });
        expect(db.profile(ALPHA).capability_statement).toBe("Typed by hand");
        expect(drafts(db)).toHaveLength(1);
    });
});

describe("the fingerprint is the server's", () => {
    it("is derived by the service from what it read and re-derived by the database; a browser cannot supply one", async () => {
        const db = await answered();
        await buildDraft({ ...as(db), expectedFingerprint: "forged", fingerprint: "forged" } as never);
        const call = db.rpcCalls.find((entry) => entry.name === "company_narrative_save_draft")!;
        expect(call.args.p_expected_fingerprint).toMatch(/^[0-9a-f]{32}$/);
        expect(call.args.p_expected_fingerprint).toBe(drafts(db)[0].answers_fingerprint);
    });
});
