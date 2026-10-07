/**
 * The guided company interview on the server.
 *
 * Two database clients, as in the website import:
 *
 *   - `supabase` is the signed-in contractor's own client. It only reads:
 *     their profile, their answers and their drafts, under row level security.
 *   - `admin` is the server's service-role client. It is the only writer, and
 *     only through three functions the browser roles cannot execute. It is
 *     always given the id of the contractor the application authenticated.
 *
 * A draft is assembled only from the contractor's saved answers and their
 * saved profile. It never reads `company_import_drafts`: a website suggestion
 * is not a fact until the contractor has approved it into their profile.
 *
 * The draft here is always the fixed-rule template. There is no model call
 * on this path; see `ai-draft.ts` for why and what must exist first.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { plainTextProblem } from "./guard";
import {
    QUESTION_KEYS,
    QUESTION_SET_VERSION,
    cleanAnswer,
    type AnswerMap,
    type QuestionKey,
} from "./questions";
import {
    INTRODUCTION_MAX,
    INTRO_TEMPLATE_VERSION,
    buildFacts,
    buildIntroduction,
    sameFact,
    type BasedOn,
    type FactField,
    type InterviewProfile,
    type OfferedFact,
} from "./template";

type Reader = Pick<SupabaseClient, "from">;
type Writer = Pick<SupabaseClient, "rpc">;

export interface InterviewContext {
    supabase: Reader;
    admin: Writer;
    userId: string;
    now?: () => number;
}

export interface NarrativeDraft {
    id: string;
    text: string;
    generator: "template" | "ai";
    basedOn: BasedOn[];
    facts: OfferedFact[];
    /** The saved introduction as it is now: what an approval would replace. */
    savedIntroduction: string | null;
    status: "draft" | "approved";
    approvedEdited: boolean;
    approvedAt: string | null;
    /** True when the answers changed after this was built. It must be rebuilt before anything in it can be approved. */
    stale: boolean;
}

export interface InterviewState {
    companyName: string;
    answers: AnswerMap;
    draft: NarrativeDraft | null;
}

export const INTERVIEW_SAVE_ERROR = "We couldn't save that. Nothing was changed. Check your connection and try again.";
export const INTERVIEW_LOAD_ERROR = "We couldn't load your answers. Check your connection and try again.";
export const INTERVIEW_NOTHING_TO_DRAFT = "Answer at least one of the first six questions and we'll put an introduction together.";
export const INTERVIEW_STALE_ANSWERS = "Your answers changed after this was put together, so nothing was saved. Here is a new version from your latest answers.";
export const INTERVIEW_DRAFT_GONE = "That draft is no longer available. Here is the latest version.";

const PROFILE_COLUMNS = "company_name, business_type, capability_statement, years_trading, accreditations, insurance_details";
const DRAFT_COLUMNS = "id, draft_text, generator, based_on, facts, answers_fingerprint, status, approved_edited, approved_at";
const FACT_FIELDS = ["years_trading", "accreditations", "insurance_details"] as const;

const FactSchema = z.object({
    field: z.enum(FACT_FIELDS),
    proposed: z.string().max(600),
    existing: z.string().max(5000).nullable(),
    questionKey: z.enum(QUESTION_KEYS),
    status: z.enum(["pending", "same", "applied"]),
    appliedAt: z.string().nullable(),
});
const BasedOnSchema = z.union([
    z.object({ kind: z.literal("answer"), key: z.enum(QUESTION_KEYS), revision: z.number().int() }),
    z.object({ kind: z.literal("profile"), field: z.literal("company_name") }),
]);

/** The same fingerprint the database takes: which revision of every answer exists. */
export function answersFingerprint(answers: AnswerMap): string {
    const parts = Object.entries(answers)
        .filter(([, saved]) => saved && saved.revision > 0)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, saved]) => `${key}:${saved!.revision}:${saved!.skipped}`);
    return createHash("md5").update(parts.join("|")).digest("hex");
}

const factValue = (profile: InterviewProfile, field: FactField): string | null => {
    const value = profile[field];
    return value == null ? null : String(value);
};

async function readProfile(supabase: Reader, userId: string): Promise<InterviewProfile | null> {
    const { data, error } = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single();
    return error || !data ? null : (data as unknown as InterviewProfile);
}

async function readAnswers(supabase: Reader, userId: string): Promise<AnswerMap | null> {
    const { data, error } = await supabase
        .from("company_interview_answers")
        .select("question_key, answer, skipped, revision")
        .eq("user_id", userId);
    if (error || !Array.isArray(data)) return null;
    const answers: AnswerMap = {};
    for (const row of data as Array<{ question_key: string; answer: string; skipped: boolean; revision: number }>) {
        if ((QUESTION_KEYS as string[]).includes(row.question_key)) {
            answers[row.question_key as QuestionKey] = { answer: row.answer ?? "", skipped: !!row.skipped, revision: row.revision };
        }
    }
    return answers;
}

