"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useTheme } from "@/lib/theme-context";
import { workspaceStyles } from "@/lib/workspace-styles";
import { PROFILE_PATH, PROPOSAL_READINESS_PATH } from "@/lib/first-session";
import {
    ANSWER_MAX,
    QUESTIONS,
    hasAnswer,
    interviewProgress,
    resolveStartIndex,
    type QuestionKey,
    type SavedAnswer,
} from "@/lib/company-interview/questions";
import { FACT_LABELS, INTRODUCTION_MAX, answersUsed, type OfferedFact } from "@/lib/company-interview/template";
import {
    INTERVIEW_LOAD_ERROR,
    INTERVIEW_SAVE_ERROR,
    type ApproveResult,
    type DraftResult,
    type InterviewState,
    type SaveAnswerResult,
} from "@/lib/company-interview/service";
import { approveInterviewAction, buildInterviewDraftAction, saveInterviewAnswerAction } from "./actions";

interface Props {
    initialState: InterviewState | null;
    /** Default to the real server actions; replaced only by tests and the fixture harness. */
    save?: (input: { key: string; answer: string; skipped: boolean; expectedRevision: number }) => Promise<SaveAnswerResult>;
    build?: () => Promise<DraftResult>;
    approve?: (input: { draftId: string; target: string; text: string | null; expectedExisting: string | null }) => Promise<ApproveResult>;
}

const REVIEW = QUESTIONS.length;
const NEVER: SavedAnswer = { answer: "", skipped: false, revision: 0 };
const questionNumber = (key: QuestionKey) => QUESTIONS.findIndex((question) => question.key === key) + 1;

/**
 * The guided company interview: one plain question at a time, each optional,
 * then a draft introduction built from the answers for the contractor to
 * read, change and approve. Nothing reaches their profile until they press
 * save on it, and typing the profile in by hand is always one link away.
 */
