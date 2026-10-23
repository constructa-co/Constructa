/**
 * The ONE module on the interview's path that can reach the AI provider.
 *
 * It is called by one explicit action: the contractor finishing the
 * interview, or pressing "Reword it". Loading the page, resuming, going
 * back, saving an answer, rebuilding after a change and approving never come
 * here; they use `service.ts`, which imports nothing from this file. Tests
 * hold that line structurally.
 *
 * What happens, in order:
 *
 *   1. The sources are read (answers, business name) and fingerprinted: F.
 *   2. The provider is called through the usage budget (`withAiBudget`), once.
 *      If the budget refuses, or AI wording is switched off, nothing is called.
 *   3. The reply is judged BEFORE the attempt is recorded: tripwires, then a
 *      fresh read of the sources. If they moved while the reply was being
 *      written, the reply is discarded and recorded as `sources-moved`.
 *   4. The attempt is recorded, once. Only then is the draft saved, stating F
 *      and naming the attempt. The database compares F with the sources again
 *      under its lock and checks the attempt is this contractor's good one.
 *      If the sources moved in that last gap the save is refused; the attempt
 *      stays a truthful record of a valid reply that was never used.
 *
 * Whatever goes wrong at any step, the contractor gets the plain fixed-rule
 * draft from `buildDraft`. There is no second call and no retry: rewording
 * again is a new press and a new reservation.
 */

import type { ZodTypeAny, z } from "zod";
import type { GenerateStructuredOptions, StructuredResult } from "@/lib/ai";
import { withAiBudget, type AiVerdict } from "@/lib/ai-budget";
import { INTRO_PROMPT_VERSION, IntroReplySchema, buildIntroductionMessages, introductionProblems } from "./ai-draft";
import { QUESTION_SET_VERSION } from "./questions";
import { buildDraft, loadInterview, readAnswers, readProfile, sourceFingerprint, type DraftResult, type InterviewContext } from "./service";
import { buildFacts } from "./template";

/** Why the draft shown is the plain one. `off` means AI wording is not on offer at all. */
export type PlainReason = "off" | "busy" | "used-up" | "nothing-to-word" | "not-usable" | "sources-moved" | "unavailable";

export type WordingResult = DraftResult & {
    /** `ai` when the saved draft is the AI wording; otherwise why it is the plain one. */
    wording: "ai" | PlainReason;
};

export interface WordingContext extends InterviewContext {
    /** Replaced only by tests, the evaluation harness and the fixture harness, with a canned generator. */
    generate?: <S extends ZodTypeAny>(options: GenerateStructuredOptions<S>) => Promise<StructuredResult<z.infer<S>>>;
}

export async function rewordDraft(context: WordingContext): Promise<WordingResult> {
    const { supabase, admin, userId, now = Date.now } = context;
    const plain = async (reason: PlainReason): Promise<WordingResult> => ({ ...(await buildDraft(context)), wording: reason });

    // 1. The sources this wording will be written from.
    const [profile, answers] = await Promise.all([readProfile(supabase, userId), readAnswers(supabase, userId)]);
    if (!profile || !answers) return plain("unavailable");
    const fingerprint = sourceFingerprint(answers, profile.company_name);
    const messages = buildIntroductionMessages({ companyName: profile.company_name ?? "", answers });
    if (!messages) return plain("nothing-to-word");

    // 2 and 3. One budgeted call. The verdict is reached before the attempt is recorded.
    const judge = async (reply: z.infer<typeof IntroReplySchema>): Promise<AiVerdict> => {
        if (introductionProblems(reply.introduction.trim(), messages).length > 0) return "rejected:tripwire";
        const [profileNow, answersNow] = await Promise.all([readProfile(supabase, userId), readAnswers(supabase, userId)]);
        if (!profileNow || !answersNow || sourceFingerprint(answersNow, profileNow.company_name) !== fingerprint) return "sources-moved";
        return "ok";
    };
    const result = await withAiBudget(
        { admin, userId, feature: "company.introduction", promptVersion: INTRO_PROMPT_VERSION, sourceFingerprint: fingerprint, generate: context.generate },
        { label: "company.introduction", system: messages.system, user: messages.user, schema: IntroReplySchema },
        judge,
    );

    if (result.status === "refused") {
        return plain(result.reason === "disabled" ? "off" : result.reason === "in-flight" ? "busy" : result.reason === "unavailable" ? "unavailable" : "used-up");
    }
    if (result.status === "rejected") return plain(result.outcome === "sources-moved" ? "sources-moved" : "not-usable");
    if (result.status === "failed") return plain("unavailable");

    // 4. Save, naming the attempt and the sources. The database has the last word on both.
    const { data, error } = await admin.rpc("company_narrative_save_draft", {
        p_user_id: userId,
        p_section: "introduction",
        p_draft_text: result.data.introduction.trim(),
        p_generator: "ai",
        p_generator_version: result.promptVersion,
        p_model: result.model,
        p_question_set_version: QUESTION_SET_VERSION,
        p_based_on: messages.basedOn,
        p_facts: buildFacts(answers, profile, new Date(now()).getUTCFullYear()),
        p_profile_baseline: profile.capability_statement ?? null,
        p_expected_fingerprint: fingerprint,
        p_ai_attempt_id: result.attemptId,
    });
    const outcome = (data as { outcome?: string } | null)?.outcome;
    if (error || outcome !== "saved") {
        // Sources moved after the attempt was recorded, or the attempt was not accepted. The reply is not used.
        if (error) console.error("company interview ai draft save failed", { code: error.code });
        return plain(outcome === "stale-source" ? "sources-moved" : "unavailable");
    }

    const state = await loadInterview({ supabase, userId });
    return state ? { ok: true, state, wording: "ai" } : { ...(await buildDraft(context)), wording: "unavailable" };
}
