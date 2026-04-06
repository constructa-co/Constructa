"use client";

import { useState } from "react";
import type { AdminStats, SubscriberRow } from "./page";

// ─── Constants ───────────────────────────────────────────────────────────────
const PLAN_PRICE_GBP = 49; // Monthly plan price — update when billing goes live
const PLAN_NAME = "Starter";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function relativeTime(iso: string | null): string {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function StatusBadge({ sub }: { sub: SubscriberRow }) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const isActive =
        sub.last_active && new Date(sub.last_active) >= thirtyDaysAgo;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                isActive
                    ? "bg-emerald-900/50 text-emerald-400 ring-1 ring-emerald-700"
                    : "bg-zinc-800 text-zinc-400 ring-1 ring-zinc-700"
            }`}
        >
            <span
                className={`h-1.5 w-1.5 rounded-full ${
                    isActive ? "bg-emerald-400" : "bg-zinc-500"
                }`}
            />
            {isActive ? "Active" : "Inactive"}
        </span>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({
    label,
    value,
    sub,
    accent,
}: {
    label: string;
    value: string;
    sub?: string;
    accent?: boolean;
}) {
    return (
        <div
            className={`rounded-xl border p-5 ${
                accent
                    ? "border-amber-700/50 bg-amber-900/20"
                    : "border-zinc-800 bg-zinc-900"
            }`}
        >
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                {label}
            </p>
            <p
                className={`mt-2 text-3xl font-bold tracking-tight ${
                    accent ? "text-amber-400" : "text-zinc-100"
                }`}
            >
                {value}
            </p>
            {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
        </div>
    );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function StatPill({
    label,
    value,
    icon,
}: {
    label: string;
    value: number | string;
    icon: string;
}) {
    return (
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
            <div className="flex items-center gap-2">
                <span className="text-base">{icon}</span>
                <span className="text-sm text-zinc-400">{label}</span>
            </div>
            <span className="text-sm font-semibold text-zinc-100">{value}</span>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminClient({ stats }: { stats: AdminStats }) {
    const { subscribers, totals } = stats;
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<keyof SubscriberRow>("created_at");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const mrr = totals.total_subscribers * PLAN_PRICE_GBP;
    const arr = mrr * 12;

    // Filter + sort
    const filtered = subscribers
        .filter((s) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return (
                (s.company_name || "").toLowerCase().includes(q) ||
                (s.email || "").toLowerCase().includes(q)
            );
        })
        .sort((a, b) => {
            const av = a[sortKey] ?? "";
            const bv = b[sortKey] ?? "";
            const cmp = String(av).localeCompare(String(bv), undefined, {
                numeric: true,
            });
            return sortDir === "asc" ? cmp : -cmp;
        });

    const handleSort = (key: keyof SubscriberRow) => {
        if (sortKey === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const SortIcon = ({ col }: { col: keyof SubscriberRow }) => {
        if (sortKey !== col)
            return <span className="text-zinc-700 ml-1">↕</span>;
        return (
            <span className="text-amber-400 ml-1">
                {sortDir === "asc" ? "↑" : "↓"}
            </span>
        );
    };

    return (
        <div className="space-y-8">
            {/* ── Page Title ── */}
            <div>
                <h2 className="text-2xl font-bold text-zinc-100">
                    Platform Overview
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                    Live data ·{" "}
                    {new Date().toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                    })}
                </p>
            </div>

            {/* ── Revenue KPIs ── */}
            <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Revenue
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <KpiCard
                        label="Total Subscribers"
                        value={totals.total_subscribers.toString()}
                        sub="All-time signups"
                    />
                    <KpiCard
                        label="Active (30d)"
                        value={totals.active_30d.toString()}
                        sub="Used app in last 30 days"
                    />
                    <KpiCard
                        label="MRR"
                        value={formatCurrency(mrr)}
                        sub={`${totals.total_subscribers} × ${formatCurrency(PLAN_PRICE_GBP)}/mo`}
                        accent
                    />
                    <KpiCard
                        label="ARR"
                        value={formatCurrency(arr)}
                        sub="MRR × 12"
                        accent
                    />
                </div>
                <p className="mt-2 text-xs text-zinc-600">
                    * Revenue figures are estimated based on {PLAN_NAME} plan (
                    {formatCurrency(PLAN_PRICE_GBP)}/mo). Update{" "}
                    <code className="text-zinc-500">PLAN_PRICE_GBP</code> in{" "}
                    <code className="text-zinc-500">admin-client.tsx</code> when
                    billing goes live.
                </p>
            </section>

            {/* ── Subscriber Table ── */}
            <section>
                <div className="mb-3 flex items-center justify-between gap-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Subscribers ({filtered.length})
                    </h3>
                    <input
                        type="text"
                        placeholder="Search company or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:border-amber-600 focus:outline-none w-64"
                    />
                </div>

                <div className="overflow-x-auto rounded-xl border border-zinc-800">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900">
                                <th
                                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-zinc-500 hover:text-zinc-300"
                                    onClick={() => handleSort("company_name")}
                                >
                                    Company <SortIcon col="company_name" />
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-zinc-500 hover:text-zinc-300"
                                    onClick={() => handleSort("email")}
                                >
                                    Email <SortIcon col="email" />
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-zinc-500 hover:text-zinc-300"
                                    onClick={() => handleSort("created_at")}
                                >
                                    Signed Up <SortIcon col="created_at" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                    Plan
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-zinc-500 hover:text-zinc-300"
                                    onClick={() => handleSort("project_count")}
                                >
                                    Projects <SortIcon col="project_count" />
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-zinc-500 hover:text-zinc-300"
                                    onClick={() =>
                                        handleSort("proposals_sent")
                                    }
                                >
                                    Proposals <SortIcon col="proposals_sent" />
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-right text-xs font-medium text-zinc-500 hover:text-zinc-300"
                                    onClick={() =>
                                        handleSort("estimates_created")
                                    }
                                >
                                    Estimates{" "}
                                    <SortIcon col="estimates_created" />
                                </th>
                                <th
                                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium text-zinc-500 hover:text-zinc-300"
                                    onClick={() => handleSort("last_active")}
                                >
                                    Last Active <SortIcon col="last_active" />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-4 py-8 text-center text-sm text-zinc-600"
                                    >
                                        {search
                                            ? "No subscribers match your search."
                                            : "No subscribers yet."}
                                    </td>
                                </tr>
                            )}
                            {filtered.map((sub, i) => (
                                <tr
                                    key={sub.id}
                                    className={`border-b border-zinc-800/50 transition-colors hover:bg-zinc-800/30 ${
                                        i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/30"
                                    }`}
                                >
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-zinc-100">
                                            {sub.company_name || (
                                                <span className="italic text-zinc-600">
                                                    No company
                                                </span>
                                            )}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-400 text-xs">
                                        {sub.email || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                                        {formatDate(sub.created_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-zinc-700">
                                            {PLAN_NAME}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-zinc-300">
                                        {sub.project_count}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <span
                                            className={
                                                sub.proposals_sent > 0
                                                    ? "text-emerald-400"
                                                    : "text-zinc-600"
                                            }
                                        >
                                            {sub.proposals_sent}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-zinc-300">
                                        {sub.estimates_created}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">
                                        {relativeTime(sub.last_active)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge sub={sub} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Platform Usage ── */}
            <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Platform Usage (All Time)
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <StatPill
                        icon="📁"
                        label="Projects Created"
                        value={totals.total_projects}
                    />
                    <StatPill
                        icon="📊"
                        label="Estimates Built"
                        value={totals.total_estimates}
                    />
                    <StatPill
                        icon="📤"
                        label="Proposals Sent"
                        value={totals.total_proposals_sent}
                    />
                    <StatPill
                        icon="📋"
                        label="Contracts Reviewed"
                        value={totals.total_contracts_reviewed}
                    />
                </div>
            </section>

            {/* ── Platform Info ── */}
            <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Platform Info
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <StatPill
                        icon="🗄️"
                        label="Supabase Project"
                        value="pudadynieiuypxeoimnz"
                    />
                    <StatPill
                        icon="🌍"
                        label="Region"
                        value="West Europe (London)"
                    />
                    <StatPill
                        icon="⚡"
                        label="Hosting"
                        value="Vercel (auto-deploy from main)"
                    />
                    <StatPill
                        icon="🤖"
                        label="AI Model"
                        value="OpenAI gpt-4o-mini"
                    />
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="border-t border-zinc-800 pt-4">
                <p className="text-xs text-zinc-700">
                    Constructa Admin · Data refreshes on page load ·{" "}
                    <a
                        href="https://supabase.com/dashboard/project/pudadynieiuypxeoimnz"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-zinc-500 transition-colors"
                    >
                        Open Supabase Dashboard →
                    </a>
                </p>
            </footer>
        </div>
    );
}
