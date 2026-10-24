'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getLaunchLandingPath } from '@/lib/launch-profile';
import { ArrowRight } from 'lucide-react';
import { FirstSessionFrame, FirstSessionPanel } from '@/components/first-session-frame';
import AccountConfirmation from '@/components/account-confirmation';
import ui from '@/components/first-session.module.css';
import { platformSignupAction, type PlatformSignupErrorCode } from '@/lib/platform-signup-action';
import { PLATFORM_TERMS_CURRENT_REVISION } from '@/lib/platform-terms';

// A023 (Rob 15:05) — signup now runs through the server action seam
// (platform-signup-action): the server verifies explicit terms acceptance
// and the trusted technical revision before any account call, creates the
// account with the cookie-bound server client, and records consent only
// when a server session exists. While signup stays OFF the action's
// hard-coded gate answers signup-disabled and the page says so truthfully.
// Typed failures are shown as fixed copy — no raw provider/transport data.
const SIGNUP_ERROR_MESSAGES: Record<PlatformSignupErrorCode, string> = {
    "signup-disabled": "Sign-up is currently disabled.",
    "invalid-input": "Please check your email address and password and try again.",
    "terms-refused": "Please accept the platform terms of service before creating an account.",
    "unrecognized-revision": "The platform terms have been updated. Please review them and try again.",
    "signup-failed": "We couldn't create your account. Please try again.",
    "consent-not-stored": "Your account was created, but we couldn't record your terms acceptance. Please sign in to complete it.",
};

// P2-3 — sign-up UX overhaul.
// Previously "Sign up" was a button below the sign-in form that
// fired auth.signUp with whatever was in the email/password inputs
// and folded the success message into the error state — so the
// "Check your email for the confirmation link" message rendered
// inside a red error banner, which broke user trust on their very
// first interaction with the product. Now: explicit mode toggle,
// confirm-password + strength hint on sign-up, and separate
// green success / red error banners.

type Mode = "signin" | "signup";

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>("signin");
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const switchMode = (next: Mode) => {
        if (next !== mode) setTermsAccepted(false);
        setMode(next);
        setErrorMessage(null);
        setSuccessMessage(null);
        setConfirmPassword("");
    };

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage(null);
        setSuccessMessage(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMessage(error.message);
            setLoading(false);
            return;
        }

        router.push(getLaunchLandingPath());
        router.refresh();
        setLoading(false);
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        setSuccessMessage(null);

        // Client-side validation
        if (password.length < 8) {
            setErrorMessage("Password must be at least 8 characters.");
            return;
        }
        if (password !== confirmPassword) {
            setErrorMessage("Passwords don't match.");
            return;
        }
        if (!termsAccepted) {
            setErrorMessage("Please accept the platform terms of service before creating an account.");
            return;
        }

        setLoading(true);
        const result = await platformSignupAction({
            email,
            password,
            acceptance: termsAccepted,
            revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        setLoading(false);

        if (!result.ok) {
            setErrorMessage(SIGNUP_ERROR_MESSAGES[result.code]);
            return;
        }

        setSuccessMessage(result.outcome === "confirmation-required"
            ? "Account created. Check your email for the confirmation link — once confirmed, sign in to get started."
            : "Account created and your acceptance of the platform terms is recorded. Sign in to get started.");
    };

    const isSignUp = mode === "signup";

    return (
        <FirstSessionFrame>
            <FirstSessionPanel step={isSignUp ? 0 : undefined}>
                <p className={ui.eyebrow}>{isSignUp ? "Your next chapter starts here" : "Good to see you again"}</p>
                <h1 className={ui.heading}>
                    {successMessage ? "Check your inbox." : isSignUp ? <>Get started.<br />Make it yours.</> : <>Welcome back.<br />Let&apos;s get to work.</>}
                </h1>
                <p className={ui.lede}>
                    {successMessage ? "Confirm your email, then sign in to get started." : isSignUp ? "A few simple steps. Then shape your company profile and your first job." : "Pick up where you left off."}
                </p>

                {successMessage ? (
                    <AccountConfirmation message={successMessage} onSignIn={() => switchMode("signin")} />
                ) : (
                    <>
                    <div className={ui.modeToggle} role="group" aria-label="Account mode">
                        <button type="button" disabled={loading} aria-pressed={isSignUp} onClick={() => switchMode("signup")}>Get started</button>
                        <button type="button" disabled={loading} aria-pressed={!isSignUp} onClick={() => switchMode("signin")}>Sign in</button>
                    </div>
                    <form onSubmit={isSignUp ? handleSignUp : handleSignIn} aria-busy={loading}>
                        <div className={ui.field}>
                            <label htmlFor="email" className={ui.label}>Email address</label>
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                className={ui.input}
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className={ui.field}>
                            <div className={ui.fieldHeading}>
                                <label htmlFor="password" className={ui.label}>Password</label>
                                {!isSignUp && (
                                    <Link
                                        href="/auth/forgot-password"
                                        className={ui.textButton}
                                    >
                                        Forgot password?
                                    </Link>
                                )}
                            </div>
                            <input
                                id="password"
                                type="password"
                                required
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                aria-describedby={isSignUp ? "password-help" : undefined}
                                className={ui.input}
                                placeholder="••••••••"
                            />
                            {isSignUp && (
                                <p id="password-help" className={ui.help}>At least 8 characters.</p>
                            )}
                        </div>

                        {isSignUp && (
                            <div className={ui.field}>
                                <label htmlFor="confirm" className={ui.label}>Confirm password</label>
                                <input
                                    id="confirm"
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    disabled={loading}
                                    className={ui.input}
                                    placeholder="••••••••"
                                />
                            </div>
                        )}

                        {isSignUp && (
                            <div className={ui.field}>
                                <label htmlFor="platform-terms" className={`${ui.label} flex min-h-11 items-start gap-3`}>
                                    <input
                                        id="platform-terms"
                                        type="checkbox"
                                        required
                                        checked={termsAccepted}
                                        onChange={(e) => setTermsAccepted(e.target.checked)}
                                        disabled={loading}
                                        className="mt-1 h-4 w-4 shrink-0"
                                    />
                                    <span>I accept Constructa&apos;s platform terms of service.</span>
                                </label>
                                <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer" className={ui.textButton}>
                                    Read the full platform terms (opens in a new tab)
                                </Link>
                            </div>
                        )}

                        {errorMessage && (
                            <div role="alert" className={ui.error}>
                                {errorMessage}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`${ui.primary} ${ui.block}`}
                        >
                            {loading
                                ? 'Processing...'
                                : isSignUp
                                    ? 'Create account'
                                    : 'Sign in'}
                            <ArrowRight size={18} aria-hidden="true" />
                        </button>

                        <div className={ui.footnote}>
                            {isSignUp ? (
                                <>
                                    <span className="text-gray-400">Already have an account? </span>
                                    <button type="button" disabled={loading} onClick={() => switchMode("signin")} className={`${ui.textButton} ml-2`}>
                                        Sign in
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="text-gray-400">Don&apos;t have an account? </span>
                                    <button type="button" disabled={loading} onClick={() => switchMode("signup")} className={`${ui.textButton} ml-2`}>
                                        Get started
                                    </button>
                                </>
                            )}
                        </div>
                    </form>
                    </>
                )}
            </FirstSessionPanel>
        </FirstSessionFrame>
    );
}
