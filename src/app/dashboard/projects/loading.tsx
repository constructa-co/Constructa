import { Loader2 } from "lucide-react";

/**
 * Projects sub-route loading state. Covers every /dashboard/projects/* tab
 * while its server component streams. Sprint 58 Phase 1.
 */
export default function ProjectsLoading() {
    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-slate-500">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
                <p className="text-xs font-medium uppercase tracking-widest">Loading project…</p>
            </div>
        </div>
    );
}
