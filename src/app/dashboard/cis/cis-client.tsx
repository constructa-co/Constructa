"use client";

import { useState, useMemo } from "react";
import { HardHat, Plus, ChevronDown, ChevronUp, Trash2, CheckCircle, AlertCircle, Clock, X } from "lucide-react";
import {
  addSubcontractorAction,
  updateSubcontractorAction,
  recordPaymentAction,
  deletePaymentAction,
  markStatementSentAction,
  saveCisSettingsAction,
} from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Profile {
  company_name: string | null;
  cis_registered: boolean;
  cis_contractor_utr: string | null;
  cis_paye_reference: string | null;
  cis_accounts_office_ref: string | null;
}

interface Subcontractor {
  id: string;
  name: string;
  trading_name: string | null;
  utr: string | null;
  company_number: string | null;
  verification_number: string | null;
  cis_status: "gross" | "standard" | "higher" | "unverified";
  last_verified_at: string | null;
  is_active: boolean;
  notes: string | null;
}

interface Payment {
  id: string;
  project_id: string | null;
  subcontractor_id: string;
  payment_date: string;
  gross_payment: number;
  materials_amount: number;
  labour_amount: number;
  deduction_rate: number;
  deduction_amount: number;
  net_payment: number;
  tax_month_start: string;
  statement_sent: boolean;
  description: string | null;
  cis_subcontractors: { name: string } | null;
}

interface Project {
  id: string;
  name: string;
}

interface Props {
  profile: Profile;
  subcontractors: Subcontractor[];
  payments: Payment[];
  projects: Project[];
}

type Tab = "overview" | "subcontractors" | "payments" | "returns";

// ── Helpers ────────────────────────────────────────────────────────────────────

