"use client";

import { useState, useRef, useCallback } from "react";
import {
  importBankTransactionsAction,
  reconcileTransactionAction,
  unreconcileTransactionAction,
  autoMatchTransactionsAction,
  deleteImportBatchAction,
  upsertVatPeriodAction,
  deleteVatPeriodAction,
  upsertOverheadCostAction,
  deleteOverheadCostAction,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project { id: string; name: string; client_name?: string | null; status: string }
interface Invoice {
  id: string; invoice_number: string | null; amount: number; net_due: number | null;
  status: string; due_date: string | null; paid_date: string | null;
  project_id: string; period_number: number | null;
}
interface BankTxn {
  id: string; transaction_date: string; description: string; reference: string | null;
  amount: number; balance: number | null; source_file: string | null;
  import_batch_id: string | null; created_at: string;
}
interface ReconciliationRecord {
  id: string; bank_transaction_id: string; invoice_id: string | null;
  match_type: string; match_confidence: number | null;
  category: string | null; project_id: string | null; notes: string | null;
}
interface VatPeriod {
  id: string; period_start: string; period_end: string; period_key: string | null;
  vat_rate: number; output_vat: number; input_vat: number;
  status: string; submitted_at: string | null; notes: string | null;
}
interface OverheadCost {
  id: string; cost_date: string; category: string; description: string;
  amount: number; vat_amount: number; supplier: string | null;
  reference: string | null; notes: string | null;
}
interface ProjectExpense {
  id: string; project_id: string; description: string; amount: number;
  cost_date: string; cost_type: string; cost_status: string;
}
interface StaffResource {
  id: string; name: string; job_title: string | null; staff_type: string; is_active: boolean;
}

interface Props {
  projects: Project[]; invoices: Invoice[]; transactions: BankTxn[];
  reconciliation: ReconciliationRecord[]; vatPeriods: VatPeriod[];
  overheadCosts: OverheadCost[]; projectExpenses: ProjectExpense[];
  staffResources: StaffResource[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function ageband(dueDate: string | null, status: string): string {
  if (status === "Paid") return "paid";
  if (!dueDate) return "current";
  const days = daysSince(dueDate);
  if (days < 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

const BAND_COLOUR: Record<string, string> = {
  current: "text-slate-400", "1-30": "text-amber-400",
  "31-60": "text-orange-400", "61-90": "text-red-400", "90+": "text-red-600",
};

const OVERHEAD_CATEGORIES = ["Salaries", "Rent & Rates", "Utilities", "Insurance", "Vehicle", "IT & Software", "Professional Fees", "Other"];

// ── CSV Parser ────────────────────────────────────────────────────────────────

function parseCSV(text: string): { date: string; description: string; reference: string; amount: number; balance: number | undefined }[] {
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  // Try to detect columns from header
  const header = lines[0].toLowerCase().replace(/"/g, "");
  const cols = header.split(",").map(c => c.trim());

  const dateIdx   = cols.findIndex(c => c.includes("date"));
  const descIdx   = cols.findIndex(c => c.includes("desc") || c.includes("narrat") || c.includes("detail") || c.includes("payee"));
  const refIdx    = cols.findIndex(c => c.includes("ref") || c.includes("cheque"));
  const amtIdx    = cols.findIndex(c => c.includes("amount") || c.includes("value") || c.includes("debit") || c.includes("credit"));
  const balIdx    = cols.findIndex(c => c.includes("balance"));
  const creditIdx = cols.findIndex(c => c === "credit" || c.includes("money in"));
  const debitIdx  = cols.findIndex(c => c === "debit" || c.includes("money out"));

  const rows: ReturnType<typeof parseCSV> = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i].replace(/"/g, "");
    const cells = raw.split(",").map(c => c.trim());
    if (cells.every(c => !c)) continue;

    const dateRaw = dateIdx >= 0 ? cells[dateIdx] : "";
    // Try multiple date formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    let parsedDate: string;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateRaw)) {
      const [d, m, y] = dateRaw.split("/");
      parsedDate = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      parsedDate = dateRaw;
    } else {
      const d = new Date(dateRaw);
      parsedDate = isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0];
    }

    let amount = 0;
    if (creditIdx >= 0 && debitIdx >= 0) {
      const credit = parseFloat(cells[creditIdx]?.replace(/[£,]/g, "") || "0") || 0;
      const debit  = parseFloat(cells[debitIdx]?.replace(/[£,]/g, "") || "0") || 0;
      amount = credit - debit;
    } else if (amtIdx >= 0) {
      amount = parseFloat(cells[amtIdx]?.replace(/[£,]/g, "") || "0") || 0;
    }

    const balance = balIdx >= 0 ? parseFloat(cells[balIdx]?.replace(/[£,]/g, "") || "") || undefined : undefined;

    rows.push({
      date:        parsedDate,
      description: descIdx >= 0 ? cells[descIdx] || "Unknown" : "Unknown",
      reference:   refIdx >= 0 ? cells[refIdx] || "" : "",
      amount,
      balance,
    });
  }

  return rows;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReconcileModal({
  txn, invoices, projects, onClose, onSave,
}: {
  txn: BankTxn; invoices: Invoice[]; projects: Project[];
  onClose: () => void;
  onSave: (data: Parameters<typeof reconcileTransactionAction>[0]) => Promise<void>;
}) {
  const [mode, setMode] = useState<"invoice" | "overhead" | "unmatched">("invoice");
  const [invoiceId, setInvoiceId] = useState("");
  const [category, setCategory] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isCredit = txn.amount >= 0;

  async function handleSave() {
    setSaving(true);
    await onSave({
      bank_transaction_id: txn.id,
      invoice_id:  mode === "invoice" ? invoiceId || null : null,
      match_type:  mode === "unmatched" ? "unmatched" : "manual",
      category:    mode === "overhead" ? category : undefined,
      project_id:  mode === "overhead" ? projectId || null : null,
      notes:       notes || undefined,
    });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-white font-semibold">Reconcile Transaction</h3>
            <p className="text-slate-400 text-sm mt-0.5">{fmtDate(txn.transaction_date)} · {txn.description}</p>
          </div>
          <span className={`text-lg font-bold ${txn.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {txn.amount >= 0 ? "+" : ""}{fmt(txn.amount)}
          </span>
        </div>
        <div className="p-5 space-y-4">
          {/* Mode selector */}
          <div className="flex gap-2">
            {(isCredit ? [["invoice", "Match Invoice"], ["overhead", "Other Income"], ["unmatched", "Unmatched"]] as const
                       : [["overhead", "Expense"], ["unmatched", "Unmatched"]] as const
            ).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === m ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10"
                }`}>{label}</button>
            ))}
          </div>

          {mode === "invoice" && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Invoice</label>
              <select value={invoiceId} onChange={e => setInvoiceId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="">Select invoice…</option>
                {invoices.filter(i => i.status !== "Paid").map(inv => {
                  const p = projects.find(p => p.id === inv.project_id);
                  return (
                    <option key={inv.id} value={inv.id}>
                      {p?.name} — {inv.invoice_number ?? "Invoice"} — {fmt(inv.net_due ?? inv.amount)}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {mode === "overhead" && (
            <>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="">Select category…</option>
                  {OVERHEAD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Project (optional)</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  <option value="">No project</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="Any notes…" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-white/10">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm font-medium transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving || (mode === "invoice" && !invoiceId) || (mode === "overhead" && !category)}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AccountingClient({
  projects, invoices, transactions, reconciliation,
  vatPeriods, overheadCosts, projectExpenses, staffResources,
}: Props) {
  const [tab, setTab] = useState<"bank" | "pl" | "debtors" | "vat" | "overhead">("bank");
  const [reconcileTarget, setReconcileTarget] = useState<BankTxn | null>(null);
  const [autoMatchRunning, setAutoMatchRunning] = useState(false);
  const [autoMatchResult, setAutoMatchResult] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{ rows: ReturnType<typeof parseCSV>; filename: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [vatModal, setVatModal] = useState<Partial<VatPeriod> | null>(null);
  const [overheadModal, setOverheadModal] = useState<Partial<OverheadCost> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Build reconciliation map
  const recMap = new Map<string, ReconciliationRecord>();
  for (const r of reconciliation) recMap.set(r.bank_transaction_id, r);

  const unreconciledCount = transactions.filter(t => !recMap.has(t.id)).length;
  const reconciledCount = transactions.filter(t => recMap.has(t.id)).length;

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

  const totalOutstanding = invoices
    .filter(i => i.status !== "Paid")
    .reduce((s, i) => s + (i.net_due ?? i.amount), 0);

  const overheadThisMonth = overheadCosts
    .filter(o => o.cost_date >= monthStart)
    .reduce((s, o) => s + o.amount, 0);

  const nextVatDue = vatPeriods.find(v => v.status === "open");
  const vatDueAmount = nextVatDue ? nextVatDue.output_vat - nextVatDue.input_vat : 0;

  // ── CSV import ─────────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setImportPreview({ rows, filename: file.name });
    };
    reader.readAsText(file);
    e.target.value = "";
  }, []);

  async function confirmImport() {
    if (!importPreview) return;
    setImporting(true);
    const result = await importBankTransactionsAction(
      importPreview.rows.map(r => ({
        transaction_date: r.date,
        description:      r.description,
        reference:        r.reference,
        amount:           r.amount,
        balance:          r.balance,
      })),
      importPreview.filename
    );
    setImporting(false);
    setImportPreview(null);
    if (result.error) alert(result.error);
  }

  // ── Auto-match ─────────────────────────────────────────────────────────────

  async function runAutoMatch() {
    setAutoMatchRunning(true);
    setAutoMatchResult(null);
    try {
      const result = await autoMatchTransactionsAction();
      setAutoMatchResult(`Matched ${result.matched} transaction${result.matched !== 1 ? "s" : ""}`);
    } catch (err) {
      setAutoMatchResult(`Error: ${err instanceof Error ? err.message : "Auto-match failed"}`);
    } finally {
      setAutoMatchRunning(false);
    }
  }

  // ── Company P&L computation ────────────────────────────────────────────────

  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const revenueByMonth = new Map<string, number>();
  const directCostByMonth = new Map<string, number>();
  const overheadByMonth = new Map<string, number>();

  for (const inv of invoices.filter(i => i.status === "Paid" && i.paid_date)) {
    const mo = inv.paid_date!.substring(0, 7);
    revenueByMonth.set(mo, (revenueByMonth.get(mo) ?? 0) + (inv.net_due ?? inv.amount));
  }

  for (const exp of projectExpenses) {
    const mo = exp.cost_date.substring(0, 7);
    directCostByMonth.set(mo, (directCostByMonth.get(mo) ?? 0) + exp.amount);
  }

  for (const oc of overheadCosts) {
    const mo = oc.cost_date.substring(0, 7);
    overheadByMonth.set(mo, (overheadByMonth.get(mo) ?? 0) + oc.amount);
  }

  const totalRevenue12m = months.reduce((s, m) => s + (revenueByMonth.get(m) ?? 0), 0);
  const totalDirectCosts12m = months.reduce((s, m) => s + (directCostByMonth.get(m) ?? 0), 0);
  const totalOverhead12m = months.reduce((s, m) => s + (overheadByMonth.get(m) ?? 0), 0);
  const grossMargin12m = totalRevenue12m - totalDirectCosts12m;
  const netProfit12m = grossMargin12m - totalOverhead12m;
  const grossMarginPct = totalRevenue12m > 0 ? (grossMargin12m / totalRevenue12m) * 100 : 0;
  const netProfitPct = totalRevenue12m > 0 ? (netProfit12m / totalRevenue12m) * 100 : 0;

  // Overhead staff headcount
  const overheadStaff = staffResources.filter(s => s.staff_type === "overhead");
  const directStaff = staffResources.filter(s => s.staff_type === "direct_labour");

  // ── Aged Debtors ───────────────────────────────────────────────────────────

  const sentInvoices = invoices.filter(i => i.status !== "Paid");
  const bands: Record<string, Invoice[]> = { current: [], "1-30": [], "31-60": [], "61-90": [], "90+": [] };
  for (const inv of sentInvoices) {
    const band = ageband(inv.due_date, inv.status);
    if (band !== "paid") bands[band].push(inv);
  }

  const TABS = [
    { id: "bank", label: "Bank Reconciliation" },
    { id: "pl", label: "Company P&L" },
    { id: "debtors", label: "Aged Debtors" },
    { id: "vat", label: "VAT" },
    { id: "overhead", label: "Overhead Costs" },
  ] as const;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Accounting</h1>
          <p className="text-muted-foreground text-sm mt-1">Bank reconciliation, P&amp;L, aged debtors &amp; VAT</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Unreconciled", value: unreconciledCount.toString(), sub: `${reconciledCount} reconciled`, colour: unreconciledCount > 0 ? "text-amber-400" : "text-emerald-400" },
          { label: "Total Outstanding", value: fmt(totalOutstanding), sub: `${sentInvoices.length} invoices`, colour: totalOutstanding > 0 ? "text-amber-400" : "text-emerald-400" },
          { label: "Net Profit (12m)", value: fmt(netProfit12m), sub: `${netProfitPct.toFixed(1)}% margin`, colour: netProfit12m >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "VAT Due", value: nextVatDue ? fmt(vatDueAmount) : "—", sub: nextVatDue ? `Period ends ${fmtDate(nextVatDue.period_end)}` : "No open period", colour: vatDueAmount > 0 ? "text-amber-400" : "text-slate-400" },
        ].map(k => (
          <div key={k.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-xl font-bold mt-1 ${k.colour}`}>{k.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Bank Reconciliation ─────────────────────────────────────────────── */}
      {tab === "bank" && (
        <div className="space-y-4">
          {/* Actions bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileRef.current?.click()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all">
              Import CSV
            </button>
            <button onClick={runAutoMatch} disabled={autoMatchRunning}
              className="px-4 py-2 bg-white/8 hover:bg-white/12 text-slate-300 rounded-lg text-sm font-medium transition-all disabled:opacity-50">
              {autoMatchRunning ? "Matching…" : "Auto-Match"}
            </button>
            {autoMatchResult && (
              <span className="text-sm text-emerald-400">{autoMatchResult}</span>
            )}
          </div>

          {/* Import preview */}
          {importPreview && (
            <div className="bg-card border border-blue-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Preview: {importPreview.filename}</h3>
                <span className="text-sm text-slate-400">{importPreview.rows.length} rows</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-slate-500 text-xs">
                    <th className="text-left pb-1">Date</th>
                    <th className="text-left pb-1">Description</th>
                    <th className="text-right pb-1">Amount</th>
                  </tr></thead>
                  <tbody>
                    {importPreview.rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="py-1 text-slate-400">{r.date}</td>
                        <td className="py-1 text-slate-300 truncate max-w-xs">{r.description}</td>
                        <td className={`py-1 text-right font-mono ${r.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {r.amount >= 0 ? "+" : ""}{fmt(r.amount)}
                        </td>
                      </tr>
                    ))}
                    {importPreview.rows.length > 20 && (
                      <tr><td colSpan={3} className="py-1 text-center text-slate-500 text-xs">+{importPreview.rows.length - 20} more rows</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setImportPreview(null)}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-sm transition-all">Cancel</button>
                <button onClick={confirmImport} disabled={importing}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50">
                  {importing ? "Importing…" : `Import ${importPreview.rows.length} rows`}
                </button>
              </div>
            </div>
          )}

          {/* Transactions table */}
          {transactions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <p className="text-muted-foreground text-sm">No bank transactions yet. Import a CSV to get started.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-left p-3 hidden md:table-cell">Reference</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-left p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(txn => {
                    const rec = recMap.get(txn.id);
                    const inv = rec?.invoice_id ? invoices.find(i => i.id === rec.invoice_id) : null;
                    const proj = rec?.project_id ? projects.find(p => p.id === rec.project_id) :
                                 inv ? projects.find(p => p.id === inv.project_id) : null;
                    return (
                      <tr key={txn.id} className="border-t border-border hover:bg-white/2 transition-colors">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(txn.transaction_date)}</td>
                        <td className="p-3 text-foreground max-w-xs truncate">{txn.description}</td>
                        <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">{txn.reference ?? "—"}</td>
                        <td className={`p-3 text-right font-mono font-medium ${txn.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {txn.amount >= 0 ? "+" : ""}{fmt(txn.amount)}
                        </td>
                        <td className="p-3">
                          {rec ? (
                            <div className="space-y-0.5">
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                                rec.match_type === "auto" ? "bg-blue-500/15 text-blue-400" :
                                rec.match_type === "unmatched" ? "bg-slate-500/15 text-slate-400" :
                                "bg-emerald-500/15 text-emerald-400"
                              }`}>
                                {rec.match_type === "auto" ? "Auto" : rec.match_type === "unmatched" ? "Unmatched" : "Reconciled"}
                                {rec.match_confidence && ` ${Math.round(rec.match_confidence * 100)}%`}
                              </span>
                              {inv && <p className="text-xs text-muted-foreground">{inv.invoice_number}</p>}
                              {rec.category && <p className="text-xs text-muted-foreground">{rec.category}</p>}
                              {proj && <p className="text-xs text-muted-foreground">{proj.name}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-amber-400">Unreconciled</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setReconcileTarget(txn)}
                              className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-all">
                              {rec ? "Edit" : "Match"}
                            </button>
                            {rec && (
                              <button onClick={() => unreconcileTransactionAction(txn.id)}
                                className="px-2 py-1 text-xs bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-all">
                                Unmatch
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Company P&L ─────────────────────────────────────────────────────── */}
      {tab === "pl" && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Revenue (12m)", value: fmt(totalRevenue12m), colour: "text-emerald-400" },
              { label: "Direct Costs (12m)", value: fmt(totalDirectCosts12m), colour: "text-red-400" },
              { label: "Gross Margin", value: `${fmt(grossMargin12m)} (${grossMarginPct.toFixed(1)}%)`, colour: grossMarginPct >= 20 ? "text-emerald-400" : "text-amber-400" },
              { label: "Overhead (12m)", value: fmt(totalOverhead12m), colour: "text-amber-400" },
              { label: "Net Profit (12m)", value: `${fmt(netProfit12m)} (${netProfitPct.toFixed(1)}%)`, colour: netProfit12m >= 0 ? "text-emerald-400" : "text-red-400" },
              { label: "Overhead Staff", value: `${overheadStaff.length} head office / ${directStaff.length} direct`, colour: "text-slate-300" },
            ].map(k => (
              <div key={k.label} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-bold mt-1 ${k.colour}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Monthly breakdown table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Monthly Breakdown (last 12 months)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left p-3">Month</th>
                    <th className="text-right p-3">Revenue</th>
                    <th className="text-right p-3">Direct Costs</th>
                    <th className="text-right p-3">Gross Margin</th>
                    <th className="text-right p-3">Overhead</th>
                    <th className="text-right p-3">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => {
                    const rev = revenueByMonth.get(m) ?? 0;
                    const dir = directCostByMonth.get(m) ?? 0;
                    const ov = overheadByMonth.get(m) ?? 0;
                    const gm = rev - dir;
                    const np = gm - ov;
                    const [y, mo] = m.split("-");
                    const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
                    return (
                      <tr key={m} className="border-t border-border hover:bg-white/2">
                        <td className="p-3 text-muted-foreground font-medium">{label}</td>
                        <td className="p-3 text-right font-mono text-emerald-400">{rev > 0 ? fmt(rev) : "—"}</td>
                        <td className="p-3 text-right font-mono text-red-400">{dir > 0 ? fmt(dir) : "—"}</td>
                        <td className={`p-3 text-right font-mono ${gm > 0 ? "text-emerald-400" : gm < 0 ? "text-red-400" : "text-slate-500"}`}>{rev > 0 || dir > 0 ? fmt(gm) : "—"}</td>
                        <td className="p-3 text-right font-mono text-amber-400">{ov > 0 ? fmt(ov) : "—"}</td>
                        <td className={`p-3 text-right font-mono font-semibold ${np > 0 ? "text-emerald-400" : np < 0 ? "text-red-400" : "text-slate-500"}`}>{(rev > 0 || ov > 0) ? fmt(np) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border">
                  <tr className="font-semibold text-foreground">
                    <td className="p-3">Total</td>
                    <td className="p-3 text-right font-mono text-emerald-400">{fmt(totalRevenue12m)}</td>
                    <td className="p-3 text-right font-mono text-red-400">{fmt(totalDirectCosts12m)}</td>
                    <td className={`p-3 text-right font-mono ${grossMargin12m >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(grossMargin12m)}</td>
                    <td className="p-3 text-right font-mono text-amber-400">{fmt(totalOverhead12m)}</td>
                    <td className={`p-3 text-right font-mono ${netProfit12m >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(netProfit12m)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Aged Debtors ────────────────────────────────────────────────────── */}
      {tab === "debtors" && (
        <div className="space-y-4">
          {/* Band summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(["current", "1-30", "31-60", "61-90", "90+"] as const).map(band => {
              const invs = bands[band];
              const total = invs.reduce((s, i) => s + (i.net_due ?? i.amount), 0);
              return (
                <div key={band} className="bg-card border border-border rounded-xl p-4">
                  <p className={`text-xs font-medium ${BAND_COLOUR[band]}`}>
                    {band === "current" ? "Current" : `${band} days`}
                  </p>
                  <p className={`text-lg font-bold mt-1 ${BAND_COLOUR[band]}`}>{fmt(total)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{invs.length} invoice{invs.length !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>

          {/* Invoice list */}
          {sentInvoices.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <p className="text-muted-foreground text-sm">No outstanding invoices.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left p-3">Project</th>
                    <th className="text-left p-3">Invoice</th>
                    <th className="text-left p-3">Due Date</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-center p-3">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {(["90+", "61-90", "31-60", "1-30", "current"] as const)
                    .flatMap(band => bands[band].map(inv => ({ inv, band })))
                    .map(({ inv, band }) => {
                      const proj = projects.find(p => p.id === inv.project_id);
                      const daysOver = inv.due_date ? Math.max(0, daysSince(inv.due_date)) : 0;
                      return (
                        <tr key={inv.id} className="border-t border-border hover:bg-white/2">
                          <td className="p-3 text-foreground font-medium">{proj?.name ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{inv.invoice_number ?? `#${inv.period_number ?? "?"}`}</td>
                          <td className="p-3 text-muted-foreground">{inv.due_date ? fmtDate(inv.due_date) : "—"}</td>
                          <td className="p-3 text-right font-mono text-amber-400">{fmt(inv.net_due ?? inv.amount)}</td>
                          <td className={`p-3 text-center text-xs font-medium ${BAND_COLOUR[band]}`}>
                            {band === "current" ? "Current" : `${daysOver}d overdue`}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
                <tfoot className="border-t-2 border-border font-semibold">
                  <tr>
                    <td colSpan={3} className="p-3 text-foreground">Total Outstanding</td>
                    <td className="p-3 text-right font-mono text-amber-400">{fmt(totalOutstanding)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VAT ─────────────────────────────────────────────────────────────── */}
      {tab === "vat" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Manage VAT periods and track output vs input VAT.</p>
            <button onClick={() => setVatModal({})}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all">
              New Period
            </button>
          </div>

          {vatPeriods.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <p className="text-muted-foreground text-sm">No VAT periods yet. Create your first period to start tracking.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left p-3">Period</th>
                    <th className="text-right p-3">Output VAT</th>
                    <th className="text-right p-3">Input VAT</th>
                    <th className="text-right p-3">Net Due</th>
                    <th className="text-center p-3">Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {vatPeriods.map(vp => {
                    const netDue = vp.output_vat - vp.input_vat;
                    return (
                      <tr key={vp.id} className="border-t border-border hover:bg-white/2">
                        <td className="p-3 text-foreground">
                          {fmtDate(vp.period_start)} – {fmtDate(vp.period_end)}
                          {vp.period_key && <span className="ml-2 text-xs text-muted-foreground">{vp.period_key}</span>}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400">{fmt(vp.output_vat)}</td>
                        <td className="p-3 text-right font-mono text-red-400">{fmt(vp.input_vat)}</td>
                        <td className={`p-3 text-right font-mono font-semibold ${netDue > 0 ? "text-amber-400" : "text-emerald-400"}`}>{fmt(netDue)}</td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            vp.status === "submitted" ? "bg-emerald-500/15 text-emerald-400" :
                            vp.status === "paid" ? "bg-slate-500/15 text-slate-400" :
                            "bg-amber-500/15 text-amber-400"
                          }`}>{vp.status}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => setVatModal(vp)}
                              className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-all">Edit</button>
                            <button onClick={() => deleteVatPeriodAction(vp.id)}
                              className="px-2 py-1 text-xs bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-all">Del</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* VAT modal */}
          {vatModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <form className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-md p-5 space-y-4"
                onSubmit={async e => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  await upsertVatPeriodAction({
                    id: vatModal.id,
                    period_start: fd.get("period_start") as string,
                    period_end: fd.get("period_end") as string,
                    period_key: fd.get("period_key") as string || undefined,
                    output_vat: parseFloat(fd.get("output_vat") as string) || 0,
                    input_vat: parseFloat(fd.get("input_vat") as string) || 0,
                    status: fd.get("status") as string,
                    notes: fd.get("notes") as string || undefined,
                  });
                  setVatModal(null);
                }}>
                <h3 className="text-white font-semibold">{vatModal.id ? "Edit VAT Period" : "New VAT Period"}</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "period_start", label: "Period Start", type: "date", defaultValue: vatModal.period_start ?? "" },
                    { name: "period_end", label: "Period End", type: "date", defaultValue: vatModal.period_end ?? "" },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                      <input name={f.name} type={f.type} required defaultValue={f.defaultValue}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: "output_vat", label: "Output VAT (£)", defaultValue: vatModal.output_vat?.toString() ?? "0" },
                    { name: "input_vat", label: "Input VAT (£)", defaultValue: vatModal.input_vat?.toString() ?? "0" },
                  ].map(f => (
                    <div key={f.name}>
                      <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                      <input name={f.name} type="number" step="0.01" required defaultValue={f.defaultValue}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">HMRC Period Key</label>
                    <input name="period_key" defaultValue={vatModal.period_key ?? ""}
                      placeholder="e.g. 24A1"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Status</label>
                    <select name="status" defaultValue={vatModal.status ?? "open"}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                      <option value="open">Open</option>
                      <option value="submitted">Submitted</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notes</label>
                  <input name="notes" defaultValue={vatModal.notes ?? ""}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setVatModal(null)}
                    className="flex-1 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm font-medium transition-all">Cancel</button>
                  <button type="submit"
                    className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">Save</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Overhead Costs ───────────────────────────────────────────────────── */}
      {tab === "overhead" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-muted-foreground">
                Head office &amp; fixed costs. Direct labour: <span className="text-blue-400">{directStaff.length}</span> · Overhead staff: <span className="text-amber-400">{overheadStaff.length}</span>
              </p>
            </div>
            <button onClick={() => setOverheadModal({})}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all">
              Add Cost
            </button>
          </div>

          {/* Category summary */}
          {overheadCosts.length > 0 && (() => {
            const byCat = new Map<string, number>();
            for (const oc of overheadCosts) byCat.set(oc.category, (byCat.get(oc.category) ?? 0) + oc.amount);
            const total = Array.from(byCat.values()).reduce((s, v) => s + v, 0);
            return (
              <div className="bg-card border border-border rounded-xl p-4">
                <h3 className="text-sm font-medium text-foreground mb-3">By Category (all time)</h3>
                <div className="space-y-2">
                  {Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-36 truncate">{cat}</span>
                      <div className="flex-1 bg-white/5 rounded-full h-1.5">
                        <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${(amt / total) * 100}%` }} />
                      </div>
                      <span className="text-sm font-mono text-amber-400 w-24 text-right">{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border mt-3 pt-3 flex justify-between">
                  <span className="text-sm font-medium text-foreground">Total</span>
                  <span className="text-sm font-mono font-bold text-amber-400">{fmt(total)}</span>
                </div>
              </div>
            );
          })()}

          {overheadCosts.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <p className="text-muted-foreground text-sm">No overhead costs yet.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">Description</th>
                    <th className="text-left p-3 hidden md:table-cell">Supplier</th>
                    <th className="text-right p-3">Amount</th>
                    <th className="text-right p-3 hidden md:table-cell">VAT</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {overheadCosts.map(oc => (
                    <tr key={oc.id} className="border-t border-border hover:bg-white/2">
                      <td className="p-3 text-muted-foreground whitespace-nowrap">{fmtDate(oc.cost_date)}</td>
                      <td className="p-3"><span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{oc.category}</span></td>
                      <td className="p-3 text-foreground">{oc.description}</td>
                      <td className="p-3 text-muted-foreground hidden md:table-cell">{oc.supplier ?? "—"}</td>
                      <td className="p-3 text-right font-mono text-amber-400">{fmt(oc.amount)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground hidden md:table-cell">{oc.vat_amount > 0 ? fmt(oc.vat_amount) : "—"}</td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setOverheadModal(oc)}
                            className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 text-slate-300 rounded transition-all">Edit</button>
                          <button onClick={() => deleteOverheadCostAction(oc.id)}
                            className="px-2 py-1 text-xs bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded transition-all">Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Overhead modal */}
          {overheadModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <form className="bg-[#1a1a1a] border border-white/10 rounded-xl w-full max-w-md p-5 space-y-4"
                onSubmit={async e => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  await upsertOverheadCostAction({
                    id: overheadModal.id,
                    cost_date:   fd.get("cost_date") as string,
                    category:    fd.get("category") as string,
                    description: fd.get("description") as string,
                    amount:      parseFloat(fd.get("amount") as string) || 0,
                    vat_amount:  parseFloat(fd.get("vat_amount") as string) || 0,
                    supplier:    fd.get("supplier") as string || undefined,
                    reference:   fd.get("reference") as string || undefined,
                    notes:       fd.get("notes") as string || undefined,
                  });
                  setOverheadModal(null);
                }}>
                <h3 className="text-white font-semibold">{overheadModal.id ? "Edit Cost" : "Add Overhead Cost"}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Date</label>
                    <input name="cost_date" type="date" required defaultValue={overheadModal.cost_date ?? new Date().toISOString().split("T")[0]}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Category</label>
                    <select name="category" required defaultValue={overheadModal.category ?? ""}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                      <option value="">Select…</option>
                      {OVERHEAD_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Description</label>
                  <input name="description" required defaultValue={overheadModal.description ?? ""}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Amount (£ ex VAT)</label>
                    <input name="amount" type="number" step="0.01" required defaultValue={overheadModal.amount?.toString() ?? ""}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">VAT (£)</label>
                    <input name="vat_amount" type="number" step="0.01" defaultValue={overheadModal.vat_amount?.toString() ?? "0"}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Supplier</label>
                    <input name="supplier" defaultValue={overheadModal.supplier ?? ""}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Reference</label>
                    <input name="reference" defaultValue={overheadModal.reference ?? ""}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setOverheadModal(null)}
                    className="flex-1 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm font-medium transition-all">Cancel</button>
                  <button type="submit"
                    className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">Save</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Reconcile modal */}
      {reconcileTarget && (
        <ReconcileModal
          txn={reconcileTarget}
          invoices={invoices}
          projects={projects}
          onClose={() => setReconcileTarget(null)}
          onSave={async data => { await reconcileTransactionAction(data); }}
        />
      )}
    </div>
  );
}
