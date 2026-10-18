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
    const router = useRouter();
    const supabase = createClient();

    const switchMode = (next: Mode) => {
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

        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${location.origin}/auth/callback`,
            },
        });

        if (error) {
            setErrorMessage(error.message);
            setLoading(false);
            return;
        }

        setSuccessMessage("Account created. Check your email for the confirmation link — once confirmed, sign in to get started.");
        setLoading(false);
    };

    const isSignUp = mode === "signup";

    return (
        <FirstSessionFrame>
            <FirstSessionPanel step={0}>
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
