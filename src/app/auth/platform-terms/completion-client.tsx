"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FirstSessionFrame, FirstSessionPanel } from "@/components/first-session-frame";
import ui from "@/components/first-session.module.css";
import { getLaunchLandingPath } from "@/lib/launch-profile";
import { completePlatformTermsAcceptanceAction } from "@/lib/platform-terms-completion-action";
import { PLATFORM_TERMS_COMPLETION_MESSAGES, PLATFORM_TERMS_COMPLETION_SIGN_IN } from "@/lib/platform-terms-completion";

type Feedback = Exclude<keyof typeof PLATFORM_TERMS_COMPLETION_MESSAGES, "recorded" | "already-recorded">;

/**
 * Explicit platform terms acceptance for a signed-in user. The box starts
 * unchecked and nothing is recorded until it is ticked and submitted. The
 * page moves on only after the server acknowledges the record; a failure
 * keeps the box as it was and is never retried automatically.
 */
export default function PlatformTermsCompletion({ revision }: { revision: string }) {
    const [accepted, setAccepted] = useState(false);
    const [pending, setPending] = useState(false);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [recorded, setRecorded] = useState<"recorded" | "already-recorded" | null>(null);
    // Set synchronously, so the same submit called again before the pending rerender cannot record twice.
    const inFlight = useRef(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (pending || inFlight.current) return;
        setFeedback(null);
        if (!accepted) {
            setFeedback("refused");
            return;
        }
        inFlight.current = true;
        setPending(true);
        try {
            const result = await completePlatformTermsAcceptanceAction({ acceptance: accepted, revision });
            if (result.ok) setRecorded(result.outcome);
            else setFeedback(result.code);
        } catch {
            // The request itself failed; whether anything was stored is unknown.
            setFeedback("unconfirmed");
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    };

    const refused = feedback === "refused" && !accepted;

    return (
        <FirstSessionFrame signOut>
            <FirstSessionPanel>
                <p className={ui.eyebrow}>One more step</p>
                <h1 className={ui.heading}>{recorded ? "You're all set." : "Accept the platform terms."}</h1>
                {recorded ? (
                    <div>
                        <p className={ui.success} role="status">{PLATFORM_TERMS_COMPLETION_MESSAGES[recorded]}</p>
                        <Link href={getLaunchLandingPath()} className={ui.primary}>
                            Continue<ArrowRight size={18} aria-hidden="true" />
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className={ui.lede}>Read Constructa&apos;s platform terms of service, then confirm that you accept them. Nothing is recorded until you do.</p>
                        <form onSubmit={submit} aria-busy={pending}>
                            <div className={ui.field}>
                                <label htmlFor="platform-terms-completion" className={`${ui.label} flex min-h-11 items-start gap-3`}>
                                    <input
                                        id="platform-terms-completion"
                                        type="checkbox"
                                        required
                                        checked={accepted}
                                        onChange={(e) => setAccepted(e.target.checked)}
                                        disabled={pending}
                                        aria-describedby={refused ? "platform-terms-completion-error platform-terms-completion-link" : "platform-terms-completion-link"}
                                        aria-invalid={refused || undefined}
                                        className="mt-1 h-4 w-4 shrink-0"
                                    />
                                    <span>I accept Constructa&apos;s platform terms of service.</span>
                                </label>
                                <Link id="platform-terms-completion-link" href="/terms-of-service" target="_blank" rel="noopener noreferrer" className={ui.textButton}>
                                    Read the full platform terms (opens in a new tab)
                                </Link>
                            </div>

                            {feedback && (
                                <div id="platform-terms-completion-error" role="alert" className={ui.error}>
                                    {PLATFORM_TERMS_COMPLETION_MESSAGES[feedback]}
                                    {feedback === "unauthenticated" && (
                                        <> <Link href={PLATFORM_TERMS_COMPLETION_SIGN_IN} className={ui.textButton}>Sign in</Link></>
                                    )}
                                </div>
                            )}

                            <button type="submit" disabled={pending} className={`${ui.primary} ${ui.block}`}>
                                {pending ? "Recording..." : "Accept platform terms"}
                                <ArrowRight size={18} aria-hidden="true" />
                            </button>
                        </form>
                    </>
                )}
            </FirstSessionPanel>
        </FirstSessionFrame>
    );
}
