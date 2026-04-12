"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PoundSterling,
  GitBranch,
  TrendingUp,
  FileText,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Circle,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import InstallBanner from "@/components/install-banner";
import { logCostAction } from "@/app/dashboard/projects/p-and-l/actions";
import { COST_TYPES } from "@/app/dashboard/projects/p-and-l/constants";

interface Project {
  id: string;
  name: string;
  client_name?: string | null;
}

interface RecentCost {
  id: string;
  description: string | null;
  amount: number | null;
  created_at: string;
  projects: { name: string } | null;
}

interface RecentVar {
  id: string;
  title: string | null;
  value: number | null;
  status: string | null;
  created_at: string;
  projects: { name: string } | null;
}

interface Props {
  projects: Project[];
  recentCosts: RecentCost[];
  recentVars: RecentVar[];
}

function fmtCcy(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function fmtAge(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function VarStatusIcon({ status }: { status: string | null }) {
  if (status === "approved") return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === "rejected") return <AlertCircle className="w-3.5 h-3.5 text-red-400" />;
  return <Circle className="w-3.5 h-3.5 text-amber-400" />;
}

const ACTIONS = [
  {
    id: "log-cost",
    label: "Log Cost",
    description: "Record labour, materials or plant",
    icon: PoundSterling,
    color: "bg-blue-600",
    href: (projectId: string | null) =>
      projectId ? `/dashboard/projects/p-and-l?projectId=${projectId}` : "/dashboard/projects/p-and-l",
  },
  {
    id: "variation",
    label: "Raise Variation",
    description: "Log a change to scope or price",
    icon: GitBranch,
    color: "bg-violet-600",
    href: (projectId: string | null) =>
      projectId ? `/dashboard/projects/variations?projectId=${projectId}` : "/dashboard/projects/variations",
  },
  {
    id: "pl",
    label: "Job P&L",
    description: "Check margin and cost performance",
    icon: TrendingUp,
    color: "bg-emerald-600",
    href: (projectId: string | null) =>
      projectId ? `/dashboard/projects/p-and-l?projectId=${projectId}` : "/dashboard/projects/p-and-l",
  },
  {
    id: "invoices",
    label: "Invoices",
    description: "View billing and payment status",
    icon: FileText,
    color: "bg-amber-600",
    href: (projectId: string | null) =>
      projectId ? `/dashboard/projects/billing?projectId=${projectId}` : "/dashboard/projects/billing",
  },
];

export default function MobileHubClient({ projects, recentCosts, recentVars }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    projects[0]?.id ?? null
  );
  const [fabOpen, setFabOpen] = useState(false);
  const [fabSaving, setFabSaving] = useState(false);
  const [fabAmount, setFabAmount] = useState("");
  const [fabDesc, setFabDesc] = useState("");
  const [fabType, setFabType] = useState<string>("materials");

  const selectedProject = projects.find(p => p.id === selectedId) ?? null;

  const handleQuickLog = async () => {
    if (!selectedId) { toast.error("Select a project first"); return; }
    const amt = parseFloat(fabAmount);
    if (isNaN(amt) || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (!fabDesc.trim()) { toast.error("Enter a description"); return; }
    setFabSaving(true);
    try {
      const result = await logCostAction({
        projectId: selectedId,
        description: fabDesc.trim(),
        amount: amt,
        cost_type: fabType,
        trade_section: "General",
        expense_date: new Date().toISOString().slice(0, 10),
      });
      if (result?.error) { toast.error(result.error); }
      else {
        toast.success(`£${amt.toFixed(2)} logged to ${selectedProject?.name ?? "project"}`);
        setFabAmount(""); setFabDesc(""); setFabOpen(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log cost");
    } finally {
      setFabSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">On-site Hub</h1>
        <p className="text-slate-400 text-sm mt-0.5">Quick actions for the field</p>
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Active Project</p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`shrink-0 text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-all max-w-[160px] ${
                  selectedId === p.id
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <div className="truncate font-semibold">{p.name}</div>
                {p.client_name && (
                  <div className="truncate text-[10px] opacity-70 mt-0.5">{p.client_name}</div>
                )}
              </button>
            ))}
          </div>
          {selectedProject && (
            <p className="text-[10px] text-slate-600 mt-1.5 px-1">
              Links below open for: <span className="text-slate-500">{selectedProject.name}</span>
            </p>
          )}
        </div>
      )}

      {/* Quick action grid */}
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(action => {
          const Icon = action.icon;
          return (
            <Link
              key={action.id}
              href={action.href(selectedId)}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 active:scale-95 transition-all group"
            >
              <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors">
                {action.label}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{action.description}</p>
            </Link>
          );
        })}
      </div>

      {/* Recent activity */}
      {(recentCosts.length > 0 || recentVars.length > 0) && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Activity</h2>

          {/* Recent costs */}
          {recentCosts.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                <PoundSterling className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-semibold text-slate-300">Cost Logs</span>
              </div>
              <div className="divide-y divide-slate-800/50">
                {recentCosts.map(cost => (
                  <div key={cost.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{cost.description ?? "Cost entry"}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {fmtAge(cost.created_at)}
                        {cost.projects && <span>· {(cost.projects as { name: string }).name}</span>}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-white shrink-0">{fmtCcy(cost.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent variations */}
          {recentVars.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-slate-300">Variations</span>
              </div>
              <div className="divide-y divide-slate-800/50">
                {recentVars.map(v => (
                  <div key={v.id} className="px-4 py-3 flex items-center gap-3">
                    <VarStatusIcon status={v.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{v.title ?? "Variation"}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {fmtAge(v.created_at)}
                        {v.projects && <span>· {(v.projects as { name: string }).name}</span>}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-white shrink-0">{fmtCcy(v.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full dashboard link */}
      <Link
        href="/dashboard"
        className="flex items-center justify-between bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all"
      >
        <span>Open full dashboard</span>
        <ChevronRight className="w-4 h-4" />
      </Link>

      <InstallBanner />

      {/* ── Quick-log FAB + slide-up form ──────────────────────────── */}
      {fabOpen && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setFabOpen(false)} />
      )}
      {fabOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 rounded-t-2xl px-5 pb-8 pt-4 space-y-4 max-w-lg mx-auto animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Quick Cost Log</h3>
            <button onClick={() => setFabOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-5 h-5" />
            </button>
          </div>
          {selectedProject && (
            <p className="text-[11px] text-slate-500">Logging to: <span className="text-slate-400">{selectedProject.name}</span></p>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Amount (£)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={fabAmount}
                onChange={e => setFabAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-lg font-semibold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Description</label>
              <input
                type="text"
                value={fabDesc}
                onChange={e => setFabDesc(e.target.value)}
                placeholder="e.g. Timber delivery, Skip hire"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Type</label>
              <div className="flex gap-2 flex-wrap">
                {COST_TYPES.map(ct => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setFabType(ct)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                      fabType === ct
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleQuickLog}
              disabled={fabSaving || !selectedId}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {fabSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <PoundSterling className="w-4 h-4" />}
              {fabSaving ? "Saving…" : "Log Cost"}
            </button>
          </div>
        </div>
      )}

      {/* FAB button */}
      {!fabOpen && (
        <button
          onClick={() => setFabOpen(true)}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-900/40 flex items-center justify-center transition-all active:scale-90"
          aria-label="Quick log cost"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
