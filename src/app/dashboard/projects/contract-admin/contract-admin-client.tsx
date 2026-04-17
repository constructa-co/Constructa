"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  FileText,
  MessageSquare,
  Shield,
  LayoutDashboard,
  ChevronRight,
  Trash2,
  Wand2,
  Loader2,
  GitBranch,
  Bell,
  BookOpen,
  Send,
  Download,
  X,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import {
  CONTRACTS_CONFIG,
  CONTRACT_TYPE_OPTIONS,
  ContractType,
  obligationRag,
  daysUntil,
} from "@/lib/contracts-config";
import {
  setupContractAction,
  raiseEventAction,
  updateObligationAction,
  updateEventAction,
  logCommunicationAction,
  deleteCommunicationAction,
  draftNoticeAction,
  raiseClaimAction,
  updateClaimAction,
  draftClaimAction,
  createSupervisorTokenAction,
  runDelayAnalysisAction,
  draftDelayNarrativeAction,
  type DelayMethodology,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project { id: string; name: string; client_name?: string | null; start_date?: string | null; end_date?: string | null; potential_value?: number | null; }
interface ContractSettings { id: string; project_id: string; contract_type: string; contract_option?: string | null; award_date: string; start_date?: string | null; completion_date?: string | null; parties: Record<string,string>; contract_value?: number | null; notes?: string | null; }
interface Obligation { id: string; event_id?: string | null; obligation_type: string; label: string; clause_ref?: string | null; party: string; due_date: string; status: string; notes?: string | null; }
interface ContractEvent { id: string; event_type: string; reference?: string | null; raised_by: string; date_raised: string; date_aware?: string | null; time_bar_date?: string | null; status: string; title: string; description?: string | null; assessed_time?: number | null; assessed_cost?: number | null; agreed_time?: number | null; agreed_cost?: number | null; drafted_notice?: string | null; }
interface Communication { id: string; event_id?: string | null; direction: string; comm_date: string; reference?: string | null; subject: string; body?: string | null; from_party?: string | null; to_party?: string | null; }
interface Claim { id: string; event_id?: string | null; claim_type: string; reference?: string | null; title: string; status: string; time_claimed?: number | null; cost_claimed?: number | null; time_agreed?: number | null; cost_agreed?: number | null; ai_narrative?: string | null; notes?: string | null; created_at: string; }
interface Variation { id: string; description: string; status: string; amount?: number | null; created_at: string; }
interface ScheduleItem { id: string; name: string; start_date?: string | null; end_date?: string | null; progress?: number | null; }
interface Expense { id: string; category?: string | null; amount: number; date?: string | null; }

interface Props {
  projectId: string;
  project: Project | null;
  projects: Project[];
  contractSettings: ContractSettings | null;
  obligations: Obligation[];
  events: ContractEvent[];
  communications: Communication[];
  claims: Claim[];
  variations: Variation[];
  scheduleItems: ScheduleItem[];
  expenses: Expense[];
  // P1-5 — canonical computeContractSum result from the active estimate,
  // used to pre-fill the setup form. 0 if no active estimate exists.
  canonicalContractSum: number;
}

const TABS = [
  { key: "dashboard",    label: "Dashboard",       icon: LayoutDashboard },
  { key: "obligations",  label: "Obligations",     icon: Clock },
  { key: "events",       label: "Events",          icon: Bell },
  { key: "comms",        label: "Communications",  icon: MessageSquare },
  { key: "claims",       label: "Claims",          icon: Shield },
  { key: "delay",        label: "Delay Analysis",  icon: GitBranch },
] as const;
type Tab = (typeof TABS)[number]["key"];

const CLAIM_TYPES = [
  { value: "ce_notification",  label: "CE Notification" },
  { value: "eot",              label: "Extension of Time" },
  { value: "loss_and_expense", label: "Loss & Expense" },
  { value: "prolongation",     label: "Prolongation Costs" },
  { value: "disruption",       label: "Disruption / Productivity" },
  { value: "adjudication",     label: "Adjudication Bundle" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

function RagBadge({ dueDate, status }: { dueDate: string; status: string }) {
  const rag = obligationRag(dueDate, status);
  if (rag === "done") return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-700 text-slate-400">Done</span>;
  const d = daysUntil(dueDate);
  const colour = rag === "red" ? "bg-red-600/20 text-red-400" : rag === "amber" ? "bg-amber-600/20 text-amber-400" : "bg-green-600/20 text-green-400";
  const label = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? "Due today" : `${d}d`;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colour}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string,string> = {
    open: "bg-blue-600/20 text-blue-400",
    agreed: "bg-green-600/20 text-green-400",
    closed: "bg-slate-700 text-slate-400",
    rejected: "bg-red-600/20 text-red-400",
    withdrawn: "bg-slate-700 text-slate-400",
    draft: "bg-amber-600/20 text-amber-400",
    submitted: "bg-blue-600/20 text-blue-400",
    under_review: "bg-purple-600/20 text-purple-400",
    disputed: "bg-red-600/20 text-red-400",
    adjudication: "bg-red-600/20 text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${colours[status] ?? "bg-slate-700 text-slate-400"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Setup Form ───────────────────────────────────────────────────────────────

function ContractSetupForm({ projectId, project, canonicalContractSum, onSaved }: {
  projectId: string;
  project: Project | null;
  canonicalContractSum: number;
  onSaved: () => void;
}) {
  // P1-5 — pre-fill contract_value from the canonical contractSum if the
  // project has been priced, otherwise fall back to the lead-stage
  // potential_value. This keeps Contract Admin aligned with Billing,
  // Overview, Final Account, and everywhere else.
  const prefillContractValue = canonicalContractSum > 0
    ? canonicalContractSum.toString()
    : (project?.potential_value?.toString() ?? "");

  const [form, setForm] = useState({
    contractType: "NEC4_ECC" as ContractType,
    contractOption: "A",
    awardDate: new Date().toISOString().split("T")[0],
    startDate: project?.start_date?.split("T")[0] ?? "",
    completionDate: project?.end_date?.split("T")[0] ?? "",
    contractValue: prefillContractValue,
    pm: "", pmOrg: "", employer: project?.client_name ?? "", employerOrg: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const config = CONTRACTS_CONFIG[form.contractType];
  const grouped = CONTRACT_TYPE_OPTIONS.reduce((acc, o) => {
    acc[o.suite] = [...(acc[o.suite] ?? []), o];
    return acc;
  }, {} as Record<string, typeof CONTRACT_TYPE_OPTIONS>);

  const save = async () => {
    setSaving(true);
    const res = await setupContractAction({
      projectId,
      contractType: form.contractType,
      contractOption: form.contractOption || undefined,
      awardDate: form.awardDate,
      startDate: form.startDate || undefined,
      completionDate: form.completionDate || undefined,
      contractValue: form.contractValue ? parseFloat(form.contractValue) : undefined,
      parties: { pm: form.pm, pm_org: form.pmOrg, employer: form.employer, employer_org: form.employerOrg },
      notes: form.notes || undefined,
    });
    setSaving(false);
    if (res.error) toast.error(res.error);
    else { toast.success("Contract set up — obligations seeded"); onSaved(); }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white/3 border border-white/10 rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-white">Set Up Contract</h2>
        <p className="text-xs text-slate-400 mt-1">Select the contract form and enter key dates. Obligations will be seeded automatically.</p>
      </div>

      {/* Contract type */}
      <div>
        <label className="block text-xs text-slate-400 mb-1">Contract Form</label>
        <select value={form.contractType} onChange={e => setForm(f => ({ ...f, contractType: e.target.value as ContractType, contractOption: CONTRACTS_CONFIG[e.target.value as ContractType].options[0]?.value ?? "" }))}
          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
          {(["NEC", "JCT", "FIDIC", "BESPOKE"] as const).map(suite => (
            <optgroup key={suite} label={suite}>
              {grouped[suite]?.map(o => <option key={o.value} value={o.value} className="bg-[#1a1a1a]">{o.label}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Option / flavour */}
      {config.options.length > 1 && (
        <div>
          <label className="block text-xs text-slate-400 mb-1">{config.suite === "NEC" ? "Main Option" : "Contract Variant"}</label>
          <select value={form.contractOption} onChange={e => setForm(f => ({ ...f, contractOption: e.target.value }))}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
            {config.options.map(o => <option key={o.value} value={o.value} className="bg-[#1a1a1a]">{o.label}</option>)}
          </select>
        </div>
      )}

      {/* Key dates */}
      <div className="grid grid-cols-3 gap-3">
        {[["awardDate","Award Date"],["startDate","Start on Site"],["completionDate","Completion Date"]].map(([field, label]) => (
          <div key={field}>
            <label className="block text-xs text-slate-400 mb-1">{label}</label>
            <input type="date" value={form[field as keyof typeof form]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Contract Value (£)</label>
        <input type="number" value={form.contractValue} onChange={e => setForm(f => ({ ...f, contractValue: e.target.value }))} placeholder="0"
          className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">{config.terminology.supervisor} Name</label>
          <input value={form.pm} onChange={e => setForm(f => ({ ...f, pm: e.target.value }))} placeholder={`e.g. John Smith`}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{config.terminology.supervisor} Organisation</label>
          <input value={form.pmOrg} onChange={e => setForm(f => ({ ...f, pmOrg: e.target.value }))} placeholder="e.g. Turner & Townsend"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{config.terminology.employer}</label>
          <input value={form.employer} onChange={e => setForm(f => ({ ...f, employer: e.target.value }))} placeholder="e.g. ABC Developments Ltd"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{config.terminology.employer} Organisation</label>
          <input value={form.employerOrg} onChange={e => setForm(f => ({ ...f, employerOrg: e.target.value }))}
            className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <button onClick={save} disabled={saving || !form.awardDate}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
        Set Up Contract & Seed Obligations
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ContractAdminClient({ projectId, project, projects, contractSettings, obligations, events, communications, claims, variations, scheduleItems, expenses, canonicalContractSum }: Props) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey(k => k + 1);

  // ── Modals / forms state ──
  const [showSetup, setShowSetup] = useState(!contractSettings);
  const [showRaiseEvent, setShowRaiseEvent] = useState(false);
  const [showLogComm, setShowLogComm] = useState(false);
  const [showRaiseClaim, setShowRaiseClaim] = useState(false);
  const [draftingEventId, setDraftingEventId] = useState<string | null>(null);
  const [draftingClaimId, setDraftingClaimId] = useState<string | null>(null);
  const [viewingNotice, setViewingNotice] = useState<ContractEvent | null>(null);
  const [viewingClaim, setViewingClaim] = useState<Claim | null>(null);
  const [saving, setSaving] = useState(false);

  const config = contractSettings ? CONTRACTS_CONFIG[contractSettings.contract_type as ContractType] : null;
  const term = config?.terminology;

  // ── Raise event form ──
  const [eventForm, setEventForm] = useState({
    eventType: config ? Object.keys(config.events)[0] : "compensation_event",
    raisedBy: "contractor",
    dateRaised: new Date().toISOString().split("T")[0],
    dateAware: "",
    title: "",
    description: "",
  });

  // ── Log comm form ──
  const [commForm, setCommForm] = useState({
    direction: "received",
    commDate: new Date().toISOString().split("T")[0],
    reference: "",
    subject: "",
    body: "",
    fromParty: "",
    toParty: "",
    eventId: "",
  });

  // ── Raise claim form ──
  const [claimForm, setClaimForm] = useState({
    claimType: "ce_notification",
    title: "",
    timeClaimed: "",
    costClaimed: "",
    notes: "",
  });

  // ── Dashboard aggregates ──
  const overdueCount = obligations.filter(o => obligationRag(o.due_date, o.status) === "red").length;
  const dueSoonCount = obligations.filter(o => obligationRag(o.due_date, o.status) === "amber").length;
  const openEvents = events.filter(e => e.status === "open").length;
  const timeBarsAtRisk = events.filter(e => {
    if (!e.time_bar_date) return false;
    const d = daysUntil(e.time_bar_date);
    return d >= 0 && d <= 14;
  });

  // ── Raise event ──
  const handleRaiseEvent = async () => {
    if (!contractSettings || !eventForm.title) return;
    setSaving(true);
    const config = CONTRACTS_CONFIG[contractSettings.contract_type as ContractType];
    const eventKeys = Object.keys(config.events);
    const eventCount = events.filter(e => e.event_type === eventForm.eventType).length;
    const ec = config.events[eventForm.eventType];
    const ref = `${ec.shortLabel}-${String(eventCount + 1).padStart(3, "0")}`;
    const res = await raiseEventAction({
      projectId,
      contractType: contractSettings.contract_type as ContractType,
      eventType: eventForm.eventType,
      raisedBy: eventForm.raisedBy,
      dateRaised: eventForm.dateRaised,
      dateAware: eventForm.dateAware || undefined,
      title: eventForm.title,
      description: eventForm.description || undefined,
      reference: ref,
    });
    setSaving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success(`${ec.label} raised — ${ref} — obligation chain created`);
      setShowRaiseEvent(false);
      setEventForm(f => ({ ...f, title: "", description: "", dateAware: "" }));
    }
  };

  // ── Log communication ──
  const handleLogComm = async () => {
    if (!commForm.subject) return;
    setSaving(true);
    const res = await logCommunicationAction({
      projectId,
      direction: commForm.direction,
      commDate: commForm.commDate,
      reference: commForm.reference || undefined,
      subject: commForm.subject,
      body: commForm.body || undefined,
      fromParty: commForm.fromParty || undefined,
      toParty: commForm.toParty || undefined,
      eventId: commForm.eventId || undefined,
    });
    setSaving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Communication logged");
      setShowLogComm(false);
      setCommForm(f => ({ ...f, subject: "", body: "", reference: "", fromParty: "", toParty: "", eventId: "" }));
    }
  };

  // ── Raise claim ──
  const handleRaiseClaim = async () => {
    if (!claimForm.title) return;
    setSaving(true);
    const res = await raiseClaimAction({
      projectId,
      claimType: claimForm.claimType,
      title: claimForm.title,
      timeClaimed: claimForm.timeClaimed ? parseInt(claimForm.timeClaimed) : undefined,
      costClaimed: claimForm.costClaimed ? parseFloat(claimForm.costClaimed) : undefined,
      notes: claimForm.notes || undefined,
    });
    setSaving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success(`Claim ${res.reference} created`);
      setShowRaiseClaim(false);
      setClaimForm(f => ({ ...f, title: "", timeClaimed: "", costClaimed: "", notes: "" }));
    }
  };

  // ── Draft notice ──
  const handleDraftNotice = async (event: ContractEvent) => {
    if (!contractSettings) return;
    setDraftingEventId(event.id);
    const res = await draftNoticeAction({
      projectId,
      contractType: contractSettings.contract_type as ContractType,
      eventType: event.event_type,
      eventId: event.id,
      eventTitle: event.title,
      eventDescription: event.description ?? undefined,
      dateRaised: event.date_raised,
      dateAware: event.date_aware ?? undefined,
      timeBarDate: event.time_bar_date ?? undefined,
      reference: event.reference ?? undefined,
      projectName: project?.name ?? "",
      clientName: project?.client_name ?? undefined,
      contractValue: contractSettings.contract_value ?? undefined,
      parties: contractSettings.parties,
      relevantVariations: variations.map(v => ({ description: v.description, amount: v.amount ?? undefined })),
      programmeDates: scheduleItems.map(s => ({ task: s.name, planned: s.start_date ?? "", actual: s.progress === 100 ? s.end_date ?? undefined : undefined })),
      recentCosts: expenses.map(e => ({ category: e.category ?? "Cost", amount: e.amount })),
    });
    setDraftingEventId(null);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Notice drafted — review and edit before sending");
      setViewingNotice({ ...event, drafted_notice: res.notice });
    }
  };

  // ── Draft claim ──
  const handleDraftClaim = async (claim: Claim) => {
    if (!contractSettings) return;
    setDraftingClaimId(claim.id);
    const res = await draftClaimAction({
      claimId: claim.id,
      projectId,
      contractType: contractSettings.contract_type as ContractType,
      claimType: claim.claim_type,
      claimTitle: claim.title,
      projectName: project?.name ?? "",
      clientName: project?.client_name ?? undefined,
      contractValue: contractSettings.contract_value ?? undefined,
      parties: contractSettings.parties,
      timeClaimed: claim.time_claimed ?? undefined,
      costClaimed: claim.cost_claimed ?? undefined,
      variations: variations.map(v => ({ description: v.description, status: v.status, amount: v.amount ?? undefined })),
      programmeDates: scheduleItems.map(s => ({ task: s.name, planned: s.start_date ?? "", actual: s.progress === 100 ? s.end_date ?? undefined : undefined })),
      costs: expenses.map(e => ({ category: e.category ?? "Cost", amount: e.amount })),
      communications: communications.map(c => ({ date: c.comm_date, subject: c.subject, direction: c.direction })),
    });
    setDraftingClaimId(null);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Claim drafted by AI — review and edit");
      setViewingClaim({ ...claim, ai_narrative: res.narrative });
    }
  };

  if (showSetup || !contractSettings) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
        <div className="px-6 py-4 border-b border-white/10">
          <h1 className="text-xl font-bold text-white">Contract Administration</h1>
          <p className="text-sm text-slate-400 mt-0.5">{project?.name}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <ContractSetupForm projectId={projectId} project={project} canonicalContractSum={canonicalContractSum} onSaved={() => setShowSetup(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white">Contract Administration</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {project?.name} · <span className="text-blue-400">{config?.shortLabel}</span>
            {contractSettings.contract_option && <span className="text-slate-500"> Option {contractSettings.contract_option}</span>}
            {contractSettings.contract_value && <span className="text-slate-500"> · {fmt(contractSettings.contract_value)}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "events" && (
            <button onClick={() => setShowRaiseEvent(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Raise {term?.mainEvent}
            </button>
          )}
          {tab === "comms" && (
            <button onClick={() => setShowLogComm(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Log Communication
            </button>
          )}
          {tab === "claims" && (
            <button onClick={() => setShowRaiseClaim(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> New Claim
            </button>
          )}
          <button onClick={() => setShowSetup(true)} className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg text-xs font-medium transition-colors">
            <Shield className="w-3.5 h-3.5" /> Re-configure
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-white/10 px-6 bg-[#0d0d0d]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-blue-500 text-blue-400" : "border-transparent text-slate-400 hover:text-slate-200"}`}>
            <Icon className="w-4 h-4" />{label}
            {key === "obligations" && overdueCount > 0 && <span className="ml-1 w-4 h-4 flex items-center justify-center bg-red-600 rounded-full text-[9px] text-white font-bold">{overdueCount}</span>}
            {key === "events" && openEvents > 0 && <span className="ml-1 w-4 h-4 flex items-center justify-center bg-blue-600 rounded-full text-[9px] text-white font-bold">{openEvents}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── Dashboard ── */}
        {tab === "dashboard" && (
          <div className="space-y-5">
            {/* Time bar warnings */}
            {timeBarsAtRisk.length > 0 && (
              <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-semibold text-red-400">Time Bar Warning</span>
                </div>
                {timeBarsAtRisk.map(e => {
                  const d = daysUntil(e.time_bar_date!);
                  return (
                    <div key={e.id} className="flex items-center justify-between py-2 border-t border-red-600/20">
                      <div>
                        <p className="text-sm text-white font-medium">{e.reference} — {e.title}</p>
                        <p className="text-xs text-red-300">Time bar expires in <span className="font-bold">{d} day{d !== 1 ? "s" : ""}</span> — you may lose entitlement if not notified</p>
                      </div>
                      <button onClick={() => { setTab("events"); }} className="text-xs text-red-400 hover:text-red-300 underline">View</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Overdue Obligations", value: overdueCount, colour: overdueCount > 0 ? "red" : "slate", icon: AlertTriangle },
                { label: "Due This Week", value: dueSoonCount, colour: dueSoonCount > 0 ? "amber" : "slate", icon: Clock },
                { label: "Open Events", value: openEvents, colour: "blue", icon: Bell },
                { label: "Active Claims", value: claims.filter(c => c.status !== "agreed").length, colour: "purple", icon: Shield },
              ].map(({ label, value, colour, icon: Icon }) => (
                <div key={label} className="bg-white/3 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 text-${colour}-400`} />
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</span>
                  </div>
                  <p className={`text-2xl font-bold text-${colour}-400`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Contract details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/3 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Contract Details</h3>
                <div className="space-y-2 text-xs">
                  {[
                    ["Form", config?.label],
                    ["Option", contractSettings.contract_option ? config?.options.find(o => o.value === contractSettings.contract_option)?.label : "—"],
                    ["Award Date", new Date(contractSettings.award_date).toLocaleDateString("en-GB")],
                    ["Start Date", contractSettings.start_date ? new Date(contractSettings.start_date).toLocaleDateString("en-GB") : "—"],
                    ["Completion", contractSettings.completion_date ? new Date(contractSettings.completion_date).toLocaleDateString("en-GB") : "—"],
                    ["Contract Value", contractSettings.contract_value ? fmt(contractSettings.contract_value) : "—"],
                    [term?.supervisor ?? "Supervisor", contractSettings.parties.pm ? `${contractSettings.parties.pm}${contractSettings.parties.pm_org ? ` (${contractSettings.parties.pm_org})` : ""}` : "—"],
                    [term?.employer ?? "Employer", contractSettings.parties.employer ?? "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <span className="text-slate-500">{k}</span>
                      <span className="text-slate-200 text-right max-w-[200px] truncate">{v ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming obligations */}
              <div className="bg-white/3 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Next Obligations</h3>
                <div className="space-y-2">
                  {obligations
                    .filter(o => o.status === "pending")
                    .slice(0, 6)
                    .map(o => (
                      <div key={o.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-slate-200 truncate">{o.label}</p>
                          <p className="text-[10px] text-slate-500">{o.clause_ref} · {o.party}</p>
                        </div>
                        <RagBadge dueDate={o.due_date} status={o.status} />
                      </div>
                    ))}
                  {obligations.filter(o => o.status === "pending").length === 0 && (
                    <p className="text-xs text-slate-500">All obligations complete</p>
                  )}
                </div>
              </div>
            </div>

            {/* Payment cycle info */}
            {config && (
              <div className="bg-white/3 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Payment Cycle</h3>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-slate-500 mb-1">Frequency</p>
                    <p className="text-white capitalize">{config.payment.frequency.replace("_", " ")}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Certification</p>
                    <p className="text-white">{config.payment.certificationDays} days (cl. {config.payment.clauseRef})</p>
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1">Payment</p>
                    <p className="text-white">Within {config.payment.paymentDays} days</p>
                  </div>
                </div>
              </div>
            )}

            {/* Supervisor portal invite */}
            {project && <SupervisorInvite projectId={project.id} />}
          </div>
        )}

        {/* ── Obligations ── */}
        {tab === "obligations" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">Obligations ({obligations.length})</h2>
              <div className="flex gap-2 text-xs text-slate-400">
                <span className="text-red-400 font-medium">{overdueCount} overdue</span>
                <span className="text-amber-400 font-medium">{dueSoonCount} due soon</span>
              </div>
            </div>
            <div className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/5">
                  {["Obligation", "Clause", "Party", "Due Date", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {obligations.map(o => (
                    <tr key={o.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                      <td className="px-4 py-3 text-xs text-slate-200 max-w-[280px]">
                        <p className="truncate">{o.label}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{o.clause_ref ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 capitalize">{o.party}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">{new Date(o.due_date).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3"><RagBadge dueDate={o.due_date} status={o.status} /></td>
                      <td className="px-4 py-3">
                        {o.status !== "complete" && (
                          <button onClick={async () => {
                            const res = await updateObligationAction(o.id, "complete");
                            if (res.error) toast.error(res.error); else toast.success("Marked complete");
                          }} className="text-xs text-slate-400 hover:text-green-400 transition-colors">
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {obligations.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-xs">No obligations — set up contract to seed them</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Events ── */}
        {tab === "events" && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white">Events ({events.length})</h2>
            {events.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 border border-dashed border-white/10 rounded-xl text-slate-500 text-sm">
                No events raised yet
              </div>
            ) : events.map(event => {
              const ec = config?.events[event.event_type];
              const obligationChain = obligations.filter(o => o.event_id === event.id);
              return (
                <div key={event.id} className="bg-white/3 border border-white/10 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-blue-400 font-semibold">{event.reference}</span>
                        <span className="text-sm font-semibold text-white truncate">{event.title}</span>
                        <StatusBadge status={event.status} />
                        {event.time_bar_date && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${daysUntil(event.time_bar_date) <= 7 ? "bg-red-600/20 text-red-400" : daysUntil(event.time_bar_date) <= 21 ? "bg-amber-600/20 text-amber-400" : "bg-slate-700 text-slate-400"}`}>
                            Time bar: {new Date(event.time_bar_date).toLocaleDateString("en-GB")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{ec?.label} · Raised {new Date(event.date_raised).toLocaleDateString("en-GB")} by {event.raised_by}</p>
                      {event.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{event.description}</p>}

                      {/* Obligation chain */}
                      {obligationChain.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {obligationChain.map((o, i) => (
                            <div key={o.id} className="flex items-center gap-2 text-xs">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${obligationRag(o.due_date, o.status) === "red" ? "bg-red-500" : obligationRag(o.due_date, o.status) === "amber" ? "bg-amber-500" : obligationRag(o.due_date, o.status) === "done" ? "bg-slate-600" : "bg-green-500"}`} />
                              <span className={o.status === "complete" ? "text-slate-600 line-through" : "text-slate-300"}>{o.label}</span>
                              <RagBadge dueDate={o.due_date} status={o.status} />
                              {o.status !== "complete" && (
                                <button onClick={async () => {
                                  const res = await updateObligationAction(o.id, "complete");
                                  if (res.error) toast.error(res.error); else toast.success("Done");
                                }} className="text-slate-600 hover:text-green-400 transition-colors ml-auto">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-1.5 ml-3 flex-shrink-0">
                      <button
                        onClick={() => draftingEventId === event.id ? null : handleDraftNotice(event)}
                        disabled={draftingEventId === event.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/20 text-purple-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {draftingEventId === event.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Draft Notice
                      </button>
                      {event.drafted_notice && (
                        <button onClick={() => setViewingNotice(event)} className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-xs transition-colors">
                          <Eye className="w-3 h-3" /> View
                        </button>
                      )}
                      {event.status === "open" && (
                        <button onClick={async () => {
                          const res = await updateEventAction(event.id, { status: "agreed" });
                          if (res.error) toast.error(res.error); else toast.success("Event closed");
                        }} className="p-1.5 bg-white/5 hover:bg-green-600/20 text-slate-400 hover:text-green-400 rounded-lg transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Communications ── */}
        {tab === "comms" && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white">Communications Register ({communications.length})</h2>
            <div className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/5">
                  {["Date", "Ref", "Direction", "Subject", "From", "To", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {communications.map(c => (
                    <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/2">
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{new Date(c.comm_date).toLocaleDateString("en-GB")}</td>
                      <td className="px-4 py-3 text-xs font-mono text-blue-400">{c.reference ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.direction === "sent" ? "bg-blue-600/20 text-blue-400" : "bg-green-600/20 text-green-400"}`}>
                          {c.direction === "sent" ? <><Send className="w-2.5 h-2.5 inline mr-1" />Sent</> : <><Download className="w-2.5 h-2.5 inline mr-1" />Received</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-200 max-w-[220px] truncate">{c.subject}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{c.from_party ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{c.to_party ?? "—"}</td>
                      <td className="px-4 py-3">
                        <button onClick={async () => {
                          try {
                            await deleteCommunicationAction(c.id);
                            toast.success("Deleted");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Delete failed");
                          }
                        }} className="text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {communications.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-xs">No communications logged yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Claims ── */}
        {tab === "claims" && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-white">Claims ({claims.length})</h2>
            {claims.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 border border-dashed border-white/10 rounded-xl text-slate-500 text-sm">
                No claims raised
              </div>
            ) : claims.map(claim => (
              <div key={claim.id} className="bg-white/3 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-purple-400 font-semibold">{claim.reference}</span>
                      <span className="text-sm font-semibold text-white">{claim.title}</span>
                      <StatusBadge status={claim.status} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 capitalize">{claim.claim_type.replace(/_/g, " ")}</p>
                    <div className="flex gap-4 mt-2 text-xs text-slate-400">
                      {claim.time_claimed != null && <span>Time: <span className="text-white">{claim.time_claimed} days</span></span>}
                      {claim.cost_claimed != null && <span>Cost: <span className="text-white">{fmt(claim.cost_claimed)}</span></span>}
                      {claim.cost_agreed != null && <span>Agreed: <span className="text-green-400">{fmt(claim.cost_agreed)}</span></span>}
                    </div>
                    {claim.ai_narrative && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">{claim.ai_narrative.slice(0, 200)}…</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 ml-3 flex-shrink-0">
                    <button
                      onClick={() => draftingClaimId === claim.id ? null : handleDraftClaim(claim)}
                      disabled={draftingClaimId === claim.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/20 text-purple-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {draftingClaimId === claim.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      AI Draft
                    </button>
                    {claim.ai_narrative && (
                      <button onClick={() => setViewingClaim(claim)} className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-xs transition-colors">
                        <BookOpen className="w-3 h-3" /> View
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Raise Event Modal ── */}
      {showRaiseEvent && config && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-white">Raise {term?.mainEvent}</h3>
              <button onClick={() => setShowRaiseEvent(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Event Type</label>
              <select value={eventForm.eventType} onChange={e => setEventForm(f => ({ ...f, eventType: e.target.value }))}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                {Object.entries(config.events).map(([k, v]) => (
                  <option key={k} value={k} className="bg-[#1a1a1a]">{v.label}</option>
                ))}
              </select>
            </div>

            {config.events[eventForm.eventType]?.contractorTimeBarDays && (
              <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3 text-xs text-amber-300">
                <strong>Time bar:</strong> You must notify this {config.events[eventForm.eventType].label} within {config.events[eventForm.eventType].contractorTimeBarDays} days of becoming aware (cl. {config.events[eventForm.eventType].timeBarClause}). Enter the date you became aware below.
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date Raised</label>
                <input type="date" value={eventForm.dateRaised} onChange={e => setEventForm(f => ({ ...f, dateRaised: e.target.value }))}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              {config.events[eventForm.eventType]?.contractorTimeBarDays && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date Became Aware</label>
                  <input type="date" value={eventForm.dateAware} onChange={e => setEventForm(f => ({ ...f, dateAware: e.target.value }))}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Raised By</label>
              <select value={eventForm.raisedBy} onChange={e => setEventForm(f => ({ ...f, raisedBy: e.target.value }))}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                <option value="contractor" className="bg-[#1a1a1a]">Contractor</option>
                <option value="supervisor" className="bg-[#1a1a1a]">{term?.supervisor}</option>
                <option value="employer" className="bg-[#1a1a1a]">{term?.employer}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Title / Description</label>
              <input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief description of the event"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Detail (optional)</label>
              <textarea rows={3} value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} placeholder="Full description, cause, impact…"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
            </div>

            <button onClick={handleRaiseEvent} disabled={saving || !eventForm.title}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              Raise Event & Create Obligation Chain
            </button>
          </div>
        </div>
      )}

      {/* ── Log Communication Modal ── */}
      {showLogComm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-white">Log Communication</h3>
              <button onClick={() => setShowLogComm(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Direction</label>
                <select value={commForm.direction} onChange={e => setCommForm(f => ({ ...f, direction: e.target.value }))}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="received" className="bg-[#1a1a1a]">Received</option>
                  <option value="sent" className="bg-[#1a1a1a]">Sent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date</label>
                <input type="date" value={commForm.commDate} onChange={e => setCommForm(f => ({ ...f, commDate: e.target.value }))}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Reference</label>
                <input value={commForm.reference} onChange={e => setCommForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. PM/001"
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Linked Event (optional)</label>
                <select value={commForm.eventId} onChange={e => setCommForm(f => ({ ...f, eventId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="" className="bg-[#1a1a1a]">None</option>
                  {events.map(e => <option key={e.id} value={e.id} className="bg-[#1a1a1a]">{e.reference} — {e.title}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Subject</label>
              <input value={commForm.subject} onChange={e => setCommForm(f => ({ ...f, subject: e.target.value }))} placeholder="Re: Compensation Event CE-001"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">From</label>
                <input value={commForm.fromParty} onChange={e => setCommForm(f => ({ ...f, fromParty: e.target.value }))}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">To</label>
                <input value={commForm.toParty} onChange={e => setCommForm(f => ({ ...f, toParty: e.target.value }))}
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <textarea rows={2} value={commForm.body} onChange={e => setCommForm(f => ({ ...f, body: e.target.value }))} placeholder="Summary or key points…"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
            </div>

            <button onClick={handleLogComm} disabled={saving || !commForm.subject}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
              Log Communication
            </button>
          </div>
        </div>
      )}

      {/* ── Raise Claim Modal ── */}
      {showRaiseClaim && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-white">New Claim</h3>
              <button onClick={() => setShowRaiseClaim(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Claim Type</label>
              <select value={claimForm.claimType} onChange={e => setClaimForm(f => ({ ...f, claimType: e.target.value }))}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500">
                {CLAIM_TYPES.map(ct => <option key={ct.value} value={ct.value} className="bg-[#1a1a1a]">{ct.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Claim Title</label>
              <input value={claimForm.title} onChange={e => setClaimForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. EOT claim — employer delay to access"
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Time Claimed (days)</label>
                <input type="number" value={claimForm.timeClaimed} onChange={e => setClaimForm(f => ({ ...f, timeClaimed: e.target.value }))} placeholder="0"
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cost Claimed (£)</label>
                <input type="number" value={claimForm.costClaimed} onChange={e => setClaimForm(f => ({ ...f, costClaimed: e.target.value }))} placeholder="0"
                  className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Notes</label>
              <textarea rows={2} value={claimForm.notes} onChange={e => setClaimForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none" />
            </div>

            <button onClick={handleRaiseClaim} disabled={saving || !claimForm.title}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Create Claim
            </button>
          </div>
        </div>
      )}

      {/* ── View Drafted Notice Modal ── */}
      {viewingNotice && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold text-white">Drafted Notice — {viewingNotice.reference}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Review and edit before sending. This notice was AI-generated from your project data.</p>
              </div>
              <button onClick={() => setViewingNotice(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <textarea
                defaultValue={viewingNotice.drafted_notice ?? ""}
                rows={24}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500 resize-none"
                readOnly
              />
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3 justify-end">
              <button onClick={() => {
                const text = (document.querySelector("textarea") as HTMLTextAreaElement)?.value ?? viewingNotice.drafted_notice ?? "";
                navigator.clipboard.writeText(text);
                toast.success("Copied to clipboard");
              }} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm transition-colors">
                Copy to Clipboard
              </button>
              <button onClick={() => setViewingNotice(null)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Claim Narrative Modal ── */}
      {viewingClaim && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-white/15 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-5 border-b border-white/10">
              <div>
                <h3 className="text-base font-semibold text-white">AI Claim Draft — {viewingClaim.reference}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{viewingClaim.title} · Review, edit, and build your submission from this draft</p>
              </div>
              <button onClick={() => setViewingClaim(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <textarea
                defaultValue={viewingClaim.ai_narrative ?? ""}
                rows={28}
                className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="p-4 border-t border-white/10 flex gap-3 justify-end">
              <button onClick={() => {
                const text = (document.querySelectorAll("textarea")[1] as HTMLTextAreaElement)?.value ?? viewingClaim.ai_narrative ?? "";
                navigator.clipboard.writeText(text);
                toast.success("Copied to clipboard");
              }} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm transition-colors">
                Copy to Clipboard
              </button>
              <button onClick={() => setViewingClaim(null)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELAY ANALYSIS TAB ────────────────────────────────────────── */}
      {tab === "delay" && project && (
        <DelayAnalysisTab projectId={project.id} projectName={project.name} contractType={contractSettings?.contract_type} />
      )}
    </div>
  );
}

// Bring Eye in scope (used in events tab)
import { Eye, UserPlus, Copy, Link2, TrendingDown, Play, FileDown as FileDownIcon } from "lucide-react";

// ── Delay Analysis Tab Component ─────────────────────────────────────────────

const METHODOLOGIES: { value: DelayMethodology; label: string; description: string }[] = [
  { value: "as_planned_vs_as_built", label: "As-Planned vs As-Built", description: "Compares baseline finish dates to actual finish dates per phase" },
  { value: "time_impact", label: "Time Impact Analysis", description: "Shows how each contract event shifted the completion date" },
  { value: "collapsed_as_built", label: "Collapsed As-Built", description: "Removes delay events to show what completion would have been" },
  { value: "windows", label: "Windows Analysis", description: "Analyses delay accrual across monthly time windows" },
];

function DelayAnalysisTab({ projectId, projectName, contractType }: { projectId: string; projectName: string; contractType?: string }) {
  const [methodology, setMethodology] = useState<DelayMethodology>("as_planned_vs_as_built");
  const [windowDays, setWindowDays] = useState(28);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  const handleRun = async () => {
    setRunning(true); setResults(null); setNarrative(null);
    try {
      const res = await runDelayAnalysisAction({
        projectId,
        methodology,
        title: `${METHODOLOGIES.find(m => m.value === methodology)?.label ?? methodology} — ${new Date().toLocaleDateString("en-GB")}`,
        windowSizeDays: methodology === "windows" ? windowDays : undefined,
      });
      if (res.success) {
        setResults(res.results);
        setAnalysisId(res.analysisId ?? null);
        toast.success("Delay analysis complete");
      } else {
        toast.error(res.error ?? "Analysis failed");
      }
    } catch { toast.error("Analysis failed"); }
    finally { setRunning(false); }
  };

  const handleNarrative = async () => {
    if (!analysisId || !results) return;
    setDrafting(true);
    try {
      const res = await draftDelayNarrativeAction({
        analysisId, projectId, contractType, methodology, results, projectName,
      });
      if (res.success) { setNarrative(res.narrative ?? null); toast.success("Narrative drafted"); }
      else { toast.error(res.error ?? "Narrative failed"); }
    } catch { toast.error("Narrative failed"); }
    finally { setDrafting(false); }
  };

  return (
    <div className="space-y-5">
      {/* Methodology selector */}
      <div className="bg-white/3 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-blue-400" />
          SCL Delay Analysis Protocol
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Select a methodology per the Society of Construction Law Delay and Disruption Protocol (2nd Edition).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {METHODOLOGIES.map(m => (
            <button
              key={m.value}
              onClick={() => setMethodology(m.value)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                methodology === m.value
                  ? "border-blue-500/50 bg-blue-600/10"
                  : "border-white/10 bg-white/3 hover:border-white/20"
              }`}
            >
              <p className={`text-sm font-medium ${methodology === m.value ? "text-blue-300" : "text-white"}`}>{m.label}</p>
              <p className="text-[11px] text-slate-500 mt-1">{m.description}</p>
            </button>
          ))}
        </div>

        {methodology === "windows" && (
          <div className="flex items-center gap-3 mb-4">
            <label className="text-xs text-slate-500">Window size (days):</label>
            <input
              type="number" value={windowDays} onChange={e => setWindowDays(Number(e.target.value) || 28)}
              className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
            />
          </div>
        )}

        <button
          onClick={handleRun} disabled={running}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Analysing..." : "Run Analysis"}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="bg-white/3 border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white">Results</h3>

          {/* As-Planned vs As-Built results */}
          {results.methodology === "as_planned_vs_as_built" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Planned Duration</p>
                  <p className="text-lg font-bold text-white">{results.totalPlannedDuration}d</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Actual Duration</p>
                  <p className="text-lg font-bold text-white">{results.totalActualDuration}d</p>
                </div>
                <div className="bg-red-900/20 rounded-lg p-3">
                  <p className="text-[10px] text-red-400 uppercase">Total Delay</p>
                  <p className="text-lg font-bold text-red-400">{results.totalProjectDelay}d</p>
                </div>
              </div>
              {Object.keys(results.delaySummaryByCategory || {}).length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">Delay by Category</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(results.delaySummaryByCategory).map(([cat, days]) => (
                      <span key={cat} className="text-xs bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
                        <span className="text-slate-400">{cat}:</span>{" "}
                        <span className="text-white font-semibold">{days as number}d</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-500">
                      <th className="text-left py-2 px-2">Phase</th>
                      <th className="text-left py-2 px-2">Planned</th>
                      <th className="text-left py-2 px-2">Actual</th>
                      <th className="text-right py-2 px-2">Delay</th>
                      <th className="text-left py-2 px-2">Cause</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(results.phases ?? []).map((p: any, i: number) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 px-2 text-white">{p.phaseName}</td>
                        <td className="py-2 px-2 text-slate-400">{p.plannedStart} → {p.plannedFinish}</td>
                        <td className="py-2 px-2 text-slate-400">{p.actualStart ?? "—"} → {p.actualFinish ?? "—"}</td>
                        <td className={`py-2 px-2 text-right font-semibold ${p.delayDays > 0 ? "text-red-400" : "text-emerald-400"}`}>
                          {p.delayDays > 0 ? `+${p.delayDays}d` : "On time"}
                        </td>
                        <td className="py-2 px-2 text-slate-500">{p.delayCategory ?? p.delayReason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Time Impact results */}
          {results.methodology === "time_impact" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Baseline Completion</p>
                  <p className="text-sm font-bold text-white">{results.baselineCompletion}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Adjusted Completion</p>
                  <p className="text-sm font-bold text-white">{results.adjustedCompletion}</p>
                </div>
                <div className="bg-red-900/20 rounded-lg p-3">
                  <p className="text-[10px] text-red-400 uppercase">Cumulative Impact</p>
                  <p className="text-lg font-bold text-red-400">{results.cumulativeImpact}d</p>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/10 text-slate-500">
                  <th className="text-left py-2 px-2">Event</th>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-right py-2 px-2">Days</th>
                  <th className="text-left py-2 px-2">Pre</th>
                  <th className="text-left py-2 px-2">Post</th>
                </tr></thead>
                <tbody>{(results.events ?? []).map((e: any, i: number) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-2 text-white">{e.eventRef ? `${e.eventRef} — ` : ""}{e.eventTitle}</td>
                    <td className="py-2 px-2 text-slate-400">{e.dateRaised}</td>
                    <td className="py-2 px-2 text-right font-semibold text-red-400">+{e.impactDays}d</td>
                    <td className="py-2 px-2 text-slate-400">{e.preEventCompletion}</td>
                    <td className="py-2 px-2 text-slate-400">{e.postEventCompletion}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Collapsed As-Built results */}
          {results.methodology === "collapsed_as_built" && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">As-Built Completion</p>
                  <p className="text-sm font-bold text-white">{results.asBuiltCompletion}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-[10px] text-slate-500 uppercase">Collapsed Completion</p>
                  <p className="text-sm font-bold text-white">{results.collapsedCompletion}</p>
                </div>
                <div className="bg-emerald-900/20 rounded-lg p-3">
                  <p className="text-[10px] text-emerald-400 uppercase">Recoverable Days</p>
                  <p className="text-lg font-bold text-emerald-400">{results.totalRecoverableDays}d</p>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/10 text-slate-500">
                  <th className="text-left py-2 px-2">Event Removed</th>
                  <th className="text-right py-2 px-2">Days Recovered</th>
                  <th className="text-left py-2 px-2">Resulting Completion</th>
                </tr></thead>
                <tbody>{(results.steps ?? []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-2 text-white">{s.eventTitle}</td>
                    <td className="py-2 px-2 text-right font-semibold text-emerald-400">-{s.daysRecovered}d</td>
                    <td className="py-2 px-2 text-slate-400">{s.resultingCompletion}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Windows results */}
          {results.methodology === "windows" && (
            <div className="space-y-3">
              <div className="bg-red-900/20 rounded-lg p-3 inline-block">
                <p className="text-[10px] text-red-400 uppercase">Total Delay</p>
                <p className="text-lg font-bold text-red-400">{results.totalDelay}d</p>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-white/10 text-slate-500">
                  <th className="text-left py-2 px-2">Window</th>
                  <th className="text-left py-2 px-2">Period</th>
                  <th className="text-right py-2 px-2">Planned</th>
                  <th className="text-right py-2 px-2">Actual</th>
                  <th className="text-right py-2 px-2">Delay</th>
                  <th className="text-left py-2 px-2">Cause</th>
                </tr></thead>
                <tbody>{(results.windows ?? []).map((w: any, i: number) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-2 text-white">W{w.windowNumber}</td>
                    <td className="py-2 px-2 text-slate-400">{w.startDate} → {w.endDate}</td>
                    <td className="py-2 px-2 text-right text-slate-400">{w.plannedProgress}d</td>
                    <td className="py-2 px-2 text-right text-slate-400">{w.actualProgress}d</td>
                    <td className={`py-2 px-2 text-right font-semibold ${w.delayAccrued > 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {w.delayAccrued > 0 ? `+${w.delayAccrued}d` : "—"}
                    </td>
                    <td className="py-2 px-2 text-slate-500">{w.dominantCause ?? "—"}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {/* Generate narrative */}
          <div className="pt-3 border-t border-white/10 flex items-center gap-3">
            <button
              onClick={handleNarrative} disabled={drafting}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {drafting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {drafting ? "Drafting..." : "Generate AI Narrative"}
            </button>
          </div>

          {/* Narrative display */}
          {narrative && (
            <div className="bg-white/3 border border-white/10 rounded-xl p-5">
              <h4 className="text-sm font-semibold text-white mb-3">AI-Generated Delay Narrative</h4>
              <div className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {narrative}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(narrative); toast.success("Copied"); }}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300"
              >
                Copy to clipboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Supervisor Invite Component ──────────────────────────────────────────────

function SupervisorInvite({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Enter supervisor name"); return; }
    setSaving(true);
    try {
      const result = await createSupervisorTokenAction({
        projectId,
        name: name.trim(),
        email: email.trim() || undefined,
      });
      if (result.success && result.token) {
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        const link = `${baseUrl}/supervisor/${result.token}`;
        setGeneratedLink(link);
        toast.success(email.trim() ? "Invite sent and link generated" : "Portal link generated");
      } else {
        toast.error(result.error ?? "Failed to create invite");
      }
    } catch {
      toast.error("Failed to create invite");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success("Link copied to clipboard");
    }
  };

  return (
    <div className="bg-white/3 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-blue-400" />
          Supervisor Portal
        </h3>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            Invite Supervisor
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Generate a read-only portal link for supervisors or sub-contractors to view and acknowledge their obligations.
      </p>

      {open && !generatedLink && (
        <div className="space-y-3 mt-3 pt-3 border-t border-white/10">
          <div>
            <label className="text-[11px] text-slate-500 font-medium mb-1 block">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500 font-medium mb-1 block">Email (optional — sends invite)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="supervisor@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Generate Link
            </button>
            <button
              onClick={() => { setOpen(false); setName(""); setEmail(""); }}
              className="text-xs text-slate-500 hover:text-slate-300 px-3 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {generatedLink && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          <p className="text-xs text-emerald-400 font-medium">Portal link created for {name}</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={generatedLink}
              readOnly
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
          <button
            onClick={() => { setGeneratedLink(null); setName(""); setEmail(""); setOpen(false); }}
            className="text-xs text-slate-500 hover:text-slate-300"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