interface DraftRow {
    id: string;
    draft_text: string;
    generator: string;
    based_on: unknown;
    facts: unknown;
    answers_fingerprint: string;
    status: string;
    approved_edited: boolean | null;
    approved_at: string | null;
}

function toDraft(row: DraftRow, answers: AnswerMap, profile: InterviewProfile): NarrativeDraft {
    const facts = (Array.isArray(row.facts) ? row.facts : []).flatMap((entry) => {
        const parsed = FactSchema.safeParse(entry);
        if (!parsed.success) return [];
        const fact = parsed.data as OfferedFact;
        if (fact.status === "applied") return [fact];
        // The "saved now" side always shows the profile as it is at this moment.
        const existing = factValue(profile, fact.field);
        return [{ ...fact, existing, status: sameFact(existing, fact.proposed) ? "same" as const : "pending" as const }];
    });
    return {
        id: row.id,
        text: row.draft_text,
        generator: row.generator === "ai" ? "ai" : "template",
        basedOn: (Array.isArray(row.based_on) ? row.based_on : []).flatMap((entry) => {
            const parsed = BasedOnSchema.safeParse(entry);
            return parsed.success ? [parsed.data as BasedOn] : [];
        }),
        facts,
        savedIntroduction: profile.capability_statement ?? null,
        status: row.status === "approved" ? "approved" : "draft",
        approvedEdited: row.approved_edited === true,
        approvedAt: row.approved_at,
        stale: row.answers_fingerprint !== answersFingerprint(answers),
    };
}

