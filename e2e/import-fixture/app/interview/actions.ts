"use server";

/**
 * Fixture harness for the guided company interview. TEST ONLY.
 *
 * Like the website-import harness beside it, these files are copied into the
 * app only for a fixture browser run and removed afterwards, and every entry
 * point refuses to work unless CONSTRUCTA_IMPORT_FIXTURE is "1".
 *
 * The real interview service, the real AI-wording flow and the real budget
 * wrapper run behind the real screen, over in-memory tables. The "provider"
 * is a canned generator that returns replies the spec hands it. No network,
 * no Supabase, no model, and nothing here says anything about what a real
 * model would write.
 *
 * AI wording is OFF here unless the run's name starts with "ai-", which is
 * how the fixture shows the switched-on screen. The application itself ships
 * with it off, and nothing in this folder can change that.
 */

import { notFound } from "next/navigation";
import { wordingRig, type CannedReply } from "@/lib/company-interview/__fixtures__/wording-rig";
import { aiWordingOffered } from "@/lib/company-interview/ai-availability";
import { rewordDraft } from "@/lib/company-interview/ai-wording";
import { approve, buildDraft, loadInterview, saveAnswer } from "@/lib/company-interview/service";

type Rig = ReturnType<typeof wordingRig>;
const store = globalThis as unknown as { __constructaInterviewFixture?: Record<string, Rig> };

function guard() {
    if (process.env.CONSTRUCTA_IMPORT_FIXTURE !== "1") notFound();
}

function rigFor(run: string): Rig {
    store.__constructaInterviewFixture ??= {};
    store.__constructaInterviewFixture[run] ??= wordingRig({ enabled: run.startsWith("ai-") });
    return store.__constructaInterviewFixture[run];
}

export async function fixtureInterview(run: string) {
    guard();
    return loadInterview(rigFor(run).context);
}

export async function fixtureAiOffered(run: string) {
    guard();
    return aiWordingOffered(rigFor(run).admin as never);
}

export async function fixtureSave(run: string, input: { key: string; answer: string; skipped: boolean; expectedRevision: number }) {
    guard();
    return saveAnswer(rigFor(run).context, input);
}

export async function fixtureBuild(run: string) {
    guard();
    return buildDraft(rigFor(run).context);
}

export async function fixtureReword(run: string) {
    guard();
    return rewordDraft(rigFor(run).context);
}

export async function fixtureApprove(run: string, input: { draftId: string; target: string; text: string | null; expectedExisting: string | null }) {
    guard();
    return approve(rigFor(run).context, input);
}

/**
 * What the spec reads back, and the things it makes happen "somewhere else":
 * an answer saved in another tab, a profile edited by hand, a failing write,
 * the next canned reply, a used-up allowance.
 */
export async function fixtureControl(run: string, op: {
    lateAnswer?: [string, string];
    raceAnswer?: [string, string];
    profile?: [string, string];
    fail?: string;
    aiReply?: { text: string } | { error: true };
    aiAllowance?: "used-up" | "normal";
}) {
    guard();
    const rig = rigFor(run);
    const { db, budget } = rig;
    if (op.raceAnswer) {
        // Lands in the gap between the service reading its sources and saving the next draft.
        const [key, text] = op.raceAnswer;
        db.beforeNext("company_narrative_save_draft", () => rig.answer(key, text));
    }
    if (op.lateAnswer) await rig.answer(op.lateAnswer[0], op.lateAnswer[1]);
    if (op.profile) rig.profile()[op.profile[0]] = op.profile[1];
    if (op.fail) db.fail(op.fail);
    if (op.aiReply) rig.reply(op.aiReply as CannedReply);
    if (op.aiAllowance) budget.limits.contractor.perHour = op.aiAllowance === "used-up" ? 0 : 6;
    return {
        profile: rig.profile(),
        answers: Object.fromEntries(db.tables.company_interview_answers.map((row) => [row.question_key, row.skipped ? "(skipped)" : row.answer])),
        drafts: db.tables.company_narrative_drafts.map((row) => ({ status: row.status, edited: row.approved_edited, generator: row.generator })),
        draftTexts: db.tables.company_narrative_drafts.map((row) => row.draft_text),
        draftSaves: db.rpcCalls.filter((call) => call.name === "company_narrative_save_draft").length,
        tablesRead: Array.from(new Set(db.reads)).sort(),
        saves: db.rpcCalls.filter((call) => call.name === "company_interview_save_answer").length,
        aiAttempts: budget.attempts.map((attempt) => attempt.outcome),
        aiCharged: budget.charged(),
        providerCalls: rig.providerCalls.length,
        budgetCalls: budget.rpcCalls.length,
    };
}
