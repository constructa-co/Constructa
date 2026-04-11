import { Loader2 } from "lucide-react";

/**
 * Dashboard route-group loading state.
 * Shown automatically by Next.js App Router while server components above
 * this level are streaming. Sprint 58 Phase 1 — replaces the previous
 * blank-screen behaviour on slow or failing Supabase queries.
 */
export default function DashboardLoading() {
    return (
        <div className="min-h-[50vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-xs font-medium uppercase tracking-widest">Loading…</p>
            </div>
        </div>
    );
}