function gbp(n: number): string {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function taxMonthLabel(start: string): string {
  const d = new Date(start);
  const end = new Date(d);
  end.setMonth(end.getMonth() + 1);
  end.setDate(5);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function statusBadge(status: Subcontractor["cis_status"]) {
  const map = {
    gross:       { label: "Gross (0%)",    cls: "bg-emerald-900/50 text-emerald-300 border border-emerald-800" },
    standard:    { label: "Standard (20%)", cls: "bg-blue-900/50 text-blue-300 border border-blue-800" },
    higher:      { label: "Higher (30%)",   cls: "bg-amber-900/50 text-amber-300 border border-amber-800" },
    unverified:  { label: "Unverified",     cls: "bg-red-900/50 text-red-300 border border-red-800" },
  };
  const { label, cls } = map[status] ?? map.unverified;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}

function deductionRate(status: Subcontractor["cis_status"]): number {
  if (status === "gross") return 0;
  if (status === "higher") return 30;
  if (status === "standard") return 20;
  return 20;
}

// ── Subcontractor form ─────────────────────────────────────────────────────────

function SubcontractorForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Subcontractor;
  onSave: (data: Parameters<typeof addSubcontractorAction>[0] & { is_active: boolean }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [tradingName, setTradingName] = useState(initial?.trading_name ?? "");
  const [utr, setUtr] = useState(initial?.utr ?? "");
  const [companyNumber, setCompanyNumber] = useState(initial?.company_number ?? "");
  const [cisStatus, setCisStatus] = useState<Subcontractor["cis_status"]>(initial?.cis_status ?? "unverified");
  const [verificationNumber, setVerificationNumber] = useState(initial?.verification_number ?? "");
  const [lastVerifiedAt, setLastVerifiedAt] = useState(initial?.last_verified_at ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    await onSave({ name, trading_name: tradingName, utr, company_number: companyNumber, cis_status: cisStatus, verification_number: verificationNumber, last_verified_at: lastVerifiedAt, notes, is_active: isActive });
    setSaving(false);
  }

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500";
  const labelCls = "block text-xs text-slate-400 mb-1";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Legal Name *</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Smith & Sons Ltd" />
        </div>
        <div>
          <label className={labelCls}>Trading Name</label>
          <input className={inputCls} value={tradingName} onChange={e => setTradingName(e.target.value)} placeholder="If different from legal name" />
        </div>
        <div>
          <label className={labelCls}>UTR (Unique Taxpayer Reference)</label>
          <input className={inputCls} value={utr} onChange={e => setUtr(e.target.value)} placeholder="1234567890" maxLength={10} />
        </div>
        <div>
          <label className={labelCls}>Companies House Number</label>
          <input className={inputCls} value={companyNumber} onChange={e => setCompanyNumber(e.target.value)} placeholder="12345678 (if limited company)" />
        </div>
        <div>
          <label className={labelCls}>CIS Status</label>
          <select className={inputCls} value={cisStatus} onChange={e => setCisStatus(e.target.value as Subcontractor["cis_status"])}>
            <option value="unverified">Unverified — do not pay until verified</option>
            <option value="gross">Gross — pay in full (0% deduction)</option>
            <option value="standard">Standard — 20% deduction</option>
            <option value="higher">Higher — 30% deduction</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>HMRC Verification Reference</label>
          <input className={inputCls} value={verificationNumber} onChange={e => setVerificationNumber(e.target.value)} placeholder="V123456789" />
        </div>
        <div>
          <label className={labelCls}>Last Verified Date</label>
          <input type="date" className={inputCls} value={lastVerifiedAt} onChange={e => setLastVerifiedAt(e.target.value)} />
        </div>
        {initial && (
          <div className="flex items-center gap-3 pt-4">
            <input type="checkbox" id="is_active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 rounded" />
            <label htmlFor="is_active" className="text-sm text-slate-300">Active subcontractor</label>
          </div>
        )}
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea className={inputCls + " h-16 resize-none"} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-md">
          {saving ? "Saving…" : (initial ? "Save Changes" : "Add Subcontractor")}
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-md border border-slate-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Payment form ───────────────────────────────────────────────────────────────

function PaymentForm({
  subcontractors,
  projects,
  onSave,
  onCancel,
}: {
  subcontractors: Subcontractor[];
  projects: Project[];
  onSave: (data: Parameters<typeof recordPaymentAction>[0]) => Promise<void>;
  onCancel: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [projectId, setProjectId] = useState("");
  const [subId, setSubId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [grossPayment, setGrossPayment] = useState("");
  const [materialsAmount, setMaterialsAmount] = useState("0");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedSub = subcontractors.find(s => s.id === subId);
  const gross = parseFloat(grossPayment) || 0;
  const materials = parseFloat(materialsAmount) || 0;
  const labour = Math.max(0, gross - materials);
  const rate = selectedSub ? deductionRate(selectedSub.cis_status) : 20;
  const deduction = Math.round(labour * rate) / 100;
  const net = gross - deduction;

  async function handleSave() {
    if (!subId) { setError("Select a subcontractor"); return; }
    if (!gross) { setError("Enter gross payment amount"); return; }
    if (materials > gross) { setError("Materials cannot exceed gross payment"); return; }
    setSaving(true);
    setError("");
    await onSave({
      project_id: projectId,
      subcontractor_id: subId,
      payment_date: paymentDate,
      gross_payment: gross,
      materials_amount: materials,
      deduction_rate: rate,
      description,
    });
    setSaving(false);
  }

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500";
  const labelCls = "block text-xs text-slate-400 mb-1";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Subcontractor *</label>
          <select className={inputCls} value={subId} onChange={e => setSubId(e.target.value)}>
            <option value="">— select —</option>
            {subcontractors.filter(s => s.is_active).map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.cis_status === "gross" ? "Gross" : s.cis_status === "standard" ? "20%" : s.cis_status === "higher" ? "30%" : "Unverified"})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Project (optional)</label>
          <select className={inputCls} value={projectId} onChange={e => setProjectId(e.target.value)}>
            <option value="">— no project —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Payment Date *</label>
          <input type="date" className={inputCls} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Gross Payment (£) *</label>
          <input type="number" className={inputCls} value={grossPayment} onChange={e => setGrossPayment(e.target.value)} placeholder="0.00" min="0" step="0.01" />
        </div>
        <div>
          <label className={labelCls}>Materials Element (£)</label>
          <input type="number" className={inputCls} value={materialsAmount} onChange={e => setMaterialsAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" />
          <p className="text-xs text-slate-500 mt-1">CIS deduction only applies to the labour element</p>
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <input className={inputCls} value={description} onChange={e => setDescription(e.target.value)} placeholder="Work description" />
        </div>
      </div>

      {/* Deduction preview */}
      {gross > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-1">Labour</p>
            <p className="text-white font-semibold">{gbp(labour)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Deduction ({rate}%)</p>
            <p className="text-red-400 font-semibold">–{gbp(deduction)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">Net Payment</p>
            <p className="text-emerald-400 font-semibold">{gbp(net)}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">CIS Status</p>
            {selectedSub ? statusBadge(selectedSub.cis_status) : <span className="text-slate-500 text-xs">—</span>}
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-md">
          {saving ? "Saving…" : "Record Payment"}
        </button>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2 rounded-md border border-slate-700">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CisClient({ profile, subcontractors, payments, projects }: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [showAddSub, setShowAddSub] = useState(false);
  const [editSub, setEditSub] = useState<Subcontractor | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [expandedReturn, setExpandedReturn] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsData, setSettingsData] = useState({
    cis_registered: profile.cis_registered,
    cis_contractor_utr: profile.cis_contractor_utr ?? "",
    cis_paye_reference: profile.cis_paye_reference ?? "",
    cis_accounts_office_ref: profile.cis_accounts_office_ref ?? "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState("");

  // ── Derived data ─────────────────────────────────────────────────────────────

  const totalDeductionsYTD = useMemo(() => {
    const now = new Date();
    const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6); // April 6
    return payments
      .filter(p => new Date(p.payment_date) >= fyStart)
      .reduce((s, p) => s + (p.deduction_amount ?? 0), 0);
  }, [payments]);

  const totalPaidYTD = useMemo(() => {
    const now = new Date();
    const fyStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6);
    return payments
      .filter(p => new Date(p.payment_date) >= fyStart)
      .reduce((s, p) => s + (p.gross_payment ?? 0), 0);
  }, [payments]);

  // Group payments by tax month for returns view
  const returnsByMonth = useMemo(() => {
    const map = new Map<string, Payment[]>();
    payments.forEach(p => {
      const key = p.tax_month_start;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });
    // Sort descending
    return Array.from(map.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [payments]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleAddSub(data: Parameters<typeof addSubcontractorAction>[0] & { is_active: boolean }) {
    const res = await addSubcontractorAction(data);
    if (!res.error) setShowAddSub(false);
  }

  async function handleEditSub(data: Parameters<typeof addSubcontractorAction>[0] & { is_active: boolean }) {
    if (!editSub) return;
    const res = await updateSubcontractorAction(editSub.id, data);
    if (!res.error) setEditSub(null);
  }

  async function handleAddPayment(data: Parameters<typeof recordPaymentAction>[0]) {
    const res = await recordPaymentAction(data);
    if (!res.error) setShowAddPayment(false);
  }

  async function handleDeletePayment(id: string) {
    setDeletingPaymentId(id);
    await deletePaymentAction(id);
    setDeletingPaymentId(null);
  }

  async function handleMarkSent(taxMonthStart: string) {
    const ids = payments.filter(p => p.tax_month_start === taxMonthStart).map(p => p.id);
    await markStatementSentAction(ids);
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsError("");
    const res = await saveCisSettingsAction(settingsData);
    if (res.error) setSettingsError(res.error);
    else setShowSettings(false);
    setSavingSettings(false);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "subcontractors", label: "Subcontractors" },
    { id: "payments", label: "Payment Records" },
    { id: "returns", label: "Monthly Returns" },
  ];

  const inputCls = "w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500";
  const labelCls = "block text-xs text-slate-400 mb-1";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <HardHat className="w-5 h-5 text-slate-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">CIS Compliance</h1>
              <p className="text-sm text-slate-400">UK Construction Industry Scheme — subcontractor deductions</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="text-sm text-slate-400 hover:text-slate-200 border border-slate-700 px-3 py-1.5 rounded-md"
          >
            CIS Settings
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-4 bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Your CIS Registration</h3>
              <button onClick={() => setShowSettings(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="cis_reg"
                checked={settingsData.cis_registered}
                onChange={e => setSettingsData(d => ({ ...d, cis_registered: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="cis_reg" className="text-sm text-slate-300">Registered as CIS contractor with HMRC</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Contractor UTR</label>
                <input className={inputCls} value={settingsData.cis_contractor_utr} onChange={e => setSettingsData(d => ({ ...d, cis_contractor_utr: e.target.value }))} placeholder="10-digit UTR" />
              </div>
              <div>
                <label className={labelCls}>PAYE Reference</label>
                <input className={inputCls} value={settingsData.cis_paye_reference} onChange={e => setSettingsData(d => ({ ...d, cis_paye_reference: e.target.value }))} placeholder="123/AB456" />
              </div>
              <div>
                <label className={labelCls}>Accounts Office Reference</label>
                <input className={inputCls} value={settingsData.cis_accounts_office_ref} onChange={e => setSettingsData(d => ({ ...d, cis_accounts_office_ref: e.target.value }))} placeholder="123PA00012345" />
              </div>
            </div>
            {settingsError && <p className="text-red-400 text-sm">{settingsError}</p>}
            <button onClick={handleSaveSettings} disabled={savingSettings} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-md">
              {savingSettings ? "Saving…" : "Save Settings"}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 -mb-5 border-b border-slate-800">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
                tab === t.id
                  ? "text-white border-blue-500 bg-slate-800/50"
                  : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6 max-w-6xl">

        {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* KPI strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Active Subcontractors", value: subcontractors.filter(s => s.is_active).length.toString(), sub: `${subcontractors.length} total registered` },
                { label: "Deductions YTD", value: `£${totalDeductionsYTD.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`, sub: "This tax year (from 6 Apr)" },
                { label: "Gross Paid YTD", value: `£${totalPaidYTD.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`, sub: "To all subcontractors" },
                {
                  label: "Unverified",
                  value: subcontractors.filter(s => s.cis_status === "unverified" && s.is_active).length.toString(),
                  sub: "Action required",
                  warn: subcontractors.some(s => s.cis_status === "unverified" && s.is_active),
                },
              ].map((k, i) => (
                <div key={i} className={`bg-slate-900 border rounded-lg p-4 ${k.warn ? "border-amber-700/60" : "border-slate-800"}`}>
                  <p className="text-xs text-slate-400 mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.warn ? "text-amber-400" : "text-white"}`}>{k.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Unverified warning */}
            {subcontractors.some(s => s.cis_status === "unverified" && s.is_active) && (
              <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Unverified subcontractors on your register</p>
                  <p className="text-sm text-amber-400/80 mt-0.5">
                    You must verify subcontractors with HMRC before making payments. Paying an unverified subcontractor requires a 30% deduction.
                  </p>
                  <button onClick={() => setTab("subcontractors")} className="text-sm text-amber-300 underline mt-1">
                    Go to Subcontractors →
                  </button>
                </div>
              </div>
            )}

            {/* Recent payments */}
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Payments</h2>
              {payments.length === 0 ? (
                <p className="text-slate-500 text-sm">No payments recorded yet.</p>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="text-left px-4 py-3">Date</th>
                        <th className="text-left px-4 py-3">Subcontractor</th>
                        <th className="text-right px-4 py-3">Gross</th>
                        <th className="text-right px-4 py-3">Deduction</th>
                        <th className="text-right px-4 py-3">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.slice(0, 8).map(p => (
                        <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-4 py-3 text-slate-300">{fmtDate(p.payment_date)}</td>
                          <td className="px-4 py-3 text-slate-200">{p.cis_subcontractors?.name ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{gbp(p.gross_payment)}</td>
                          <td className="px-4 py-3 text-right text-red-400">–{gbp(p.deduction_amount ?? 0)}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">{gbp(p.net_payment ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {payments.length > 8 && (
                    <div className="px-4 py-3 border-t border-slate-800">
                      <button onClick={() => setTab("payments")} className="text-xs text-slate-400 hover:text-slate-200">
                        View all {payments.length} payments →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* How CIS works */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">How CIS works</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  <p><span className="text-slate-300 font-medium">Verify first.</span> Call HMRC (0300 200 3210) or use the HMRC CIS online service to verify each subcontractor before their first payment.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <p><span className="text-slate-300 font-medium">Deduct & pay.</span> Deduct 0%, 20% or 30% from the labour element of each payment. Pay the deduction to HMRC by the 19th of the following month.</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <p><span className="text-slate-300 font-medium">File monthly return.</span> Submit your CIS300 monthly return to HMRC by the 19th. Issue a deduction statement to each subcontractor you deducted from.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SUBCONTRACTORS TAB ────────────────────────────────────────────── */}
        {tab === "subcontractors" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Subcontractor Register</h2>
              <button
                onClick={() => { setShowAddSub(true); setEditSub(null); }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-md"
              >
                <Plus className="w-4 h-4" /> Add Subcontractor
              </button>
            </div>

            {(showAddSub && !editSub) && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-200 mb-4">New Subcontractor</h3>
                <SubcontractorForm onSave={handleAddSub} onCancel={() => setShowAddSub(false)} />
              </div>
            )}

            {subcontractors.length === 0 && !showAddSub ? (
              <div className="text-center py-16 text-slate-500">
                <HardHat className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No subcontractors registered yet.</p>
                <p className="text-xs mt-1">Add subcontractors before recording payments.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {subcontractors.map(s => (
                  <div key={s.id} className={`bg-slate-900 border rounded-lg ${s.is_active ? "border-slate-800" : "border-slate-800/40 opacity-60"}`}>
                    {editSub?.id === s.id ? (
                      <div className="p-5">
                        <h3 className="text-sm font-semibold text-slate-200 mb-4">Edit: {s.name}</h3>
                        <SubcontractorForm initial={s} onSave={handleEditSub} onCancel={() => setEditSub(null)} />
                      </div>
                    ) : (
                      <div className="p-4 flex flex-wrap items-start gap-4 justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-white">{s.name}</span>
                            {s.trading_name && <span className="text-xs text-slate-500">t/a {s.trading_name}</span>}
                            {statusBadge(s.cis_status)}
                            {!s.is_active && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">Inactive</span>}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
                            {s.utr && <span>UTR: <span className="text-slate-300">{s.utr}</span></span>}
                            {s.company_number && <span>Co. No: <span className="text-slate-300">{s.company_number}</span></span>}
                            {s.verification_number && <span>Verified: <span className="text-slate-300">{s.verification_number}</span></span>}
                            {s.last_verified_at && <span>Last check: <span className="text-slate-300">{fmtDate(s.last_verified_at)}</span></span>}
                          </div>
                          {s.cis_status === "unverified" && (
                            <p className="mt-2 text-xs text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Verify with HMRC before making payments — unverified rate is 30%
                            </p>
                          )}
                          {s.notes && <p className="mt-2 text-xs text-slate-500">{s.notes}</p>}
                        </div>
                        <button
                          onClick={() => setEditSub(s)}
                          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 px-3 py-1.5 rounded-md shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PAYMENTS TAB ──────────────────────────────────────────────────── */}
        {tab === "payments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Payment Records</h2>
              <button
                onClick={() => setShowAddPayment(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-md"
                disabled={subcontractors.filter(s => s.is_active).length === 0}
              >
                <Plus className="w-4 h-4" /> Record Payment
              </button>
            </div>

            {subcontractors.filter(s => s.is_active).length === 0 && (
              <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 text-sm text-amber-300">
                Add subcontractors to the register before recording payments.
              </div>
            )}

            {showAddPayment && (
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-200 mb-4">Record CIS Payment</h3>
                <PaymentForm subcontractors={subcontractors} projects={projects} onSave={handleAddPayment} onCancel={() => setShowAddPayment(false)} />
              </div>
            )}

            {payments.length === 0 && !showAddPayment ? (
              <div className="text-center py-16 text-slate-500">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No payments recorded yet.</p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400">
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Subcontractor</th>
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Description</th>
                      <th className="text-right px-4 py-3">Gross</th>
                      <th className="text-right px-4 py-3 hidden sm:table-cell">Labour</th>
                      <th className="text-right px-4 py-3">Deduction</th>
                      <th className="text-right px-4 py-3">Net</th>
                      <th className="px-4 py-3 hidden sm:table-cell"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{fmtDate(p.payment_date)}</td>
                        <td className="px-4 py-3 text-slate-200">{p.cis_subcontractors?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{p.description ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-slate-300">{gbp(p.gross_payment)}</td>
                        <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{gbp(p.labour_amount ?? 0)}</td>
                        <td className="px-4 py-3 text-right">
                          {(p.deduction_amount ?? 0) > 0
                            ? <span className="text-red-400">–{gbp(p.deduction_amount ?? 0)}</span>
                            : <span className="text-emerald-400/70 text-xs">Nil</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-400">{gbp(p.net_payment ?? 0)}</td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell">
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            disabled={deletingPaymentId === p.id}
                            className="text-slate-600 hover:text-red-400 disabled:opacity-40"
                            title="Delete payment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 text-sm font-semibold">
                      <td colSpan={3} className="px-4 py-3 text-slate-400">Total ({payments.length} payments)</td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {gbp(payments.reduce((s, p) => s + p.gross_payment, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">
                        {gbp(payments.reduce((s, p) => s + (p.labour_amount ?? 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-red-400">
                        –{gbp(payments.reduce((s, p) => s + (p.deduction_amount ?? 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400">
                        {gbp(payments.reduce((s, p) => s + (p.net_payment ?? 0), 0))}
                      </td>
                      <td className="hidden sm:table-cell" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── MONTHLY RETURNS TAB ───────────────────────────────────────────── */}
        {tab === "returns" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-blue-900/20 border border-blue-700/40 rounded-lg p-4">
              <Clock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-blue-300 font-medium">CIS Monthly Return (CIS300)</p>
                <p className="text-blue-400/80 mt-0.5">
                  Submit to HMRC by <strong>the 19th of each month</strong> covering the tax month from the 6th to the 5th.
                  Send a deduction statement to each subcontractor you made deductions from.
                </p>
              </div>
            </div>

            {returnsByMonth.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <p className="text-sm">No payment records yet — returns will appear here once payments are recorded.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {returnsByMonth.map(([taxMonthStart, monthPayments]) => {
                  const totalGross = monthPayments.reduce((s, p) => s + p.gross_payment, 0);
                  const totalDeduction = monthPayments.reduce((s, p) => s + (p.deduction_amount ?? 0), 0);
                  const totalNet = monthPayments.reduce((s, p) => s + (p.net_payment ?? 0), 0);
                  const allSent = monthPayments.every(p => p.statement_sent);
                  const isExpanded = expandedReturn === taxMonthStart;

                  // Due date: 19th of the month AFTER the tax month ends (tax month ends on the 5th)
                  const taxMonthDate = new Date(taxMonthStart);
                  const dueDate = new Date(taxMonthDate.getFullYear(), taxMonthDate.getMonth() + 1, 19);
                  const isOverdue = dueDate < new Date() && !allSent;

                  // Aggregate by subcontractor for this month
                  const bySubMap = new Map<string, { name: string; gross: number; deduction: number; net: number; payments: Payment[] }>();
                  monthPayments.forEach(p => {
                    const name = p.cis_subcontractors?.name ?? p.subcontractor_id;
                    if (!bySubMap.has(p.subcontractor_id)) {
                      bySubMap.set(p.subcontractor_id, { name, gross: 0, deduction: 0, net: 0, payments: [] });
                    }
                    const entry = bySubMap.get(p.subcontractor_id)!;
                    entry.gross += p.gross_payment;
                    entry.deduction += p.deduction_amount ?? 0;
                    entry.net += p.net_payment ?? 0;
                    entry.payments.push(p);
                  });
                  const bySub = Array.from(bySubMap.values());

                  return (
                    <div key={taxMonthStart} className={`bg-slate-900 border rounded-lg overflow-hidden ${isOverdue ? "border-red-700/60" : "border-slate-800"}`}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-800/40"
                        onClick={() => setExpandedReturn(isExpanded ? null : taxMonthStart)}
                      >
                        <div className="flex items-center gap-4 flex-wrap">
                          <div>
                            <p className="text-sm font-semibold text-white">{taxMonthLabel(taxMonthStart)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{monthPayments.length} payment{monthPayments.length !== 1 ? "s" : ""} · {bySub.length} subcontractor{bySub.length !== 1 ? "s" : ""}</p>
                          </div>
                          {allSent
                            ? <span className="text-xs bg-emerald-900/50 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Statements sent</span>
                            : isOverdue
                            ? <span className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Overdue</span>
                            : <span className="text-xs bg-amber-900/50 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> Due {dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                          }
                        </div>
                        <div className="flex items-center gap-6 text-sm shrink-0 ml-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-400">Gross</p>
                            <p className="text-slate-200">{gbp(totalGross)}</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-400">Deduction</p>
                            <p className="text-red-400">{gbp(totalDeduction)}</p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-400">Net Paid</p>
                            <p className="text-emerald-400">{gbp(totalNet)}</p>
                          </div>
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-800 px-5 py-4 space-y-4">
                          {/* Per-subcontractor summary for HMRC return */}
                          <div>
                            <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">CIS300 Return Summary</p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-slate-400 border-b border-slate-800">
                                  <th className="text-left pb-2">Subcontractor</th>
                                  <th className="text-right pb-2">Gross Payment</th>
                                  <th className="text-right pb-2">Materials</th>
                                  <th className="text-right pb-2">Labour</th>
                                  <th className="text-right pb-2">Deduction</th>
                                  <th className="text-right pb-2">Net</th>
                                </tr>
                              </thead>
                              <tbody>
                                {bySub.map((sub, i) => {
                                  const materials = sub.payments.reduce((s, p) => s + p.materials_amount, 0);
                                  const labour = sub.gross - materials;
                                  return (
                                    <tr key={i} className="border-b border-slate-800/50">
                                      <td className="py-2 text-slate-200">{sub.name}</td>
                                      <td className="py-2 text-right text-slate-300">{gbp(sub.gross)}</td>
                                      <td className="py-2 text-right text-slate-400">{gbp(materials)}</td>
                                      <td className="py-2 text-right text-slate-400">{gbp(labour)}</td>
                                      <td className="py-2 text-right text-red-400">{gbp(sub.deduction)}</td>
                                      <td className="py-2 text-right text-emerald-400">{gbp(sub.net)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-slate-700 font-semibold text-sm">
                                  <td className="pt-2 text-slate-300">Total</td>
                                  <td className="pt-2 text-right text-slate-200">{gbp(totalGross)}</td>
                                  <td className="pt-2 text-right text-slate-400">{gbp(monthPayments.reduce((s, p) => s + p.materials_amount, 0))}</td>
                                  <td className="pt-2 text-right text-slate-400">{gbp(monthPayments.reduce((s, p) => s + (p.labour_amount ?? 0), 0))}</td>
                                  <td className="pt-2 text-right text-red-400">–{gbp(totalDeduction)}</td>
                                  <td className="pt-2 text-right text-emerald-400">{gbp(totalNet)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* Actions */}
                          {!allSent && (
                            <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                              <button
                                onClick={() => handleMarkSent(taxMonthStart)}
                                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-md"
                              >
                                <CheckCircle className="w-4 h-4" /> Mark statements sent
                              </button>
                              <p className="text-xs text-slate-500">Once you have sent deduction statements to all subcontractors this month</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
