"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { reportError } from "@/lib/observability";

/**
 * Dashboard route-group error boundary.
 *
 * Catches any unhandled error thrown by a server or client component inside
 * /dashboard/* and renders a recoverable UI instead of a blank white screen.
 * Sprint 58 Phase 1 — one of the most visible UX wins in the audit, since a
 * single Supabase hiccup previously crashed the entire dashboard layout.
 *
 * NOTE: Next.js error boundaries MUST be client components.
 */
export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Sprint 58 P1.9 — forward to observability wrapper. Logs to console
        // locally (Vercel logs pick it up) and forwards to Sentry if
        // SENTRY_DSN is configured.
        reportError(error, {
            source: "dashboard-error-boundary",
            digest: error.digest,
        });
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-100">Something went wrong</h1>
                        <p className="text-xs text-slate-500 mt-0.5">We hit an error loading this page.</p>
                    </div>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">
                    Try reloading the page. If the problem persists, head back to the dashboard home and
                    come at it again — no data has been lost.
                </p>

                {error.digest && (
                    <p className="text-[10px] font-mono text-slate-600 bg-slate-950/50 border border-slate-800 rounded px-2 py-1">
                        ref: {error.digest}
                    </p>
                )}

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try again
                    </button>
                    <Link
                        href="/dashboard/home"
                        className="flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
