/**
 * P2-6 — extracted from contract-admin-client.tsx. Shared badges used
 * across all tabs (dashboard RAG column, events list, obligations
 * timeline). Keeping them in one module means the event + obligation
 * tabs don't have to import the whole monolith to render a status
 * pill.
 */

import { obligationRag, daysUntil } from "@/lib/contracts-config";

export function fmt(n: number): string {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
    }).format(n);
}

export function RagBadge({ dueDate, status }: { dueDate: string; status: string }) {
    const rag = obligationRag(dueDate, status);
    if (rag === "done") {
        return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700 text-slate-400">
                Done
            </span>
        );
    }
    const d = daysUntil(dueDate);
    const colour =
        rag === "red"
            ? "bg-red-600/20 text-red-400"
            : rag === "amber"
                ? "bg-amber-600/20 text-amber-400"
                : "bg-green-600/20 text-green-400";
    const label = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d`;
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colour}`}>{label}</span>;
}

export function StatusBadge({ status }: { status: string }) {
    const colours: Record<string, string> = {
        open:         "bg-blue-600/20 text-blue-400",
        agreed:       "bg-green-600/20 text-green-400",
        closed:       "bg-slate-700 text-slate-400",
        rejected:     "bg-red-600/20 text-red-400",
        withdrawn:    "bg-slate-700 text-slate-400",
        draft:        "bg-amber-600/20 text-amber-400",
        submitted:    "bg-blue-600/20 text-blue-400",
        under_review: "bg-purple-600/20 text-purple-400",
        disputed:     "bg-red-600/20 text-red-400",
        adjudication: "bg-red-600/20 text-red-400",
    };
    return (
        <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                colours[status] ?? "bg-slate-700 text-slate-400"
            }`}
        >
            {status.replace(/_/g, " ")}
        </span>
    );
}