export default function InterviewClient({
    initialState,
    save = saveInterviewAnswerAction,
    build = buildInterviewDraftAction,
    approve = approveInterviewAction,
}: Props) {
    const { theme } = useTheme();
    const s = workspaceStyles(theme === "dark");

    const [state, setState] = useState<InterviewState | null>(initialState);
    const [index, setIndex] = useState(() => (initialState ? resolveStartIndex(initialState.answers) : 0));
    const answerAt = (at: number, from = state) => (at < REVIEW ? from?.answers[QUESTIONS[at].key] ?? NEVER : NEVER);
    const [value, setValue] = useState(() => answerAt(initialState ? resolveStartIndex(initialState.answers) : 0, initialState).answer);
    const [introduction, setIntroduction] = useState(initialState?.draft?.text ?? "");
    const [busy, setBusy] = useState<null | "answer" | "draft" | string>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const inFlight = useRef(false);

    if (!state) {
        return (
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                <div role="alert" className={`${s.errorBox} text-sm`}>{INTERVIEW_LOAD_ERROR}</div>
                <Link href={PROFILE_PATH} className={`${s.secondaryButton} mt-4`}>Enter details by hand</Link>
            </div>
        );
    }

    const draft = state.draft;
    const progress = interviewProgress(state.answers);

    const adopt = (next: InterviewState) => {
        setState(next);
        setIntroduction(next.draft?.text ?? "");
    };

    const goTo = (next: number, from: InterviewState = state) => {
        setIndex(next);
        setValue(answerAt(next, from).answer);
        setError(null);
        setNotice(null);
    };

    /** Runs one server call at a time, and turns a thrown error into a message. */
    const run = async <T extends { ok: boolean }>(what: string, call: () => Promise<T>): Promise<T | null> => {
        if (inFlight.current) return null;
        inFlight.current = true;
        setBusy(what);
        setError(null);
        setNotice(null);
        let result: T | null = null;
        try {
            result = await call();
        } catch {
            setError(INTERVIEW_SAVE_ERROR);
        }
        inFlight.current = false;
        setBusy(null);
        return result;
    };

    const makeDraft = async () => {
        const result = await run("draft", build);
        if (!result) return;
        if (!result.ok) {
            setIndex(REVIEW);
            setError(result.error);
            return;
        }
        adopt(result.state);
        setIndex(REVIEW);
    };

    const submitAnswer = async (skipped: boolean) => {
        const question = QUESTIONS[index];
        const saved = answerAt(index);
        const unchanged = skipped ? saved.skipped && saved.revision > 0 : !saved.skipped && saved.revision > 0 && saved.answer === value.trim() && value.trim() !== "";
        let next = state;

        if (!unchanged) {
            const result = await run("answer", () => save({ key: question.key, answer: skipped ? "" : value, skipped, expectedRevision: saved.revision }));
            if (!result) return;
            if (!result.ok) {
                if ("conflict" in result && result.conflict) {
                    // Another tab saved this question. Show what is saved; nothing of ours was written.
                    next = { ...state, answers: { ...state.answers, [question.key]: result.conflict } };
                    setState(next);
                    setValue(result.conflict.answer);
                }
                setError(result.error);
                return;
            }
            next = { ...state, answers: { ...state.answers, [question.key]: { answer: result.answer, skipped: result.skipped, revision: result.revision } } };
            setState(next);
        }

        if (index + 1 < REVIEW) return goTo(index + 1, next);
        await makeDraft();
    };

    const approveTarget = async (target: "introduction" | OfferedFact["field"], expectedExisting: string | null) => {
        if (!draft) return;
        const result = await run(target, () => approve({ draftId: draft.id, target, text: target === "introduction" ? introduction : null, expectedExisting }));
        if (!result) return;
        if (result.state) adopt(result.state);
        if (!result.ok) return setError(result.error);
        if (result.outcome === "conflict") {
            setNotice("Your profile changed after this was shown, so nothing was saved. The saved value below is up to date. Save again if you still want the change.");
            // Keep the wording they were about to save; only the "saved now" side has moved.
            if (target === "introduction") setIntroduction(introduction);
        } else if (result.outcome === "unavailable") {
            setNotice("That has already been saved or is no longer on offer.");
        }
    };

    const valueBox = `${s.inset} px-3 py-2 text-base break-words whitespace-pre-wrap`;
    const shell = "max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-5";
    const messages = (
        <>
            {error && (
                <div role="alert" className={`${s.errorBox} flex items-start gap-3`}>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden />
                    <p className="min-w-0 text-sm">{error}</p>
                </div>
            )}
            {notice && <p role="status" className={`${s.noticeBox} text-sm`}>{notice}</p>}
        </>
    );
    const footer = (
        <p className={`text-sm ${s.muted}`}>
            Every question is optional and none of this holds up a job.{" "}
            <Link href={PROFILE_PATH} className="font-semibold underline inline-flex items-center min-h-11">Enter details by hand instead</Link>
        </p>
    );

    // ── One question ─────────────────────────────────────────────────────────
    if (index < REVIEW) {
        const question = QUESTIONS[index];
        const saved = answerAt(index);
        const disabled = busy !== null;
        return (
            <div className={shell}>
                <section aria-labelledby="interview-question" className={`${s.card} p-5 sm:p-8`}>
                    <p className={`text-sm font-semibold ${s.muted}`} aria-live="polite">Question {index + 1} of {QUESTIONS.length}</p>
                    <div className="mt-2 flex gap-1.5" aria-hidden>
                        {QUESTIONS.map((entry, at) => (
                            <div key={entry.key} className={`h-1.5 flex-1 rounded-full ${at <= index ? "bg-blue-600" : hasAnswer(state.answers[entry.key]) ? "bg-blue-300" : "bg-slate-300"}`} />
                        ))}
                    </div>

                    <form noValidate onSubmit={(event) => { event.preventDefault(); submitAnswer(false); }} className="mt-6 space-y-4">
                        <div>
                            <label id="interview-question" htmlFor="interview-answer" className={`block text-xl sm:text-2xl font-bold ${s.heading}`}>{question.title}</label>
                            <p id="interview-help" className={`mt-2 text-base ${s.muted}`}>{question.help}</p>
                            {question.kind === "year" ? (
                                <input
                                    id="interview-answer"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={4}
                                    value={value}
                                    onChange={(event) => { setValue(event.target.value); setError(null); }}
                                    placeholder={`e.g. ${question.example}`}
                                    aria-describedby="interview-help"
                                    disabled={disabled}
                                    className={`${s.input} mt-4 max-w-[10rem]`}
                                />
                            ) : (
                                <textarea
                                    id="interview-answer"
                                    rows={4}
                                    maxLength={ANSWER_MAX}
                                    value={value}
                                    onChange={(event) => { setValue(event.target.value); setError(null); }}
                                    placeholder={`e.g. ${question.example}`}
                                    aria-describedby="interview-help"
                                    disabled={disabled}
                                    className={`${s.textarea} mt-4 resize-none`}
                                />
                            )}
                            {saved.skipped && <p className={`mt-2 text-sm ${s.muted}`}>You skipped this one. Answer it now if you like.</p>}
                        </div>

                        {messages}

                        <div className="flex flex-col-reverse sm:flex-row gap-3">
                            {index > 0 && (
                                <button type="button" onClick={() => goTo(index - 1)} disabled={disabled} className={s.secondaryButton}>Back</button>
                            )}
                            <button type="button" onClick={() => submitAnswer(true)} disabled={disabled} className={s.secondaryButton}>Skip</button>
                            <button type="submit" disabled={disabled} className={`${s.primaryButton} flex-1`}>
                                {busy ? (<><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Saving…</>) : error ? "Try again" : "Save and continue"}
                            </button>
                        </div>
                    </form>
                </section>
                {footer}
            </div>
        );
    }

    // ── Review ───────────────────────────────────────────────────────────────
    const used = draft ? answersUsed(draft.basedOn) : [];
    const needsBuilding = !draft || draft.stale;
    const edited = !!draft && introduction.trim() !== draft.text.trim();

    return (
        <div className={shell}>
            <section aria-labelledby="interview-review" className={`${s.card} p-5 sm:p-8 space-y-4`}>
                <div>
                    <h1 id="interview-review" className={`text-2xl sm:text-3xl font-bold ${s.heading}`}>Your introduction</h1>
                    <p className={`mt-2 text-base ${s.muted}`}>
                        {progress.answered} of {progress.total} questions answered. This goes at the top of “About {state.companyName || "your business"}” on your proposals, once you save it.
                    </p>
                </div>

                {needsBuilding ? (
                    <div className="space-y-3">
                        <p className={`${s.noticeBox} text-sm`}>
                            {draft ? "Your answers have changed since this was put together." : "Nothing has been put together yet."}
                        </p>
                        {messages}
                        <button type="button" onClick={() => makeDraft()} disabled={busy !== null} className={`${s.primaryButton} w-full sm:w-auto`}>
                            {busy === "draft" ? (<><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Putting it together…</>) : draft ? "Update it from my latest answers" : "Put my introduction together"}
                        </button>
                    </div>
                ) : draft.status === "approved" ? (
                    <>
                        <p className={`${s.successBox} text-sm flex items-start gap-2`}>
                            <Check className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden />
                            <span>Saved to your profile{draft.approvedEdited ? ", with your own changes to the wording" : ""}.</span>
                        </p>
                        <div>
                            <p className={`text-xs font-semibold ${s.muted}`}>Saved on your profile now</p>
                            <p className={`mt-1 ${valueBox} ${s.body}`}>{draft.savedIntroduction || "Nothing saved"}</p>
                        </div>
                        {messages}
                    </>
                ) : draft.text ? (
                    <>
                        <div>
                            <p className={`text-xs font-semibold ${s.muted}`}>Saved on your profile now</p>
                            <p className={`mt-1 ${valueBox} ${draft.savedIntroduction ? s.body : s.muted}`}>{draft.savedIntroduction || "Nothing saved"}</p>
                        </div>
                        <div>
                            <label htmlFor="interview-introduction" className={s.label}>Put together from your answers</label>
                            <textarea
                                id="interview-introduction"
                                rows={8}
                                maxLength={INTRODUCTION_MAX}
                                value={introduction}
                                onChange={(event) => { setIntroduction(event.target.value); setError(null); }}
                                aria-describedby="interview-introduction-help"
                                disabled={busy !== null}
                                className={`${s.textarea} mt-1.5`}
                            />
                            <p id="interview-introduction-help" className={`mt-2 text-sm ${s.muted}`}>
                                Built by fixed rules from your answers to {used.length === 1 ? "question" : "questions"} {used.map(questionNumber).join(", ")}. Nothing has been added.
                                Read it and change anything you like. {edited ? "You have changed the wording, so it will be saved as your own words." : "If you change the wording, it is saved as your own words."}
                            </p>
                        </div>
                        {messages}
                        <button type="button" onClick={() => approveTarget("introduction", draft.savedIntroduction)} disabled={busy !== null} className={`${s.primaryButton} w-full sm:w-auto`}>
                            {busy === "introduction" ? (<><Loader2 className="w-5 h-5 animate-spin" aria-hidden /> Saving…</>)
                                : error ? "Try again"
                                : draft.savedIntroduction ? "Replace my introduction with this" : "Save as my introduction"}
                        </button>
                    </>
                ) : (
                    <>
                        <p className={`${s.noticeBox} text-sm`}>There isn&apos;t enough yet for an introduction. Answer one of the first six questions and we&apos;ll put one together.</p>
                        {messages}
                    </>
                )}
            </section>

            {draft && !draft.stale && draft.facts.length > 0 && (
                <section aria-labelledby="interview-facts" className={`${s.card} p-5 sm:p-8`}>
                    <h2 id="interview-facts" className={`text-lg font-bold ${s.heading}`}>Details you gave us</h2>
                    <p className={`mt-1 text-sm ${s.muted}`}>These are your own words, used exactly. Save only the ones you want on your proposals. Each is saved on its own.</p>
                    <ul className="mt-4 space-y-3">
                        {draft.facts.map((fact) => (
                            <li key={fact.field} data-interview-fact={fact.field} data-status={fact.status} className={`${s.inset} p-4 space-y-3`}>
                                <h3 className={`text-base font-semibold ${s.heading}`}>{FACT_LABELS[fact.field]}</h3>
                                <dl className="grid gap-3 sm:grid-cols-2">
                                    <div className="min-w-0">
                                        <dt className={`text-xs font-semibold ${s.muted}`}>Saved now</dt>
                                        <dd className={`mt-1 ${valueBox} ${fact.existing ? s.body : s.muted}`}>{fact.existing || "Nothing saved"}</dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className={`text-xs font-semibold ${s.muted}`}>From your answer to question {questionNumber(fact.questionKey)}</dt>
                                        <dd className={`mt-1 ${valueBox} ${s.body}`}>{fact.proposed}</dd>
                                    </div>
                                </dl>
                                {fact.status === "applied" && (
                                    <p className={`${s.successBox} text-sm flex items-center gap-2`}><Check className="w-4 h-4 flex-shrink-0" aria-hidden /> Saved to your profile.</p>
                                )}
                                {fact.status === "same" && <p className={`text-sm font-semibold ${s.muted}`}>Already matches your profile. Nothing to change.</p>}
                                {fact.status === "pending" && (
                                    <button
                                        type="button"
                                        onClick={() => approveTarget(fact.field, fact.existing)}
                                        disabled={busy !== null}
                                        aria-label={`${fact.existing ? "Replace" : "Save"} ${FACT_LABELS[fact.field].toLowerCase()} on my profile`}
                                        className={`${s.secondaryButton} min-h-11 text-sm`}
                                    >
                                        {busy === fact.field ? "Saving…" : fact.existing ? "Replace what's saved with this" : "Save this to my profile"}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => goTo(0)} disabled={busy !== null} className={s.secondaryButton}>Change my answers</button>
                <Link href={PROPOSAL_READINESS_PATH} className={s.secondaryButton}>See what your proposals can use so far</Link>
            </div>
            {footer}
        </div>
    );
}
