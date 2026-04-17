'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

        router.push('/dashboard/home');
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
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <Link href="/" className="text-3xl font-bold tracking-tight">CONSTRUCTA</Link>
                    <h2 className="mt-6 text-xl font-medium text-gray-400">
                        {isSignUp ? "Create your account" : "Sign in to your account"}
                    </h2>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 backdrop-blur-sm">
                    <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-400">Email address</label>
                            <input
                                id="email"
                                type="email"
                                required
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-2 w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all text-white"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label htmlFor="password" className="block text-sm font-medium text-gray-400">Password</label>
                                {!isSignUp && (
                                    <Link
                                        href="/auth/forgot-password"
                                        className="text-xs text-gray-500 hover:text-white transition-colors"
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
                                className="mt-2 w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all text-white"
                                placeholder="••••••••"
                            />
                            {isSignUp && (
                                <p className="mt-1.5 text-xs text-gray-500">At least 8 characters.</p>
                            )}
                        </div>

                        {isSignUp && (
                            <div>
                                <label htmlFor="confirm" className="block text-sm font-medium text-gray-400">Confirm password</label>
                                <input
                                    id="confirm"
                                    type="password"
                                    required
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="mt-2 w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all text-white"
                                    placeholder="••••••••"
                                />
                            </div>
                        )}

                        {errorMessage && (
                            <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm">
                                {errorMessage}
                            </div>
                        )}

                        {successMessage && (
                            <div className="p-3 bg-emerald-900/20 border border-emerald-900/50 rounded-lg text-emerald-200 text-sm">
                                {successMessage}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading
                                ? 'Processing...'
                                : isSignUp
                                    ? 'Create account'
                                    : 'Sign in'}
                        </button>

                        <div className="text-center text-sm">
                            {isSignUp ? (
                                <>
                                    <span className="text-gray-500">Already have an account? </span>
                                    <button type="button" onClick={() => switchMode("signin")} className="text-white hover:underline">
                                        Sign in
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span className="text-gray-500">Don&apos;t have an account? </span>
                                    <button type="button" onClick={() => switchMode("signup")} className="text-white hover:underline">
                                        Sign up
                                    </button>
                                </>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
