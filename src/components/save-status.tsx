"use client";

import { AlertTriangle, Check, CircleDot, Loader2 } from "lucide-react";

export type SaveStatusKind = "empty" | "unsaved" | "saving" | "saved" | "failed";

/**
 * One save indicator for the guided screens. The text is always shown, so the
 * state never depends on colour alone, and changes are announced politely.
 */
export default function SaveStatus({ status, label, isDark }: { status: SaveStatusKind; label: string; isDark: boolean }) {
    const tone: Record<SaveStatusKind, string> = {
        empty: isDark ? "border-[#3a3a3a] text-slate-400" : "border-gray-300 text-gray-600",
        unsaved: isDark ? "border-amber-500/50 text-amber-200 bg-amber-500/10" : "border-amber-400 text-amber-900 bg-amber-50",
        saving: isDark ? "border-blue-500/50 text-blue-200 bg-blue-500/10" : "border-blue-300 text-blue-800 bg-blue-50",
        saved: isDark ? "border-emerald-500/50 text-emerald-200 bg-emerald-500/10" : "border-emerald-400 text-emerald-900 bg-emerald-50",
        failed: isDark ? "border-red-500/50 text-red-200 bg-red-500/10" : "border-red-300 text-red-800 bg-red-50",
    };
    const Icon = status === "saving" ? Loader2 : status === "saved" ? Check : status === "failed" ? AlertTriangle : CircleDot;

    return (
        <span
            role="status"
            aria-live="polite"
            data-save-status={status}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold whitespace-nowrap ${tone[status]}`}
        >
            <Icon className={`w-4 h-4 flex-shrink-0 ${status === "saving" ? "animate-spin" : ""}`} aria-hidden="true" />
            {label}
        </span>
    );
}
