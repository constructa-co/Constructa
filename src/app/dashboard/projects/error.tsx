"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, LayoutDashboard } from "lucide-react";

/**
 * Projects sub-route error boundary.
 *
 * Scoped to /dashboard/projects/* so an error on a single project tab
 * (brief, costs, schedule, proposal, billing, p-and-l, variations, etc.)
 * can be recovered without crashing the surrounding dashboard shell.
 *
 * Sprint 58 Phase 1 — the 1,700-line log-cost-sheet and 1,935-line proposal
 * PDF builder are the most likely candidates to throw; this boundary is
 * their safety net.
 */
export default function ProjectsError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[ProjectsError]", error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-8">
            <div className="max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-100">This project page couldn&apos;t load</h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Your data is safe. We just couldn&apos;t render this view.
                        </p>
                    </div>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">
                    Common causes: a transient Supabase connection issue, stale data between tabs, or a
                    field that expected a value and didn&apos;t receive one. Try again — if it persists, head
                    to the project pipeline and re-open the project from there.
                </p>

                {error.digest && (
                    <p className="text-[10px] font-mono text-slate-600 bg-slate-950/50 border border-slate-800 rounded px-2 py-1">
                        ref: {error.digest}
                    </p>
                )}

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try again
                    </button>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                    >
                        <LayoutDashboard className="w-4 h-4" />
                        Pipeline
                    </Link>
                    <Link
                        href="/dashboard/home"
                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                    >
                        <Home className="w-4 h-4" />
                        Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