/** Everything the interview screen needs. Reads only; writes nothing. */
export async function loadInterview(context: Pick<InterviewContext, "supabase" | "userId">): Promise<InterviewState | null> {
    const { supabase, userId } = context;
    const [profile, answers] = await Promise.all([readProfile(supabase, userId), readAnswers(supabase, userId)]);
    if (!profile || !answers) return null;

    const { data, error } = await supabase
        .from("company_narrative_drafts")
        .select(DRAFT_COLUMNS)
        .eq("user_id", userId)
        .in("status", ["draft", "approved"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) return null;
    return {
        companyName: (profile.company_name ?? "").trim(),
        answers,
        draft: data ? toDraft(data as DraftRow, answers, profile) : null,
    };
}

export type SaveAnswerResult =
    | { ok: true; revision: number; answer: string; skipped: boolean }
    /** Someone (another tab) saved this question since the caller loaded it. Nothing was written. */
    | { ok: false; conflict: { answer: string; skipped: boolean; revision: number }; error: string }
    | { ok: false; error: string };

export const INTERVIEW_ANSWER_CONFLICT = "This answer was changed somewhere else, so yours wasn't saved. The saved answer is shown. Change it again if you want to.";

const SaveAnswerInput = z.object({
    key: z.enum(QUESTION_KEYS),
    answer: z.string().max(5000),
    skipped: z.boolean(),
    expectedRevision: z.number().int().min(0).max(1_000_000),
});

export async function saveAnswer(context: InterviewContext, rawInput: unknown): Promise<SaveAnswerResult> {
    const { admin, userId, now = Date.now } = context;
    const input = SaveAnswerInput.safeParse(rawInput);
    if (!input.success) return { ok: false, error: INTERVIEW_SAVE_ERROR };

    const cleaned = cleanAnswer(input.data.key, input.data.skipped ? "" : input.data.answer, new Date(now()).getUTCFullYear());
    if (!cleaned.ok) return { ok: false, error: cleaned.error };
    // An empty answer that was not skipped is saved as a skip: there is nothing to draft from.
    const skipped = input.data.skipped || cleaned.value === "";

    const { data, error } = await admin.rpc("company_interview_save_answer", {
        p_user_id: userId,
        p_question_key: input.data.key,
        p_answer: cleaned.value,
        p_skipped: skipped,
        p_expected_revision: input.data.expectedRevision,
        p_question_set_version: QUESTION_SET_VERSION,
    });
    const result = data as { outcome?: string; revision?: number; answer?: string; skipped?: boolean } | null;
    if (error || !result?.outcome) {
        console.error("company interview answer save failed", { key: input.data.key, code: error?.code });
        return { ok: false, error: INTERVIEW_SAVE_ERROR };
    }
    if (result.outcome === "conflict") {
        return {
            ok: false,
            error: INTERVIEW_ANSWER_CONFLICT,
            conflict: { answer: result.answer ?? "", skipped: !!result.skipped, revision: result.revision ?? 0 },
        };
    }
    return { ok: true, revision: result.revision ?? input.data.expectedRevision + 1, answer: cleaned.value, skipped };
}

export type DraftResult = { ok: true; state: InterviewState } | { ok: false; error: string };

/**
 * Puts a draft together from the saved answers and saves it as a draft.
 * The profile is not touched.
 */
export async function buildDraft(context: InterviewContext): Promise<DraftResult> {
    const { supabase, admin, userId, now = Date.now } = context;
    const [profile, answers] = await Promise.all([readProfile(supabase, userId), readAnswers(supabase, userId)]);
    if (!profile || !answers) return { ok: false, error: INTERVIEW_LOAD_ERROR };

    const nowYear = new Date(now()).getUTCFullYear();
    const introduction = buildIntroduction(answers, profile, nowYear);
    const facts = buildFacts(answers, profile, nowYear);
    if (!introduction && facts.length === 0) return { ok: false, error: INTERVIEW_NOTHING_TO_DRAFT };

    const { error } = await admin.rpc("company_narrative_save_draft", {
        p_user_id: userId,
        p_section: "introduction",
        p_draft_text: introduction?.text ?? "",
        p_generator: "template",
        p_generator_version: INTRO_TEMPLATE_VERSION,
        p_model: null,
        p_question_set_version: QUESTION_SET_VERSION,
        p_based_on: introduction?.basedOn ?? [],
        p_facts: facts,
        p_profile_baseline: profile.capability_statement ?? null,
    });
    if (error) {
        console.error("company interview draft save failed", { code: error.code });
        return { ok: false, error: INTERVIEW_SAVE_ERROR };
    }
    const state = await loadInterview({ supabase, userId });
    return state ? { ok: true, state } : { ok: false, error: INTERVIEW_LOAD_ERROR };
}

export type ApproveOutcome = "applied" | "conflict" | "unavailable";
export type ApproveResult =
    | { ok: true; outcome: ApproveOutcome; state: InterviewState; edited?: boolean }
    | { ok: false; error: string; state?: InterviewState };

const ApproveInput = z.object({
    draftId: z.string().uuid(),
    target: z.enum(["introduction", ...FACT_FIELDS]),
    /** Only for the introduction: the text as the contractor left it in the box. */
    text: z.string().max(20_000).nullable(),
    /** The saved value the contractor was shown beside what they are approving. */
    expectedExisting: z.string().max(20_000).nullable(),
});

/**
 * Approves the introduction or one fact. One database transaction changes the
 * profile and records the approval, or does neither. Whether the answers or
 * the profile have moved on is decided in the database, not from anything the
 * browser says.
 */
export async function approve(context: InterviewContext, rawInput: unknown): Promise<ApproveResult> {
    const { supabase, admin, userId } = context;
    const input = ApproveInput.safeParse(rawInput);
    if (!input.success) return { ok: false, error: INTERVIEW_SAVE_ERROR };

    const isIntroduction = input.data.target === "introduction";
    if (isIntroduction) {
        const problem = plainTextProblem(input.data.text ?? "", INTRODUCTION_MAX);
        if (problem) return { ok: false, error: problem };
    }

    const { data, error } = await admin.rpc("company_narrative_approve", {
        p_user_id: userId,
        p_draft_id: input.data.draftId,
        p_target: input.data.target,
        // A fact's value is never sent: the database uses the one saved in the draft.
        p_text: isIntroduction ? input.data.text : null,
        p_expected_existing: input.data.expectedExisting,
    });
    const result = data as { outcome?: string; edited?: boolean } | null;
    if (error || !result?.outcome) {
        console.error("company interview approval failed", { target: input.data.target, code: error?.code });
        return { ok: false, error: INTERVIEW_SAVE_ERROR };
    }

    if (result.outcome === "stale-answers" || result.outcome === "not-found") {
        // Rebuild from the answers as they are now, so the contractor is looking at something approvable.
        const rebuilt = await buildDraft(context);
        const message = result.outcome === "stale-answers" ? INTERVIEW_STALE_ANSWERS : INTERVIEW_DRAFT_GONE;
        return rebuilt.ok ? { ok: false, error: message, state: rebuilt.state } : { ok: false, error: message };
    }
    if (result.outcome === "invalid-text") return { ok: false, error: plainTextProblem("<", INTRODUCTION_MAX)! };

    const state = await loadInterview({ supabase, userId });
    if (!state) {
        return { ok: false, error: result.outcome === "applied" ? "That was saved, but we couldn't refresh this page. Reload it to see it." : INTERVIEW_SAVE_ERROR };
    }
    const outcome: ApproveOutcome = result.outcome === "applied" ? "applied" : result.outcome === "conflict" ? "conflict" : "unavailable";
    return { ok: true, outcome, state, edited: result.edited };
}
