/**
 * P2-2 — Home dashboard loading skeleton.
 *
 * Next.js App Router streams this immediately while `page.tsx` awaits
 * the 10 parallel Supabase queries. Without it, the user sees a blank
 * page for 500–1500 ms on every navigation to Home — Antigravity
 * flagged this as a perceived freeze.
 *
 * A full Suspense-per-panel refactor of HomeClient (which currently
 * needs all 10 queries to compute KPIs + alert banners) is a larger
 * job deferred to a future sprint. This delivers ~80% of the
 * perceived-performance benefit with ~1% of the risk.
 */
export default function HomeLoading() {
    return (
        <div className="min-h-screen bg-[#0a0a0a] p-6">
            <div className="max-w-7xl mx-auto space-y-5 animate-pulse">
                {/* Header skeleton */}
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-7 w-64 bg-slate-800/60 rounded" />
                        <div className="h-4 w-40 bg-slate-800/40 rounded" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-10 w-32 bg-slate-800/60 rounded-lg" />
                        <div className="h-10 w-32 bg-slate-800/60 rounded-lg" />
                    </div>
                </div>

                {/* KPI strip skeleton — 8 cards in 2 rows × 4 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div
                            key={i}
                            className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3"
                        >
                            <div className="h-3 w-20 bg-slate-800/60 rounded" />
                            <div className="h-8 w-24 bg-slate-800/80 rounded" />
                            <div className="h-3 w-28 bg-slate-800/40 rounded" />
                        </div>
                    ))}
                </div>

                {/* Active projects + Pipeline preview side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                        <div className="h-5 w-40 bg-slate-800/60 rounded" />
                        <div className="h-20 w-full bg-slate-800/30 rounded-lg" />
                        <div className="h-20 w-full bg-slate-800/30 rounded-lg" />
                    </div>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
                        <div className="h-5 w-36 bg-slate-800/60 rounded" />
                        <div className="h-4 w-full bg-slate-800/40 rounded" />
                        <div className="h-4 w-5/6 bg-slate-800/40 rounded" />
                        <div className="h-4 w-full bg-slate-800/40 rounded" />
                    </div>
                </div>

                <p className="text-center text-xs text-slate-600 pt-4">
                    Loading your dashboard…
                </p>
            </div>
        </div>
    );
}
