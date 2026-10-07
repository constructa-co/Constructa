/**
 * Shared class names for the contractor's guided screens (Brief, simple
 * Estimating). Both themes are covered, text inputs are 16px so phones do not
 * zoom, and every control is at least 44px tall.
 */
export function workspaceStyles(isDark: boolean) {
    const inputBase = `w-full rounded-lg border px-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        isDark
            ? "bg-[#0d0d0d] border-[#3a3a3a] text-white placeholder:text-slate-500 [color-scheme:dark]"
            : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
    }`;
    const button = "min-h-12 px-5 rounded-xl text-base font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

    return {
        heading: isDark ? "text-white" : "text-gray-900",
        body: isDark ? "text-slate-200" : "text-gray-800",
        muted: isDark ? "text-slate-400" : "text-gray-600",
        card: `rounded-2xl border ${isDark ? "bg-[#1a1a1a] border-[#2a2a2a]" : "bg-white border-gray-200 shadow-sm"}`,
        inset: `rounded-xl border ${isDark ? "bg-[#0d0d0d] border-[#2a2a2a]" : "bg-gray-50 border-gray-200"}`,
        divider: isDark ? "border-[#2a2a2a]" : "border-gray-200",
        label: `block text-sm font-semibold ${isDark ? "text-slate-200" : "text-gray-800"}`,
        input: `${inputBase} h-12`,
        textarea: `${inputBase} py-2.5`,
        primaryButton: `${button} bg-blue-600 hover:bg-blue-700 text-white`,
        secondaryButton: `${button} border ${
            isDark ? "border-[#3a3a3a] text-slate-100 hover:bg-white/5" : "border-gray-300 text-gray-900 hover:bg-gray-50"
        }`,
        quietButton: `min-h-11 px-3 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
            isDark ? "text-blue-300 hover:bg-white/5" : "text-blue-700 hover:bg-blue-50"
        }`,
        errorText: isDark ? "text-red-300" : "text-red-700",
        errorBox: `rounded-xl border px-4 py-3 ${
            isDark ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-red-200 bg-red-50 text-red-800"
        }`,
        noticeBox: `rounded-xl border px-4 py-3 ${
            isDark ? "border-amber-500/40 bg-amber-500/10 text-amber-100" : "border-amber-300 bg-amber-50 text-amber-900"
        }`,
        successBox: `rounded-xl border px-4 py-3 ${
            isDark ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100" : "border-emerald-300 bg-emerald-50 text-emerald-900"
        }`,
        suggestionBox: `rounded-2xl border-2 border-dashed ${
            isDark ? "border-violet-400/60 bg-violet-500/10" : "border-violet-400 bg-violet-50"
        }`,
    };
}

export type WorkspaceStyles = ReturnType<typeof workspaceStyles>;
