"use server";

/**
 * Fixture harness for the guided company interview. TEST ONLY.
 *
 * Like the website-import harness beside it, these files are copied into the
 * app only for a fixture browser run and removed afterwards, and every entry
 * point refuses to work unless CONSTRUCTA_IMPORT_FIXTURE is "1".
 *
 * The real interview service runs behind the real screen, against an
 * in-memory database. No network, no Supabase, no model.
 */

import { notFound } from "next/navigation";
import { fakeInterviewDb } from "@/lib/company-interview/__fixtures__/fake-db";
import { approve, buildDraft, loadInterview, saveAnswer } from "@/lib/company-interview/service";

const ALPHA = "aaaaaaaa-0000-4000-8000-000000000001";
const NOW = () => Date.parse("2026-10-08T09:00:00.000Z");

type State = { db: ReturnType<typeof fakeInterviewDb> };
const store = globalThis as unknown as { __constructaInterviewFixture?: Record<string, State> };

function guard() {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
}

function stateFor(run: string): State {
    store.__constructaInterviewFixture ??= {};
    store.__constructaInterviewFixture[run] ??= {
        db: fakeInterviewDb({
            profiles: [{ id: ALPHA, company_name: "Smith Builders", business_type: "Building", capability_statement: null, years_trading: null, accreditations: null, insurance_details: null }],
            // A website suggestion that was never approved. The interview must not pick it up.
            pendingImport: [{ id: "import-1", user_id: ALPHA, items: [{ field: "company_name", proposed: "Evil Website Ltd, NICEIC approved", status: "pending" }] }],
        }),
    };
    return store.__constructaInterviewFixture[run];
}

const context = (run: string) => {
    const { db } = stateFor(run);
    return { supabase: db.user, admin: db.admin, userId: ALPHA, now: NOW };
};

export async function fixtureInterview(run: string) {
    guard();
    return loadInterview(context(run));
}

export async function fixtureSave(run: string, input: { key: string; answer: string; skipped: boolean; expectedRevision: number }) {
    guard();
    return saveAnswer(context(run), input);
}

export async function fixtureBuild(run: string) {
    guard();
    return buildDraft(context(run));
}

export async function fixtureApprove(run: string, input: { draftId: string; target: string; text: string | null; expectedExisting: string | null }) {
    guard();
    return approve(context(run), input);
}

/**
 * What the spec reads back, and the things it makes happen "somewhere else":
 * an answer saved in another tab, a profile edited by hand, a failing write.
 */
export async function fixtureControl(run: string, op: { lateAnswer?: [string, string]; raceAnswer?: [string, string]; profile?: [string, string]; fail?: string }) {
    guard();
    const { db } = stateFor(run);
    if (op.raceAnswer) {
        // Lands in the gap between the service reading its sources and saving the next draft.
        const [key, text] = op.raceAnswer;
        db.beforeNext("company_narrative_save_draft", async () => {
            const current = db.tables.company_interview_answers.find((row) => row.user_id === ALPHA && row.question_key === key);
            await saveAnswer(context(run), { key, answer: text, skipped: false, expectedRevision: Number(current?.revision ?? 0) });
        });
    }
    if (op.lateAnswer) {
        const current = db.tables.company_interview_answers.find((row) => row.user_id === ALPHA && row.question_key === op.lateAnswer![0]);
        await saveAnswer(context(run), { key: op.lateAnswer[0], answer: op.lateAnswer[1], skipped: false, expectedRevision: Number(current?.revision ?? 0) });
    }
    if (op.profile) db.profile(ALPHA)[op.profile[0]] = op.profile[1];
    if (op.fail) db.fail(op.fail);
    return {
        profile: db.profile(ALPHA),
        answers: Object.fromEntries(db.tables.company_interview_answers.map((row) => [row.question_key, row.skipped ? "(skipped)" : row.answer])),
        drafts: db.tables.company_narrative_drafts.map((row) => ({ status: row.status, edited: row.approved_edited, generator: row.generator })),
        draftTexts: db.tables.company_narrative_drafts.map((row) => row.draft_text),
        draftSaves: db.rpcCalls.filter((call) => call.name === "company_narrative_save_draft").length,
        tablesRead: Array.from(new Set(db.reads)).sort(),
        saves: db.rpcCalls.filter((call) => call.name === "company_interview_save_answer").length,
    };
}
