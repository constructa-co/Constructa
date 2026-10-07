"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import {
    SETUP_LIMITS,
    SETUP_SAVE_FALLBACK_ERROR,
    SETUP_STEPS,
    SETUP_WORK_SUGGESTIONS,
    buildSetupPatch,
    hasWorkSuggestion,
    resolveSetupSaveOutcome,
    saveStateFromOutcome,
    toggleWorkSuggestion,
    type SetupSaveState,
    type SetupStep,
    type SetupStepInput,
} from "@/lib/first-session";
import { saveSetupStepAction } from "./actions";

interface Props {
    initialStep: SetupStep;
    initialBusinessType: string;
    initialCompanyName: string;
    initialFullName: string;
    /** Where the contractor lands once setup is finished. */
    completionPath: string;
    /** Set for contractors who are already set up and came back to change an answer. */
    exitPath: string | null;
    /** Defaults to the real server action; replaced only by tests and evidence capture. */
    saveStep?: (input: SetupStepInput) => Promise<unknown>;
}

const inputCls =
    "w-full h-12 px-3 rounded-lg border border-slate-600 bg-slate-900 text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function OnboardingClient({
    initialStep,
    initialBusinessType,
    initialCompanyName,
    initialFullName,
    completionPath,
    exitPath,
    saveStep = saveSetupStepAction,
}: Props) {
    const router = useRouter();
    const [step, setStep] = useState<SetupStep>(initialStep);
    const [saveState, setSaveState] = useState<SetupSaveState>({ status: "idle" });
    // Guards against double submission beyond the disabled button (fast
    // double-taps can fire before React re-renders the disabled state).
    const inFlightRef = useRef(false);

    const [businessType, setBusinessType] = useState(initialBusinessType.trim());
    const [tradeSaved, setTradeSaved] = useState(!!initialBusinessType.trim());

    const [companyName, setCompanyName] = useState(initialCompanyName);
    const [fullName, setFullName] = useState(initialFullName);

    const saving = saveState.status === "saving";
    const stepNumber = SETUP_STEPS.indexOf(step) + 1;

    const submit = async (input: SetupStepInput) => {
        if (inFlightRef.current) return;

        // Same check the server runs, so an empty answer never needs a round trip.
        const checked = buildSetupPatch(input);
        if (!checked.ok) {
            setSaveState({ status: "failed", error: checked.error });
            return;
        }

        inFlightRef.current = true;
        setSaveState({ status: "saving" });

        let result: unknown;
        try {
            // The final step redirects on the server when it succeeds, so
            // this await normally never resolves and the router navigates.
            result = await saveStep(input);
        } catch {
            result = { error: SETUP_SAVE_FALLBACK_ERROR };
        }

        const outcome = resolveSetupSaveOutcome(result);
        if (!outcome.ok) {
            setSaveState(saveStateFromOutcome(outcome));
            inFlightRef.current = false;
            return;
        }

        if (input.step === "trade") {
            setTradeSaved(true);
            setSaveState({ status: "saved" });
            setStep("business");
            inFlightRef.current = false;
            return;
        }

        // Finished. Stay in the saving state while the page changes. Push as
        // a fallback in case the server-side redirect was not followed, with
        // a hard navigation as the last resort.
        router.refresh();
        router.push(completionPath);
        window.setTimeout(() => {
            if (window.location.pathname.startsWith("/onboarding")) {
                window.location.assign(completionPath);
            }
        }, 5000);
    };

    const submitCurrent = () =>
        submit(step === "trade" ? { step, businessType } : { step, companyName, fullName });

    // Changing an answer clears a stale failure message.
    const clearFailure = () => {
        if (saveState.status === "failed") setSaveState({ status: "idle" });
    };

    const toggleSuggestion = (suggestion: string) => {
        setBusinessType((answer) => toggleWorkSuggestion(answer, suggestion));
        clearFailure();
    };

    const goBackToTrade = () => {
        if (saving) return;
        setSaveState({ status: "idle" });
        setStep("trade");
    };

    return (
        <div className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <p className="text-sm font-semibold text-blue-400" aria-live="polite">
                Step {stepNumber} of {SETUP_STEPS.length}
            </p>
            <div className="mt-2 flex gap-2" aria-hidden>
                {SETUP_STEPS.map((key, i) => (
                    <div key={key} className={`h-1.5 flex-1 rounded-full ${i < stepNumber ? "bg-blue-500" : "bg-slate-700"}`} />
                ))}
            </div>

            <form
                noValidate
                onSubmit={(e) => { e.preventDefault(); submitCurrent(); }}
                className="mt-8"
            >
                {step === "trade" && (
                    <fieldset disabled={saving} className="min-w-0">
                        <legend className="text-2xl sm:text-3xl font-bold text-white">
                            <label htmlFor="setup-work">What kind of work does your business do?</label>
                        </legend>
                        <p id="setup-work-help" className="mt-2 text-base text-slate-400">
                            Say it in your own words, as you would to a customer. You can change it later.
                        </p>

                        <textarea
                            id="setup-work"
                            value={businessType}
                            onChange={(e) => { setBusinessType(e.target.value); clearFailure(); }}
                            placeholder="e.g. Kitchen and bathroom fitting, tiling and small extensions"
                            maxLength={SETUP_LIMITS.businessType}
                            rows={3}
                            autoComplete="off"
                            aria-describedby="setup-work-help"
                            className={`${inputCls} mt-5 h-auto py-2.5 resize-none`}
                        />

                        <p id="setup-work-suggestions" className="mt-5 text-sm font-semibold text-slate-200">
                            Or tap any that fit <span className="font-normal text-slate-400">(optional)</span>
                        </p>
                        <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-labelledby="setup-work-suggestions">
                            {SETUP_WORK_SUGGESTIONS.map((suggestion) => {
                                const selected = hasWorkSuggestion(businessType, suggestion);
                                return (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        aria-pressed={selected}
                                        onClick={() => toggleSuggestion(suggestion)}
                                        className={`min-h-11 px-3.5 rounded-full border text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${
                                            selected
                                                ? "border-blue-500 bg-blue-600/20 text-white"
                                                : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
                                        }`}
                                    >
                                        {selected && <Check className="w-4 h-4 flex-shrink-0 text-blue-400" />}
                                        {suggestion}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                )}

                {step === "business" && (
                    <fieldset disabled={saving} className="min-w-0">
                        <legend className="text-2xl sm:text-3xl font-bold text-white">What&apos;s your business called?</legend>
                        <p className="mt-2 text-base text-slate-400">
                            Clients see this name on your proposals. You can change it later from Profile.
                        </p>

                        {tradeSaved && businessType && (
                            <p className="mt-4 flex items-start gap-2 text-sm text-emerald-400">
                                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <span className="min-w-0 break-words">Saved: {businessType}</span>
                            </p>
                        )}

                        <div className="mt-6 space-y-5">
                            <div>
                                <label htmlFor="setup-company-name" className="block text-sm font-semibold text-slate-200">Business or trading name</label>
                                <input
                                    id="setup-company-name"
                                    value={companyName}
                                    onChange={(e) => { setCompanyName(e.target.value); clearFailure(); }}
                                    placeholder="e.g. Smith Plumbing"
                                    maxLength={SETUP_LIMITS.companyName}
                                    autoComplete="organization"
                                    className={`${inputCls} mt-1.5`}
                                />
                            </div>
                            <div>
                                <label htmlFor="setup-full-name" className="block text-sm font-semibold text-slate-200">
                                    Your name <span className="font-normal text-slate-400">(optional)</span>
                                </label>
                                <input
                                    id="setup-full-name"
                                    value={fullName}
                                    onChange={(e) => { setFullName(e.target.value); clearFailure(); }}
                                    placeholder="e.g. Sam Smith"
                                    maxLength={SETUP_LIMITS.fullName}
                                    autoComplete="name"
                                    className={`${inputCls} mt-1.5`}
                                />
                            </div>
                        </div>
                    </fieldset>
                )}

                {/* Pinned to the bottom of a phone screen so the action and any
                    failure message stay in view under the suggestions. */}
                <div className="sticky bottom-0 z-10 -mx-4 px-4 mt-6 pt-3 pb-4 bg-[#0d0d0d] border-t border-white/10 sm:static sm:mx-0 sm:px-0 sm:pt-0 sm:pb-0 sm:border-0">
                {saveState.status === "failed" && (
                    <div role="alert" className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 flex items-start gap-3 text-red-200">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <p className="min-w-0 text-sm">{saveState.error}</p>
                    </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row gap-3">
                    {step === "business" && (
                        <button
                            type="button"
                            onClick={goBackToTrade}
                            disabled={saving}
                            className="min-h-12 px-5 rounded-xl border border-slate-600 text-base font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50 transition-colors"
                        >
                            Back
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 min-h-12 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white text-base font-bold transition-colors flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Saving…
                            </>
                        ) : saveState.status === "failed" ? (
                            "Try again"
                        ) : step === "trade" || !exitPath ? (
                            "Save and continue"
                        ) : (
                            "Save"
                        )}
                    </button>
                </div>
                </div>
            </form>

            <p className="mt-6 sm:mt-8 text-sm text-slate-400">
                That&apos;s all we need to get you started. Your logo, company story, case studies and other details are optional, and you can add them whenever you like.
            </p>

            {exitPath && (
                <p className="mt-4">
                    <Link href={exitPath} className="inline-flex items-center min-h-11 text-sm font-semibold text-blue-400 hover:text-blue-300">
                        Back to your dashboard
                    </Link>
                </p>
            )}
        </div>
    );
}
