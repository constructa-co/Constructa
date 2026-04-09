"use client";

import { useState, useMemo } from "react";
import { BarChart2, TrendingUp, TrendingDown, Minus, Download, FileText } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Profile { financial_year_start_month: number; company_name: string | null; }
interface Project { id: string; name: string; client_name: string | null; project_type: string | null; status: string | null; start_date: string | null; is_archived: boolean; archived_at: string | null; }
interface Estimate { project_id: string; total_cost: number; overhead_pct: number; profit_pct: number; risk_pct: number; prelims_pct: number; discount_pct: number; }
interface Invoice { project_id: string; amount: number; status: string; created_at: string; due_date: string | null; paid_date: string | null; net_due: number | null; retention_held: number | null; }
interface Expense { project_id: string; amount: number; expense_date: string; cost_type: string; cost_status: string; }
interface Variation { project_id: string; amount: number; status: string; date_instructed: string | null; }
interface Snapshot { project_id: string; contract_value: number | null; total_costs_posted: number | null; gross_margin_pct: number | null; total_invoiced: number | null; total_paid: number | null; retention_outstanding: number | null; final_account_amount: number | null; snapshot_date: string | null; }

interface Props {
  profile: Profile;
  projects: Project[];
  estimates: Estimate[];
  invoices: Invoice[];
  expenses: Expense[];
  variations: Variation[];
  snapshots: Snapshot[];
}

type DateRange = "fy" | "last_fy" | "cy" | "last_12m" | "all";
type Tab = "overview" | "pl" | "cashflow" | "wip" | "export";

// ── Helpers ────────────────────────────────────────────────────────────────────

