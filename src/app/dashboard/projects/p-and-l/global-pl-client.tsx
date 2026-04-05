"use client";

import { useState } from "react";
import Link from "next/link";
import {
    TrendingUp,
    TrendingDown,
    PoundSterling,
    BarChart3,
    Hammer,
    Receipt,
    ArrowRight,
    ChevronDown,
    Calendar,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ProjectSummary {
    proj: {
        id: string;
        name: string;
        client_name?: string | null;
        project_type?: string | null;
        proposal_status?: string | null;
        potential_value?: number | null;
    };
    contractValue: number;
    budgetCost: number;
    costsPosted: number;
    invoicedTotal: number;
    receivedTotal: number;
    marginPct: number;
    forecastMarginPct: number;
}

interface MonthlyData {
    month: string; // "YYYY-MM"
    costs: number;
    invoiced: number;
    received: number;
}

interface Props {
    projectSummaries: ProjectSummary[];
    monthlyData: MonthlyData[];
    financialYearStartMonth: number; // 1-12
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gbp(n: number, compact = false): string {
    if (compact) {
        if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`;
        if (Math.abs(n) >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`;
    }
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtMonth(yyyymm: string): string {
    const [y, m] = yyyymm.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function fmtQuarter(yyyymm: string): string {
    const [y, m] = yyyymm.split("-");
    const q = Math.ceil(Number(m) / 3);
    return `Q${q} ${y}`;
}

function marginColor(pct: number): string {
    if (pct >= 15) return "text-green-400";
    if (pct >= 8)  return "text-amber-400";
    if (pct >= 0)  return "text-orange-400";
    return "text-red-400";
}

function ragDot(pct: number): string {
    if (pct >= 10) return "bg-green-400";
    if (pct >= 0)  return "bg-amber-400";
    return "bg-red-400";
}

// Returns which financial year a YYYY-MM belongs to, formatted as a label
function fyLabel(yyyymm: string, startMonth: number): string {
    const [y, m] = yyyymm.split("-").map(Number);
    // FY starts on startMonth — if current month is before start, it's the previous year's FY
    const fyYear = m >= startMonth ? y : y - 1;
    const fyEndYear = fyYear + 1;
    return `FY ${fyYear}/${String(fyEndYear).slice(2)}`;
}

// ── Period grouping logic ─────────────────────────────────────────────────────
type Period = "monthly" | "quarterly" | "fy" | "calendar";

function groupData(
    data: MonthlyData[],
    period: Period,
    fyStartMonth: number
): Array<{ label: string; costs: number; invoiced: number; received: number }> {
    const map = new Map<string, { costs: number; invoiced: number; received: number }>();

    for (const row of data) {
        let key: string;
        const [y, m] = row.month.split("-").map(Number);

        if (period === "monthly") {
            key = row.month;
        } else if (period === "quarterly") {
            key = fmtQuarter(row.month);
        } else if (period === "fy") {
            key = fyLabel(row.month, fyStartMonth);
        } else {
            // calendar year
            key = String(y);
        }

        const existing = map.get(key) ?? { costs: 0, invoiced: 0, received: 0 };
        existing.costs    += row.costs;
        existing.invoiced += row.invoiced;
        existing.received += row.received;
        map.set(key, existing);
    }

    const result = Array.from(map.entries()).map(([label, vals]) => ({ label, ...vals }));

    // Sort: monthly/quarterly sort by label desc, others keep insertion order then reverse
    if (period === "monthly") {
        result.sort((a, b) => b.label.localeCompare(a.label));
    }
    // For quarterly/fy/calendar, Map preserves insertion order which is already desc (data is sorted desc)
    return result.slice(0, period === "monthly" ? 12 : period === "quarterly" ? 8 : 6);
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color = "slate" }: {
    label: string; value: string; sub?: string; icon: React.ElementType;
    color?: "slate" | "green" | "red" | "blue" | "amber";
}) {
    const c = { slate: "text-slate-100", green: "text-green-400", red: "text-red-400", blue: "text-blue-400", amber: "text-amber-400" };
    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
                <Icon className={`w-4 h-4 ${c[color]}`} />
            </div>
            <div className={`text-xl font-bold ${c[color]}`}>{value}</div>
            {sub && <div className="text-xs text-slate-500">{sub}</div>}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GlobalPLDashboard({ projectSummaries, monthlyData, financialYearStartMonth }: Props) {
    const [period, setPeriod]   = useState<Period>("monthly");
    const [yearMode, setYearMode] = useState<"calendar" | "fy">("fy");

    // ── Portfolio totals ──────────────────────────────────────────────────────
    const totalContractValue  = projectSummaries.reduce((s, p) => s + p.contractValue, 0);
    const totalBudgetCost     = projectSummaries.reduce((s, p) => s + p.budgetCost, 0);
    const totalCostsPosted    = projectSummaries.reduce((s, p) => s + p.costsPosted, 0);
    const totalInvoiced       = projectSummaries.reduce((s, p) => s + p.invoicedTotal, 0);
    const totalReceived       = projectSummaries.reduce((s, p) => s + p.receivedTotal, 0);
    const totalEstMargin      = totalContractValue - totalBudgetCost;
    const avgMarginPct        = totalContractValue > 0 ? (totalEstMargin / totalContractValue) * 100 : 0;
    const totalOutstanding    = totalInvoiced - totalReceived;

    // ── Period data ───────────────────────────────────────────────────────────
    const effectivePeriod: Period = period === "fy" || period === "calendar"
        ? (yearMode === "fy" ? "fy" : "calendar")
        : period;
    const grouped = groupData(monthlyData, effectivePeriod, financialYearStartMonth);

    // Max bar value for scaling
    const maxBarVal = Math.max(...grouped.map(r => Math.max(r.costs, r.invoiced)), 1);

    const fyMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fyMonthLabel = fyMonthNames[financialYearStartMonth - 1];

    return (
        <div className="space-y-6">

            {/* ── Portfolio KPI Strip ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <KpiCard label="Portfolio Value"    value={gbp(totalContractValue, true)}  sub={`${projectSummaries.length} projects`}                          icon={PoundSterling} color="blue" />
                <KpiCard label="Budget Cost"        value={gbp(totalBudgetCost, true)}     sub="Planned spend"                                                  icon={BarChart3} />
                <KpiCard label="Est. Margin"        value={gbp(totalEstMargin, true)}      sub={`${avgMarginPct.toFixed(1)}% avg`}                              icon={totalEstMargin >= 0 ? TrendingUp : TrendingDown} color={totalEstMargin >= 0 ? "green" : "red"} />
                <KpiCard label="Costs Posted"       value={gbp(totalCostsPosted, true)}    sub={totalBudgetCost > 0 ? `${((totalCostsPosted/totalBudgetCost)*100).toFixed(0)}% of budget` : "No budget set"} icon={Hammer} color={totalCostsPosted > totalBudgetCost * 1.1 ? "red" : "slate"} />
                <KpiCard label="Invoiced"           value={gbp(totalInvoiced, true)}       sub={totalContractValue > 0 ? `${((totalInvoiced/totalContractValue)*100).toFixed(0)}% of contract` : ""}         icon={Receipt} color="blue" />
                <KpiCard label="Outstanding"        value={gbp(totalOutstanding, true)}    sub="Invoiced not yet paid"                                          icon={Calendar} color={totalOutstanding > 0 ? "amber" : "slate"} />
            </div>

            {/* ── Period breakdown ──────────────────────────────────────────── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                {/* Controls */}
                <div className="px-5 py-3 border-b border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-slate-200">Spend vs Invoiced by Period</h2>
                    <div className="flex items-center gap-2">
                        {/* Year mode toggle */}
                        <div className="flex items-center gap-1 bg-slate-700/40 rounded-lg p-1 text-xs">
                            <button
                                onClick={() => { setYearMode("fy"); if (period === "calendar") setPeriod("fy"); }}
                                className={`px-2.5 py-1 rounded-md transition-colors font-medium ${yearMode === "fy" ? "bg-slate-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                            >
                                FY ({fyMonthLabel})
                            </button>
                            <button
                                onClick={() => { setYearMode("calendar"); if (period === "fy") setPeriod("calendar"); }}
                                className={`px-2.5 py-1 rounded-md transition-colors font-medium ${yearMode === "calendar" ? "bg-slate-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                            >
                                Calendar
                            </button>
                        </div>
                        {/* Period selector */}
                        <div className="flex items-center gap-1 bg-slate-700/40 rounded-lg p-1 text-xs">
                            {(["monthly", "quarterly", yearMode] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-2.5 py-1 rounded-md transition-colors font-medium capitalize ${period === p ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                                >
                                    {p === "fy" ? "Annual" : p === "calendar" ? "Annual" : p === "monthly" ? "Monthly" : "Quarterly"}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Data table */}
                {grouped.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                        No cost or invoice data yet. Log costs and raise invoices on individual projects to see period breakdowns here.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700/30">
                                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Period</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Costs</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invoiced</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Received</th>
                                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Visual</th>
                            </tr>
                        </thead>
                        <tbody>
                            {grouped.map((row, i) => {
                                const costPct   = (row.costs / maxBarVal) * 100;
                                const invoicePct = (row.invoiced / maxBarVal) * 100;
                                return (
                                    <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                        <td className="px-4 py-3 text-slate-300 font-medium text-xs">
                                            {period === "monthly" ? fmtMonth(row.label) : row.label}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">{row.costs > 0 ? gbp(row.costs) : "—"}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-blue-400">{row.invoiced > 0 ? gbp(row.invoiced) : "—"}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-green-400">{row.received > 0 ? gbp(row.received) : "—"}</td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                                                    <div className="flex-1 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                                                        <div className="h-full bg-slate-400 rounded-full" style={{ width: `${costPct}%` }} />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                                                    <div className="flex-1 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                                                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${invoicePct}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
                {/* Legend */}
                <div className="px-5 py-2 border-t border-slate-700/30 flex items-center gap-4 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />Costs posted</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Invoiced</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Received</span>
                </div>
            </div>

            {/* ── Per-project breakdown ─────────────────────────────────────── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-700/50">
                    <h2 className="text-sm font-semibold text-slate-200">Project Breakdown</h2>
                </div>
                {projectSummaries.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">No projects found.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-700/30">
                                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Project</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Contract</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Budget Cost</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Costs</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invoiced</th>
                                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Margin</th>
                                <th className="px-4 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectSummaries.map(({ proj, contractValue, budgetCost, costsPosted, invoicedTotal, marginPct, forecastMarginPct }, i) => (
                                <tr key={i} className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ragDot(forecastMarginPct)}`} title={`Forecast margin: ${forecastMarginPct.toFixed(1)}%`} />
                                            <div>
                                                <div className="text-slate-200 font-medium text-xs">{proj.name}</div>
                                                {proj.client_name && <div className="text-slate-500 text-[10px]">{proj.client_name}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">{contractValue > 0 ? gbp(contractValue, true) : "—"}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">{budgetCost > 0 ? gbp(budgetCost, true) : "—"}</td>
                                    <td className="px-4 py-3 text-right font-mono text-xs">
                                        <span className={costsPosted > budgetCost * 1.1 ? "text-red-400" : "text-slate-300"}>
                                            {costsPosted > 0 ? gbp(costsPosted, true) : "—"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-blue-400">{invoicedTotal > 0 ? gbp(invoicedTotal, true) : "—"}</td>
                                    <td className="px-4 py-3 text-right text-xs">
                                        <span className={marginColor(marginPct)}>{marginPct.toFixed(1)}%</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/dashboard/projects/p-and-l?projectId=${proj.id}`}
                                            className="flex items-center gap-1 text-slate-500 hover:text-blue-400 transition-colors text-xs"
                                        >
                                            View <ArrowRight className="w-3 h-3" />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        {projectSummaries.length > 1 && (
                            <tfoot>
                                <tr className="border-t border-slate-600/50 bg-slate-700/20">
                                    <td className="px-4 py-3 text-slate-400 font-bold text-xs uppercase">Total</td>
                                    <td className="px-4 py-3 text-right font-bold font-mono text-xs text-slate-200">{gbp(totalContractValue, true)}</td>
                                    <td className="px-4 py-3 text-right font-bold font-mono text-xs text-slate-300">{gbp(totalBudgetCost, true)}</td>
                                    <td className="px-4 py-3 text-right font-bold font-mono text-xs text-slate-200">{gbp(totalCostsPosted, true)}</td>
                                    <td className="px-4 py-3 text-right font-bold font-mono text-xs text-blue-400">{gbp(totalInvoiced, true)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-xs">
                                        <span className={marginColor(avgMarginPct)}>{avgMarginPct.toFixed(1)}%</span>
                                    </td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                )}
            </div>
        </div>
    );
}
