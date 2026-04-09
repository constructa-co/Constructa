"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, CreditCard, GitBranch, CalendarDays, ChevronRight, Activity, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { archiveProjectAction } from "../archive/actions";

// ── Types ────────────────────────────────────────────────────────────────────
interface Phase {
    name: string;
    calculatedDays: number;
    manualDays: number | null;
    startOffset: number;
    color?: string;
}

interface Invoice {
    id: string;
    amount: number;
    status: string;
    type?: string;
    created_at: string;
    description?: string;
}

interface Props {
    project: {
        id: string;
        name: string;
        client_name?: string | null;
        site_address?: string | null;
        start_date?: string | null;
        status?: string | null;
        programme_phases: Phase[];
    };
    projectId: string;
    contractValue: number;
    budgetCost: number;
    costsPosted: number;
    invoicedTotal: number;
    receivedTotal: number;
    outstandingAmt: number;
    outstandingInvoices: Invoice[];
    approvedVars: number;
    programmePct: number;
    currentPhaseName: string | null;
    totalCalendarDays: number;
    burnPct: number;
    overallRag: "green" | "amber" | "red";
    budgetRag: "green" | "amber" | "red";
    programmeRag: "green" | "amber" | "red";
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function gbp(n: number): string {
    return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ragColor(rag: "green" | "amber" | "red") {
    return rag === "red" ? "text-red-400" : rag === "amber" ? "text-amber-400" : "text-emerald-400";
}

function ragBg(rag: "green" | "amber" | "red") {
    return rag === "red" ? "bg-red-500" : rag === "amber" ? "bg-amber-500" : "bg-emerald-500";
}

function ragBadgeBg(rag: "green" | "amber" | "red") {
    return rag === "red"
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : rag === "amber"
        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
}

function ragLabel(rag: "green" | "amber" | "red") {
    return rag === "red" ? "At Risk" : rag === "amber" ? "Monitor" : "On Track";
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, rag }: { label: string; value: string; sub?: string; rag?: "green" | "amber" | "red" }) {
    return (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{label}</div>
            <div className={`text-2xl font-bold ${rag ? ragColor(rag) : "text-slate-100"}`}>{value}</div>
            {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
    );
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ pct, rag }: { pct: number; rag: "green" | "amber" | "red" }) {
    const clamped = Math.min(pct, 100);
    return (
        <div className="w-full bg-slate-700/60 rounded-full h-2.5 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all ${ragBg(rag)}`}
                style={{ width: `${clamped}%` }}
            />
        </div>
    );
}

// ── Phase Bar (mini Gantt) ───────────────────────────────────────────────────
const PHASE_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-purple-500", "bg-red-500", "bg-teal-500", "bg-indigo-500", "bg-pink-500"];

function ProgrammeBar({ phases, programmePct, totalCalendarDays }: {
    phases: Phase[];
    programmePct: number;
    totalCalendarDays: number;
}) {
    if (phases.length === 0 || totalCalendarDays === 0) {
        return <p className="text-xs text-slate-500">No programme set — <Link href="#" className="text-blue-400 hover:underline">build one →</Link></p>;
    }

    const DPW = 5;

    return (
        <div className="space-y-2">
            {/* Phase bars */}
            <div className="relative h-8 w-full rounded-lg overflow-hidden bg-slate-700/30">
                {phases.map((phase, i) => {
                    const dur = Math.ceil((phase.manualDays ?? phase.calculatedDays ?? 5) / DPW) * 7;
                    const left = ((phase.startOffset ?? 0) / totalCalendarDays) * 100;
                    const width = (dur / totalCalendarDays) * 100;
                    const color = PHASE_COLORS[i % PHASE_COLORS.length];
                    return (
                        <div
                            key={i}
                            className={`absolute top-1 h-6 rounded ${color} opacity-80 flex items-center overflow-hidden px-1`}
                            style={{ left: `${left}%`, width: `${width}%` }}
                            title={phase.name}
                        >
                            <span className="text-[10px] text-white font-medium truncate">{phase.name}</span>
                        </div>
                    );
                })}
                {/* Today marker */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/70 z-10"
                    style={{ left: `${Math.min(programmePct, 100)}%` }}
                    title="Today"
                />
            </div>
            {/* Start / End labels */}
            <div className="flex justify-between text-[10px] text-slate-500">
                <span>Start</span>
                <span className="text-slate-400 font-medium">{programmePct}% elapsed</span>
                <span>End</span>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OverviewClient({
    project, projectId,
    contractValue, budgetCost, costsPosted,
    invoicedTotal, receivedTotal, outstandingAmt, outstandingInvoices,
    approvedVars, programmePct, currentPhaseName, totalCalendarDays,
    burnPct, overallRag, budgetRag, programmeRag,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);
    const [archiveReason, setArchiveReason] = useState("");

    const p = (path: string) => `${path}?projectId=${projectId}`;

    function handleArchive() {
        startTransition(async () => {
            const result = await archiveProjectAction(projectId, archiveReason);
            if (result.error) {
                toast.error("Failed to archive: " + result.error);
            } else {
                toast.success("Project archived");
                setShowArchiveDialog(false);
                router.push("/dashboard/projects/archive");
            }
        });
    }

    return (
        <div className="space-y-6">

            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100">{project.name}</h1>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {project.client_name && <span className="text-sm text-slate-400">{project.client_name}</span>}
                        {project.site_address && <span className="text-xs text-slate-500">· {project.site_address}</span>}
                        {project.start_date && (
                            <span className="text-xs text-slate-500">· Started {formatDate(project.start_date)}</span>
                        )}
                    </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold flex-shrink-0 ${ragBadgeBg(overallRag)}`}>
                    <Activity className="w-4 h-4" />
                    {ragLabel(overallRag)}
                </div>
            </div>

            {/* ── KPI Strip ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                    label="Contract Value"
                    value={gbp(contractValue + approvedVars)}
                    sub={approvedVars > 0 ? `incl. ${gbp(approvedVars)} variations` : "from active estimate"}
                />
                <KpiCard
                    label="Budget Burn"
                    value={`${Math.round(burnPct)}%`}
                    sub={`${gbp(costsPosted)} of ${gbp(budgetCost)} budget`}
                    rag={budgetRag}
                />
                <KpiCard
                    label="Programme"
                    value={`${programmePct}%`}
                    sub={currentPhaseName ? `Currently: ${currentPhaseName}` : project.start_date ? "Not started" : "No start date set"}
                    rag={programmeRag}
                />
                <KpiCard
                    label="Outstanding"
                    value={gbp(outstandingAmt)}
                    sub={`${outstandingInvoices.length} invoice${outstandingInvoices.length !== 1 ? "s" : ""} unpaid`}
                    rag={outstandingAmt > 0 ? "amber" : "green"}
                />
            </div>

            {/* ── Budget + Programme rows ───────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Budget progress */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-200">Budget Status</h3>
                        <Link href={p("/dashboard/projects/p-and-l")} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                            Full P&L <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <ProgressBar pct={burnPct} rag={budgetRag} />
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>{gbp(costsPosted)} costs posted</span>
                        <span>{gbp(budgetCost)} budget</span>
                    </div>
                    <div className="pt-1 border-t border-slate-700/40">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Invoiced</span>
                            <span className="text-slate-300 font-medium">{gbp(invoicedTotal)}</span>
                        </div>
                        <div className="flex justify-between text-xs mt-1">
                            <span className="text-slate-400">Received</span>
                            <span className="text-emerald-400 font-medium">{gbp(receivedTotal)}</span>
                        </div>
                    </div>
                </div>

                {/* Programme progress */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-slate-200">Programme</h3>
                        <Link href={p("/dashboard/projects/schedule")} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                            View Gantt <ChevronRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <ProgrammeBar phases={project.programme_phases} programmePct={programmePct} totalCalendarDays={totalCalendarDays} />
                    {!project.start_date && (
                        <p className="text-xs text-amber-400">
                            Set a start date on the{" "}
                            <Link href={p("/dashboard/projects/schedule")} className="underline">Programme page</Link>
                            {" "}to track progress.
                        </p>
                    )}
                </div>
            </div>

            {/* ── Outstanding Invoices ─────────────────────────────────────── */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-200">Outstanding Invoices</h3>
                    <Link href={p("/dashboard/projects/billing")} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                        All invoices <ChevronRight className="w-3 h-3" />
                    </Link>
                </div>
                {outstandingInvoices.length === 0 ? (
                    <p className="text-sm text-slate-500">All invoices paid — great work!</p>
                ) : (
                    <div className="space-y-2">
                        {outstandingInvoices.slice(0, 5).map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-700/40 last:border-0">
                                <div>
                                    <div className="text-sm text-slate-200 font-medium">
                                        {inv.description || inv.type || "Invoice"}
                                    </div>
                                    <div className="text-xs text-slate-500">{formatDate(inv.created_at)}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                        inv.status === "Draft"
                                            ? "bg-slate-700/40 text-slate-400 border-slate-600"
                                            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                    }`}>
                                        {inv.status}
                                    </span>
                                    <span className="text-sm font-semibold text-slate-200">{gbp(Number(inv.amount))}</span>
                                </div>
                            </div>
                        ))}
                        {outstandingInvoices.length > 5 && (
                            <p className="text-xs text-slate-500 pt-1">+{outstandingInvoices.length - 5} more invoices</p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Quick Actions ────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
                <Link href={p("/dashboard/projects/p-and-l")}
                    className="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/25 transition-colors">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-200">Log Cost</div>
                        <div className="text-xs text-slate-500">P&L tracker</div>
                    </div>
                </Link>

                <Link href={p("/dashboard/projects/billing")}
                    className="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/25 transition-colors">
                        <CreditCard className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-200">Raise Invoice</div>
                        <div className="text-xs text-slate-500">Billing</div>
                    </div>
                </Link>

                <Link href={p("/dashboard/projects/variations")}
                    className="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-500/25 transition-colors">
                        <GitBranch className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-200">Add Variation</div>
                        <div className="text-xs text-slate-500">Variations log</div>
                    </div>
                </Link>

                <Link href={p("/dashboard/projects/schedule")}
                    className="flex items-center gap-3 bg-slate-800/50 hover:bg-slate-700/60 border border-slate-700/50 hover:border-slate-600 rounded-xl p-4 transition-all group">
                    <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/25 transition-colors">
                        <CalendarDays className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-200">Programme</div>
                        <div className="text-xs text-slate-500">View Gantt</div>
                    </div>
                </Link>
            </div>

            {/* ── Archive ──────────────────────────────────────────────────── */}
            <div className="border-t border-slate-700/40 pt-4 flex justify-end">
                <button
                    onClick={() => setShowArchiveDialog(true)}
                    className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                    <Archive className="w-3.5 h-3.5" />
                    Close & Archive Project
                </button>
            </div>

            {/* ── Archive Dialog ────────────────────────────────────────────── */}
            <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
                <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-white">Archive Project</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <p className="text-sm text-slate-400">
                            Archiving <strong className="text-slate-200">{project.name}</strong> will freeze all edits and save a financial snapshot. You can restore it at any time from the Archive.
                        </p>
                        <div className="space-y-1.5">
                            <Label className="text-slate-300 text-sm">Completion notes <span className="text-slate-500">(optional)</span></Label>
                            <Textarea
                                placeholder="e.g. Project completed on programme, client satisfied, retention to be claimed in 6 months…"
                                value={archiveReason}
                                onChange={(e) => setArchiveReason(e.target.value)}
                                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 resize-none"
                                rows={3}
                            />
                        </div>
                        <div className="flex gap-3 pt-1">
                            <Button
                                variant="outline"
                                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                                onClick={() => setShowArchiveDialog(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white"
                                disabled={isPending}
                                onClick={handleArchive}
                            >
                                <Archive className="w-4 h-4 mr-2" />
                                {isPending ? "Archiving…" : "Archive Project"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