function gbp(n: number): string {
  return "£" + Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function pct(n: number): string { return n.toFixed(1) + "%"; }
function fmtMonth(d: Date): string { return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }); }
function fmtDate(s: string | null): string { if (!s) return "—"; return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

function fyBounds(fyStartMonth: number, offset = 0): { start: Date; end: Date } {
  const now = new Date();
  let startYear = now.getFullYear();
  if (now.getMonth() + 1 < fyStartMonth) startYear -= 1;
  startYear -= offset;
  const start = new Date(startYear, fyStartMonth - 1, 1);
  const end = new Date(startYear + 1, fyStartMonth - 1, 0, 23, 59, 59);
  return { start, end };
}

function getRangeBounds(range: DateRange, fyStartMonth: number): { start: Date; end: Date } {
  const now = new Date();
  if (range === "fy") return fyBounds(fyStartMonth, 0);
  if (range === "last_fy") return fyBounds(fyStartMonth, 1);
  if (range === "cy") return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
  if (range === "last_12m") return { start: addDays(now, -365), end: now };
  return { start: new Date(2020, 0, 1), end: now };
}

function calcContractValue(est: Estimate | undefined): number {
  if (!est) return 0;
  const base = est.total_cost ?? 0;
  const prelims = base * ((est.prelims_pct ?? 0) / 100);
  const budget = base + prelims;
  const overhead = budget * ((est.overhead_pct ?? 0) / 100);
  const risk = (budget + overhead) * ((est.risk_pct ?? 0) / 100);
  const profit = (budget + overhead + risk) * ((est.profit_pct ?? 0) / 100);
  const discount = (budget + overhead + risk + profit) * ((est.discount_pct ?? 0) / 100);
  return budget + overhead + risk + profit - discount;
}

function marginColour(m: number): string {
  if (m >= 15) return "text-emerald-400";
  if (m >= 5) return "text-amber-400";
  return "text-red-400";
}

// ── Mini Bar Chart (pure CSS) ──────────────────────────────────────────────────

function MiniBar({ label, revenue, costs }: { label: string; revenue: number; costs: number }) {
  const max = Math.max(revenue, costs, 1);
  const rh = Math.round((revenue / max) * 64);
  const ch = Math.round((costs / max) * 64);
  return (
    <div className="flex flex-col items-center gap-1 min-w-[36px]">
      <div className="flex items-end gap-0.5 h-16">
        <div className="w-3 bg-blue-500 rounded-t-sm" style={{ height: rh }} title={`Revenue ${gbp(revenue)}`} />
        <div className="w-3 bg-rose-500/70 rounded-t-sm" style={{ height: ch }} title={`Costs ${gbp(costs)}`} />
      </div>
      <span className="text-[9px] text-slate-500 rotate-[-40deg] origin-top-left translate-y-3 translate-x-1 whitespace-nowrap">{label}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ManagementAccountsClient({ profile, projects, estimates, invoices, expenses, variations, snapshots }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [dateRange, setDateRange] = useState<DateRange>("fy");

  const fyStart = profile.financial_year_start_month ?? 4;
  const { start: rangeStart, end: rangeEnd } = getRangeBounds(dateRange, fyStart);

  // Index lookups
  const estimateByProject = useMemo(() => {
    const m = new Map<string, Estimate>();
    estimates.forEach(e => m.set(e.project_id, e));
    return m;
  }, [estimates]);

  const snapshotByProject = useMemo(() => {
    const m = new Map<string, Snapshot>();
    snapshots.forEach(s => m.set(s.project_id, s));
    return m;
  }, [snapshots]);

  // Per-project financials (all time, for WIP/P&L)
  const projectData = useMemo(() => projects.map(p => {
    const snap = snapshotByProject.get(p.id);
    const est = estimateByProject.get(p.id);
    const contractValue = snap?.contract_value ?? calcContractValue(est);
    const approvedVars = variations.filter(v => v.project_id === p.id && v.status === "Approved").reduce((s, v) => s + (v.amount ?? 0), 0);
    const totalCosts = snap?.total_costs_posted ?? expenses.filter(e => e.project_id === p.id).reduce((s, e) => s + (e.amount ?? 0), 0);
    const totalInvoiced = snap?.total_invoiced ?? invoices.filter(i => i.project_id === p.id).reduce((s, i) => s + (i.amount ?? 0), 0);
    const totalPaid = snap?.total_paid ?? invoices.filter(i => i.project_id === p.id && i.status === "Paid").reduce((s, i) => s + (i.amount ?? 0), 0);
    const outstanding = totalInvoiced - totalPaid;
    const adjContract = contractValue + approvedVars;
    const margin = adjContract > 0 ? ((adjContract - totalCosts) / adjContract) * 100 : 0;
    const retentionHeld = invoices.filter(i => i.project_id === p.id).reduce((s, i) => s + (i.retention_held ?? 0), 0);
    return { ...p, contractValue: adjContract, totalCosts, totalInvoiced, totalPaid, outstanding, margin, retentionHeld };
  }), [projects, estimateByProject, snapshotByProject, expenses, invoices, variations]);

  // Date-filtered invoices & expenses
  const filteredInvoices = useMemo(() => invoices.filter(i => {
    const d = new Date(i.paid_date ?? i.created_at);
    return d >= rangeStart && d <= rangeEnd;
  }), [invoices, rangeStart, rangeEnd]);

  const filteredExpenses = useMemo(() => expenses.filter(e => {
    const d = new Date(e.expense_date);
    return d >= rangeStart && d <= rangeEnd;
  }), [expenses, rangeStart, rangeEnd]);

  // Period revenue = paid invoices in range; Period costs = expenses in range
  const periodRevenue = filteredInvoices.filter(i => i.status === "Paid").reduce((s, i) => s + (i.amount ?? 0), 0);
  const periodCosts = filteredExpenses.reduce((s, e) => s + (e.amount ?? 0), 0);
  const periodMargin = periodRevenue > 0 ? ((periodRevenue - periodCosts) / periodRevenue) * 100 : 0;
  const periodOutstanding = invoices.filter(i => i.status !== "Paid").reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalRetention = projectData.reduce((s, p) => s + p.retentionHeld, 0);

  // Monthly breakdown for chart (last 12 months in range)
  const monthlyData = useMemo(() => {
    const months: Array<{ label: string; revenue: number; costs: number }> = [];
    const cur = new Date(rangeStart);
    cur.setDate(1);
    while (cur <= rangeEnd && months.length < 12) {
      const mStart = new Date(cur);
      const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59);
      const rev = invoices
        .filter(i => i.status === "Paid" && i.paid_date)
        .filter(i => { const d = new Date(i.paid_date!); return d >= mStart && d <= mEnd; })
        .reduce((s, i) => s + (i.amount ?? 0), 0);
      const cos = expenses
        .filter(e => { const d = new Date(e.expense_date); return d >= mStart && d <= mEnd; })
        .reduce((s, e) => s + (e.amount ?? 0), 0);
      months.push({ label: fmtMonth(cur), revenue: rev, costs: cos });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }, [invoices, expenses, rangeStart, rangeEnd]);

  // Cash flow forecast — next 90 days
  const today = new Date();
  const in90 = addDays(today, 90);
  const cashInflows = invoices
    .filter(i => i.status !== "Paid")
    .map(i => {
      const dueDate = i.due_date ? new Date(i.due_date) : addDays(new Date(i.created_at), 30);
      return { date: dueDate, amount: i.net_due ?? i.amount, projectId: i.project_id };
    })
    .filter(x => x.date >= today && x.date <= in90)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const cashOutflows = expenses
    .filter(e => e.cost_status === "committed")
    .map(e => ({ date: addDays(new Date(e.expense_date), 30), amount: e.amount, projectId: e.project_id }))
    .filter(x => x.date >= today && x.date <= in90)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const totalInflows90 = cashInflows.reduce((s, x) => s + x.amount, 0);
  const totalOutflows90 = cashOutflows.reduce((s, x) => s + x.amount, 0);
  const netCash90 = totalInflows90 - totalOutflows90;

  // WIP — active projects only
  const wipProjects = projectData.filter(p => p.status === "active" && !p.is_archived);
  const totalWIP = wipProjects.reduce((s, p) => s + Math.max(0, p.contractValue - p.totalInvoiced), 0);

  // Project name lookup
  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? id.slice(0, 8);

  // CSV export
  function downloadCSV() {
    const rows = [
      ["Project", "Client", "Type", "Status", "Contract Value", "Costs Posted", "Gross Margin %", "Invoiced", "Paid", "Outstanding", "Retention Held"],
      ...projectData.map(p => [
        p.name, p.client_name ?? "", p.project_type ?? "", p.is_archived ? "Archived" : (p.status ?? ""),
        p.contractValue.toFixed(2), p.totalCosts.toFixed(2),
        p.margin.toFixed(1), p.totalInvoiced.toFixed(2),
        p.totalPaid.toFixed(2), p.outstanding.toFixed(2), p.retentionHeld.toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `constructa-management-accounts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "pl", label: "P&L by Project" },
    { id: "cashflow", label: "Cash Flow" },
    { id: "wip", label: "WIP Schedule" },
    { id: "export", label: "Export" },
  ];

  const RANGE_OPTIONS: { value: DateRange; label: string }[] = [
    { value: "fy", label: "This Financial Year" },
    { value: "last_fy", label: "Last Financial Year" },
    { value: "cy", label: "This Calendar Year" },
    { value: "last_12m", label: "Last 12 Months" },
    { value: "all", label: "All Time" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-slate-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">Management Accounts</h1>
              <p className="text-sm text-slate-400">
                {profile.company_name ? `${profile.company_name} · ` : ""}Consolidated financial view
              </p>
            </div>
          </div>
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value as DateRange)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-md px-3 py-2 text-sm"
          >
            {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 -mb-5 border-b border-slate-800">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <>
            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Period Revenue", value: gbp(periodRevenue), sub: "Paid invoices", icon: TrendingUp, colour: "text-blue-400" },
                { label: "Period Costs", value: gbp(periodCosts), sub: "All expenses", icon: TrendingDown, colour: "text-rose-400" },
                { label: "Gross Margin", value: pct(periodMargin), sub: "Revenue vs costs", icon: periodMargin >= 10 ? TrendingUp : Minus, colour: marginColour(periodMargin) },
                { label: "Outstanding", value: gbp(periodOutstanding), sub: "Awaiting payment", icon: FileText, colour: "text-amber-400" },
              ].map(k => (
                <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">{k.label}</span>
                    <k.icon className={`w-4 h-4 ${k.colour}`} />
                  </div>
                  <div className={`text-2xl font-bold ${k.colour}`}>{k.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Second row KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Active Projects", value: String(projects.filter(p => p.status === "active").length), sub: "Currently live" },
                { label: "Total WIP", value: gbp(totalWIP), sub: "Uninvoiced contract value" },
                { label: "Retention Held", value: gbp(totalRetention), sub: "By clients" },
                { label: "Total Projects", value: String(projects.length), sub: "All time" },
              ].map(k => (
                <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">{k.label}</div>
                  <div className="text-2xl font-bold text-white">{k.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Monthly chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-200">Monthly Revenue vs Costs</h3>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" /> Revenue (paid)</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-500/70 rounded-sm inline-block" /> Costs</span>
                </div>
              </div>
              {monthlyData.every(m => m.revenue === 0 && m.costs === 0) ? (
                <p className="text-sm text-slate-500 py-8 text-center">No financial data for this period.</p>
              ) : (
                <div className="flex items-end gap-3 overflow-x-auto pb-6 pt-2">
                  {monthlyData.map(m => <MiniBar key={m.label} label={m.label} revenue={m.revenue} costs={m.costs} />)}
                </div>
              )}
            </div>

            {/* Period summary table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-4">Period Summary</h3>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Gross Revenue (paid invoices)", value: gbp(periodRevenue), colour: "text-blue-400" },
                  { label: "Less: Direct Costs", value: `(${gbp(periodCosts)})`, colour: "text-rose-400" },
                  { label: "Gross Profit", value: gbp(periodRevenue - periodCosts), colour: periodRevenue - periodCosts >= 0 ? "text-emerald-400" : "text-red-400" },
                  { label: "Gross Margin %", value: pct(periodMargin), colour: marginColour(periodMargin) },
                  { label: "Outstanding Receivables", value: gbp(periodOutstanding), colour: "text-amber-400" },
                  { label: "Retention Held by Clients", value: gbp(totalRetention), colour: "text-amber-400" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                    <span className="text-slate-400">{row.label}</span>
                    <span className={`font-semibold ${row.colour}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── P&L BY PROJECT TAB ────────────────────────────────────────────── */}
        {tab === "pl" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">P&L by Project — All Time</h3>
              <span className="text-xs text-slate-500">{projectData.length} projects</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {["Project", "Client", "Status", "Contract Value", "Costs Posted", "Gross Margin", "Invoiced", "Paid", "Outstanding"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projectData.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No projects found.</td></tr>
                  )}
                  {projectData.map(p => (
                    <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-white max-w-[160px] truncate">{p.name}</td>
                      <td className="px-4 py-3 text-slate-400 max-w-[120px] truncate">{p.client_name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${
                          p.is_archived ? "bg-slate-700/40 text-slate-400 border-slate-600"
                          : p.status === "active" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                          : p.status === "completed" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-slate-700/40 text-slate-400 border-slate-600"
                        }`}>
                          {p.is_archived ? "Archived" : (p.status ?? "—")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white font-medium">{gbp(p.contractValue)}</td>
                      <td className="px-4 py-3 text-slate-300">{gbp(p.totalCosts)}</td>
                      <td className={`px-4 py-3 font-semibold ${marginColour(p.margin)}`}>{pct(p.margin)}</td>
                      <td className="px-4 py-3 text-slate-300">{gbp(p.totalInvoiced)}</td>
                      <td className="px-4 py-3 text-emerald-400">{gbp(p.totalPaid)}</td>
                      <td className={`px-4 py-3 font-medium ${p.outstanding > 0 ? "text-amber-400" : "text-slate-400"}`}>{gbp(p.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
                {projectData.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-700 bg-slate-800/50">
                      <td colSpan={3} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Totals</td>
                      <td className="px-4 py-3 font-bold text-white">{gbp(projectData.reduce((s, p) => s + p.contractValue, 0))}</td>
                      <td className="px-4 py-3 font-bold text-slate-300">{gbp(projectData.reduce((s, p) => s + p.totalCosts, 0))}</td>
                      <td className={`px-4 py-3 font-bold ${marginColour(
                        (() => { const tv = projectData.reduce((s, p) => s + p.contractValue, 0); const tc = projectData.reduce((s, p) => s + p.totalCosts, 0); return tv > 0 ? ((tv - tc) / tv) * 100 : 0; })()
                      )}`}>
                        {pct((() => { const tv = projectData.reduce((s, p) => s + p.contractValue, 0); const tc = projectData.reduce((s, p) => s + p.totalCosts, 0); return tv > 0 ? ((tv - tc) / tv) * 100 : 0; })())}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-300">{gbp(projectData.reduce((s, p) => s + p.totalInvoiced, 0))}</td>
                      <td className="px-4 py-3 font-bold text-emerald-400">{gbp(projectData.reduce((s, p) => s + p.totalPaid, 0))}</td>
                      <td className="px-4 py-3 font-bold text-amber-400">{gbp(projectData.reduce((s, p) => s + p.outstanding, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ── CASH FLOW TAB ─────────────────────────────────────────────────── */}
        {tab === "cashflow" && (
          <>
            {/* 90-day summary */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Projected Inflows (90 days)", value: gbp(totalInflows90), sub: `${cashInflows.length} outstanding invoices`, colour: "text-emerald-400" },
                { label: "Projected Outflows (90 days)", value: gbp(totalOutflows90), sub: `${cashOutflows.length} committed costs`, colour: "text-rose-400" },
                { label: "Net Cash Position", value: gbp(netCash90), sub: "Inflows minus outflows", colour: netCash90 >= 0 ? "text-emerald-400" : "text-red-400" },
              ].map(k => (
                <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="text-xs text-slate-500 mb-2">{k.label}</div>
                  <div className={`text-2xl font-bold ${k.colour}`}>{k.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Inflows */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 bg-emerald-950/30">
                  <h3 className="text-sm font-semibold text-emerald-400">Expected Inflows — Next 90 Days</h3>
                </div>
                {cashInflows.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-slate-500 text-center">No outstanding invoices due in the next 90 days.</p>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {cashInflows.map((x, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                        <div>
                          <p className="text-slate-200 font-medium">{projectName(x.projectId)}</p>
                          <p className="text-xs text-slate-500">Due {fmtDate(x.date.toISOString())}</p>
                        </div>
                        <span className="text-emerald-400 font-semibold">{gbp(x.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-5 py-3 bg-slate-800/40 text-sm font-bold">
                      <span className="text-slate-300">Total</span>
                      <span className="text-emerald-400">{gbp(totalInflows90)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Outflows */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-800 bg-rose-950/30">
                  <h3 className="text-sm font-semibold text-rose-400">Committed Outflows — Next 90 Days</h3>
                </div>
                {cashOutflows.length === 0 ? (
                  <p className="px-5 py-8 text-sm text-slate-500 text-center">No committed costs due in the next 90 days.</p>
                ) : (
                  <div className="divide-y divide-slate-800">
                    {cashOutflows.map((x, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                        <div>
                          <p className="text-slate-200 font-medium">{projectName(x.projectId)}</p>
                          <p className="text-xs text-slate-500">Expected {fmtDate(x.date.toISOString())}</p>
                        </div>
                        <span className="text-rose-400 font-semibold">{gbp(x.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-5 py-3 bg-slate-800/40 text-sm font-bold">
                      <span className="text-slate-300">Total</span>
                      <span className="text-rose-400">{gbp(totalOutflows90)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── WIP SCHEDULE TAB ──────────────────────────────────────────────── */}
        {tab === "wip" && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Active Projects", value: String(wipProjects.length), sub: "With WIP balance" },
                { label: "Total WIP", value: gbp(totalWIP), sub: "Uninvoiced contract value" },
                { label: "Total Outstanding", value: gbp(wipProjects.reduce((s, p) => s + p.outstanding, 0)), sub: "Invoiced but unpaid" },
              ].map(k => (
                <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <div className="text-xs text-slate-500 mb-2">{k.label}</div>
                  <div className="text-2xl font-bold text-white">{k.value}</div>
                  <div className="text-xs text-slate-500 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-200">WIP Schedule — Active Projects</h3>
                <p className="text-xs text-slate-500 mt-0.5">WIP Balance = Contract Value less amount invoiced to date</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      {["Project", "Client", "Contract Value", "Invoiced to Date", "WIP Balance", "Outstanding", "Retention Held", "Invoice %"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wipProjects.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">No active projects found.</td></tr>
                    )}
                    {wipProjects.map(p => {
                      const wipBalance = Math.max(0, p.contractValue - p.totalInvoiced);
                      const invoicePct = p.contractValue > 0 ? (p.totalInvoiced / p.contractValue) * 100 : 0;
                      return (
                        <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-3 font-medium text-white max-w-[160px] truncate">{p.name}</td>
                          <td className="px-4 py-3 text-slate-400">{p.client_name ?? "—"}</td>
                          <td className="px-4 py-3 text-white font-medium">{gbp(p.contractValue)}</td>
                          <td className="px-4 py-3 text-slate-300">{gbp(p.totalInvoiced)}</td>
                          <td className="px-4 py-3 font-semibold text-blue-400">{gbp(wipBalance)}</td>
                          <td className={`px-4 py-3 font-medium ${p.outstanding > 0 ? "text-amber-400" : "text-slate-400"}`}>{gbp(p.outstanding)}</td>
                          <td className="px-4 py-3 text-slate-300">{gbp(p.retentionHeld)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-700 rounded-full h-1.5 min-w-[60px]">
                                <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(invoicePct, 100)}%` }} />
                              </div>
                              <span className="text-xs text-slate-400">{invoicePct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {wipProjects.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-700 bg-slate-800/50">
                        <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Totals</td>
                        <td className="px-4 py-3 font-bold text-white">{gbp(wipProjects.reduce((s, p) => s + p.contractValue, 0))}</td>
                        <td className="px-4 py-3 font-bold text-slate-300">{gbp(wipProjects.reduce((s, p) => s + p.totalInvoiced, 0))}</td>
                        <td className="px-4 py-3 font-bold text-blue-400">{gbp(totalWIP)}</td>
                        <td className="px-4 py-3 font-bold text-amber-400">{gbp(wipProjects.reduce((s, p) => s + p.outstanding, 0))}</td>
                        <td className="px-4 py-3 font-bold text-slate-300">{gbp(wipProjects.reduce((s, p) => s + p.retentionHeld, 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── EXPORT TAB ────────────────────────────────────────────────────── */}
        {tab === "export" && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-200 mb-1">Export Management Accounts</h3>
              <p className="text-sm text-slate-400 mb-6">
                Downloads a CSV file with all project P&L data — contract value, costs, margin, invoiced, paid, outstanding, and retention for every project.
              </p>
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <Download className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">P&L by Project (CSV)</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {projectData.length} projects · contract value, costs, margin, invoiced, paid, outstanding, retention
                    </p>
                  </div>
                  <button
                    onClick={downloadCSV}
                    className="shrink-0 bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                  >
                    Download CSV
                  </button>
                </div>

                <div className="flex items-start gap-4 p-4 bg-slate-800/30 border border-slate-700/30 rounded-lg opacity-60">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-300">Management Accounts PDF</p>
                    <p className="text-xs text-slate-500 mt-0.5">Full formatted report — coming in a future sprint</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500 border border-slate-700 px-3 py-2 rounded-lg">Coming soon</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">What&apos;s included in the export</h4>
              <ul className="space-y-1.5 text-sm text-slate-400">
                {["Project name, client, type, status", "Contract value (from active estimate + approved variations)", "Costs posted (all expense entries)", "Gross margin %", "Total invoiced, total paid, total outstanding", "Retention held by client"].map(item => (
                  <li key={item} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
