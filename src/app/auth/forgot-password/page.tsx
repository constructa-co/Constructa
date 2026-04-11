'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

/**
 * Sprint 58 Phase 2 item #12 — Forgot Password flow.
 *
 * Perplexity audit P2 gap #16: "No link on login page for password
 * recovery". The supabase recovery plumbing has been in place for a
 * while (/auth/reset-password handles the hash-fragment recovery
 * token and lets the user set a new password) — what was missing was
 * the entry point where the user actually requests the email.
 *
 * This page just collects the email address and calls Supabase's
 * built-in resetPasswordForEmail() with a redirect to the existing
 * reset-password page.
 */
export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
                email.trim(),
                {
                    redirectTo: `${window.location.origin}/auth/reset-password`,
                },
            );
            if (resetErr) {
                setError(resetErr.message);
                setLoading(false);
                return;
            }
            // Always show the generic confirmation — don't leak whether
            // the email exists in the system. Standard security practice.
            setSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <Link href="/" className="text-3xl font-bold tracking-tight">
                        CONSTRUCTA
                    </Link>
                    <h2 className="mt-6 text-xl font-medium text-gray-400">
                        Reset your password
                    </h2>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 backdrop-blur-sm">
                    {sent ? (
                        <div className="space-y-4 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
                                <span className="text-2xl">✓</span>
                            </div>
                            <h3 className="text-base font-semibold text-white">
                                Check your email
                            </h3>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                If an account exists for <strong className="text-gray-200">{email}</strong>,
                                you&apos;ll receive a password reset link in the next few minutes.
                            </p>
                            <p className="text-xs text-gray-500">
                                The link is valid for 1 hour. If it expires you can request a new one
                                from this page.
                            </p>
                            <Link
                                href="/login"
                                className="inline-block text-sm text-white hover:underline mt-4"
                            >
                                ← Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Enter your account email and we&apos;ll send you a link to reset your
                                password.
                            </p>

                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-400">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="mt-2 w-full px-4 py-2 bg-black border border-zinc-800 rounded-lg focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all text-white"
                                    placeholder="you@example.com"
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg text-red-200 text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg text-sm font-medium text-black bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? 'Sending link…' : 'Send reset link'}
                            </button>

                            <div className="text-center text-sm">
                                <Link href="/login" className="text-gray-500 hover:text-white">
                                    ← Back to sign in
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
