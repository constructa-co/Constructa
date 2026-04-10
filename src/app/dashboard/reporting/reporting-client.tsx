"use client";

import { useState, useRef, useCallback } from "react";
import {
  Camera,
  FileText,
  BarChart2,
  LayoutGrid,
  Plus,
  Trash2,
  Download,
  Upload,
  X,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  DollarSign,
  GitBranch,
  CalendarDays,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  uploadSitePhotoAction,
  deleteSitePhotoAction,
  upsertProgressReportAction,
  deleteProgressReportAction,
} from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  name: string;
  client_name?: string | null;
  project_type?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  potential_value?: number | null;
}

interface ProgressReport {
  id: string;
  project_id: string;
  report_type: string;
  week_ending: string;
  overall_progress?: number | null;
  work_completed?: string | null;
  work_planned?: string | null;
  issues_risks?: string | null;
  instructions_received?: string | null;
  weather_days_lost?: number | null;
  labour_headcount?: number | null;
  created_at: string;
}

interface SitePhoto {
  id: string;
  project_id: string;
  storage_path: string;
  caption?: string | null;
  taken_at?: string | null;
  week_ending?: string | null;
  uploaded_at: string;
}

interface Invoice {
  id: string;
  project_id: string;
  invoice_number?: string | null;
  status: string;
  amount_due: number;
  date_issued?: string | null;
  date_paid?: string | null;
}

interface Variation {
  id: string;
  project_id: string;
  description: string;
  status: string;
  amount?: number | null;
  created_at: string;
}

interface Estimate {
  id: string;
  project_id: string;
  total_cost: number;
  is_active?: boolean;
  overhead_pct?: number | null;
  risk_pct?: number | null;
  profit_pct?: number | null;
  discount_pct?: number | null;
}

interface StaffResource {
  id: string;
  project_id: string;
  name: string;
  role?: string | null;
  days_allocated?: number | null;
  day_rate?: number | null;
  staff_type?: string | null;
}

interface Expense {
  id: string;
  project_id: string;
  category?: string | null;
  amount: number;
  date?: string | null;
  status: string;
}

interface Props {
  initialProjectId: string | null;
  projects: Project[];
  progressReports: ProgressReport[];
  sitePhotos: SitePhoto[];
  invoices: Invoice[];
  variations: Variation[];
  estimates: Estimate[];
  staffResources: StaffResource[];
  expenses: Expense[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function contractValue(project: Project, estimates: Estimate[]): number {
  const proj = estimates.filter((e) => e.project_id === project.id);
  const active = proj.find((e) => e.is_active) ?? proj[0];
  if (!active) return project.potential_value ?? 0;
  const base = active.total_cost ?? 0;
  const oh = 1 + (active.overhead_pct ?? 0) / 100;
  const risk = 1 + (active.risk_pct ?? 0) / 100;
  const profit = 1 + (active.profit_pct ?? 0) / 100;
  const disc = 1 - (active.discount_pct ?? 0) / 100;
  return base * oh * risk * profit * disc;
}

function invoicedTotal(projectId: string, invoices: Invoice[]) {
  return invoices
    .filter((i) => i.project_id === projectId)
    .reduce((s, i) => s + (i.amount_due ?? 0), 0);
}

function paidTotal(projectId: string, invoices: Invoice[]) {
  return invoices
    .filter((i) => i.project_id === projectId && i.status === "paid")
    .reduce((s, i) => s + (i.amount_due ?? 0), 0);
}

function variationTotal(projectId: string, variations: Variation[]) {
  return variations
    .filter((v) => v.project_id === projectId && v.status === "Approved")
    .reduce((s, v) => s + (v.amount ?? 0), 0);
}

function costToDate(projectId: string, expenses: Expense[]) {
  return expenses
    .filter((e) => e.project_id === projectId)
    .reduce((s, e) => s + (e.amount ?? 0), 0);
}

const TABS = [
  { key: "photos",   label: "Site Photos",        icon: Camera },
  { key: "weekly",   label: "Weekly Reports",      icon: FileText },
  { key: "control",  label: "Project Control",     icon: BarChart2 },
  { key: "portfolio",label: "Portfolio Overview",  icon: LayoutGrid },
] as const;
type Tab = (typeof TABS)[number]["key"];

// ─── Photo URL helper ─────────────────────────────────────────────────────────

function usePhotoUrl(storagePath: string) {
  const supabase = createClient();
  const { data } = supabase.storage
    .from("site-photos")
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

// ─── Photo Card ───────────────────────────────────────────────────────────────

function PhotoCard({
  photo,
  onDelete,
}: {
  photo: SitePhoto;
  onDelete: (id: string, path: string) => void;
}) {
  const supabase = createClient();
  const { data } = supabase.storage
    .from("site-photos")
    .getPublicUrl(photo.storage_path);
  const url = data.publicUrl;

  return (
    <div className="relative group rounded-lg overflow-hidden bg-slate-800 border border-white/10 aspect-square">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={photo.caption ?? "Site photo"}
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
        {photo.caption && (
          <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
        )}
        {photo.taken_at && (
          <p className="text-slate-300 text-[10px]">
            {new Date(photo.taken_at).toLocaleDateString("en-GB")}
          </p>
        )}
        <button
          onClick={() => onDelete(photo.id, photo.storage_path)}
          className="absolute top-2 right-2 p-1 bg-red-600 rounded-md text-white hover:bg-red-700 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportingClient({
  initialProjectId,
  projects,
  progressReports,
  sitePhotos,
  invoices,
  variations,
  estimates,
  staffResources,
  expenses,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("photos");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId ?? projects[0]?.id ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Progress report form state
  const [reportForm, setReportForm] = useState<{
    id?: string;
    weekEnding: string;
    overallProgress: string;
    workCompleted: string;
    workPlanned: string;
    issuesRisks: string;
    instructionsReceived: string;
    weatherDaysLost: string;
    labourHeadcount: string;
  }>({
    weekEnding: new Date().toISOString().split("T")[0],
    overallProgress: "",
    workCompleted: "",
    workPlanned: "",
    issuesRisks: "",
    instructionsReceived: "",
    weatherDaysLost: "0",
    labourHeadcount: "0",
  });

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const projectPhotos = sitePhotos.filter(
    (p) => p.project_id === selectedProjectId
  );
  const projectReports = progressReports.filter(
    (r) => r.project_id === selectedProjectId
  );

  // ── Upload photos ───────────────────────────────────────────────────────────

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedProjectId) return;
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      setUploading(true);
      const supabase = createClient();
      let uploaded = 0;
      for (const file of files) {
        const ext = file.name.split(".").pop();
        const path = `${selectedProjectId}/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("site-photos")
          .upload(path, file);
        if (upErr) {
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }
        const res = await uploadSitePhotoAction({
          projectId: selectedProjectId,
          storagePath: path,
          takenAt: new Date().toISOString().split("T")[0],
        });
        if (res.error) {
          toast.error(res.error);
        } else {
          uploaded++;
        }
      }
      toast.success(`${uploaded} photo${uploaded !== 1 ? "s" : ""} uploaded`);
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    },
    [selectedProjectId]
  );

  const handleDeletePhoto = useCallback(async (id: string, path: string) => {
    const res = await deleteSitePhotoAction(id);
    if (res.error) toast.error(res.error);
    else toast.success("Photo deleted");
  }, []);

  // ── Save progress report ────────────────────────────────────────────────────

  const handleSaveReport = async () => {
    if (!selectedProjectId) return;
    setSaving(true);
    const res = await upsertProgressReportAction({
      id: reportForm.id,
      projectId: selectedProjectId,
      weekEnding: reportForm.weekEnding,
      overallProgress: reportForm.overallProgress
        ? parseFloat(reportForm.overallProgress)
        : undefined,
      workCompleted: reportForm.workCompleted || undefined,
      workPlanned: reportForm.workPlanned || undefined,
      issuesRisks: reportForm.issuesRisks || undefined,
      instructionsReceived: reportForm.instructionsReceived || undefined,
      weatherDaysLost: parseInt(reportForm.weatherDaysLost) || 0,
      labourHeadcount: parseInt(reportForm.labourHeadcount) || 0,
    });
    setSaving(false);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Report saved");
      // Reset form
      setReportForm({
        weekEnding: new Date().toISOString().split("T")[0],
        overallProgress: "",
        workCompleted: "",
        workPlanned: "",
        issuesRisks: "",
        instructionsReceived: "",
        weatherDaysLost: "0",
        labourHeadcount: "0",
      });
    }
  };

  // ── PDF generation (weekly report) ─────────────────────────────────────────

  const generateWeeklyPDF = async (report: ProgressReport) => {
    const jsPDF = (await import("jspdf")).default;
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const proj = projects.find((p) => p.id === report.project_id);
    const blue: [number, number, number] = [37, 99, 235];
    const dark: [number, number, number] = [15, 23, 42];
    const mid: [number, number, number] = [71, 85, 105];
    const light: [number, number, number] = [248, 250, 252];

    // Header bar
    doc.setFillColor(...blue);
    doc.rect(0, 0, 210, 28, "F");
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text("WEEKLY PROGRESS REPORT", 14, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Week Ending: ${new Date(report.week_ending).toLocaleDateString("en-GB")}`, 14, 20);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 25);

    // Project info box
    doc.setFillColor(...light);
    doc.rect(0, 29, 210, 18, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(proj?.name ?? "—", 14, 37);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...mid);
    doc.text(`Client: ${proj?.client_name ?? "—"}`, 14, 43);
    if (report.overall_progress != null) {
      doc.setTextColor(...blue);
      doc.setFont("helvetica", "bold");
      doc.text(`Overall Progress: ${report.overall_progress}%`, 130, 37);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...mid);
    }
    doc.text(
      `Labour on site: ${report.labour_headcount ?? 0}  |  Weather days lost: ${report.weather_days_lost ?? 0}`,
      130,
      43
    );

    let y = 54;

    const section = (title: string, body: string | null | undefined) => {
      if (!body) return;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...blue);
      doc.text(title, 14, y);
      y += 4;
      doc.setDrawColor(...blue);
      doc.setLineWidth(0.4);
      doc.line(14, y, 196, y);
      y += 4;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...dark);
      const lines = doc.splitTextToSize(body, 182);
      doc.text(lines, 14, y);
      y += lines.length * 5 + 6;
    };

    section("Work Completed This Week", report.work_completed);
    section("Work Planned Next Week", report.work_planned);
    section("Issues & Risks", report.issues_risks);
    section("Instructions Received", report.instructions_received);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(...mid);
    doc.text("Constructa — Construction Management Platform", 14, 287);
    doc.text(`Page 1`, 196, 287, { align: "right" });

    doc.save(
      `Weekly_Report_${proj?.name ?? "Project"}_${report.week_ending}.pdf`
    );
  };

  // ── Project Control data ────────────────────────────────────────────────────

  const contractVal = selectedProject
    ? contractValue(selectedProject, estimates)
    : 0;
  const invoicedAmt = invoicedTotal(selectedProjectId, invoices);
  const paidAmt = paidTotal(selectedProjectId, invoices);
  const varAmt = variationTotal(selectedProjectId, variations);
  const costAmt = costToDate(selectedProjectId, expenses);
  const outstandingAmt = invoicedAmt - paidAmt;
  const approvedVarCount = variations.filter(
    (v) => v.project_id === selectedProjectId && v.status === "Approved"
  ).length;
  const pendingVarCount = variations.filter(
    (v) =>
      v.project_id === selectedProjectId &&
      (v.status === "Pending" || v.status === "Submitted")
  ).length;
  const latestReport = projectReports[0];

  // ── Portfolio aggregates ────────────────────────────────────────────────────

  const portfolioContractVal = projects.reduce(
    (s, p) => s + contractValue(p, estimates),
    0
  );
  const portfolioInvoiced = projects.reduce(
    (s, p) => s + invoicedTotal(p.id, invoices),
    0
  );
  const portfolioPaid = projects.reduce(
    (s, p) => s + paidTotal(p.id, invoices),
    0
  );
  const portfolioOutstanding = portfolioInvoiced - portfolioPaid;
  const portfolioVars = variations
    .filter((v) => v.status === "Approved")
    .reduce((s, v) => s + (v.amount ?? 0), 0);
  const portfolioCosts = expenses.reduce((s, e) => s + (e.amount ?? 0), 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white">Reporting</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Site photos, progress reports & project control
          </p>
        </div>
        {/* Project selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400">Project:</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 max-w-[220px]"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#1a1a1a]">
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-white/10 px-6 bg-[#0d0d0d]">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── Site Photos ────────────────────────────────────────────────────── */}
        {activeTab === "photos" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">Site Photos</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {projectPhotos.length} photo{projectPhotos.length !== 1 ? "s" : ""} for {selectedProject?.name ?? "this project"}
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || !selectedProjectId}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload Photos
                </button>
              </div>
            </div>

            {projectPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-white/10 rounded-xl text-slate-500">
                <Camera className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-sm">No photos yet</p>
                <p className="text-xs mt-1">Upload site photos to start building your gallery</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {projectPhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    onDelete={handleDeletePhoto}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Weekly Reports ─────────────────────────────────────────────────── */}
        {activeTab === "weekly" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="bg-white/3 border border-white/10 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-semibold text-white">New Weekly Report</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Week Ending</label>
                  <input
                    type="date"
                    value={reportForm.weekEnding}
                    onChange={(e) =>
                      setReportForm((f) => ({ ...f, weekEnding: e.target.value }))
                    }
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Overall Progress (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={reportForm.overallProgress}
                    onChange={(e) =>
                      setReportForm((f) => ({
                        ...f,
                        overallProgress: e.target.value,
                      }))
                    }
                    placeholder="0–100"
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Labour on Site</label>
                  <input
                    type="number"
                    min="0"
                    value={reportForm.labourHeadcount}
                    onChange={(e) =>
                      setReportForm((f) => ({
                        ...f,
                        labourHeadcount: e.target.value,
                      }))
                    }
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Weather Days Lost
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={reportForm.weatherDaysLost}
                    onChange={(e) =>
                      setReportForm((f) => ({
                        ...f,
                        weatherDaysLost: e.target.value,
                      }))
                    }
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {(
                [
                  ["workCompleted", "Work Completed This Week"],
                  ["workPlanned", "Work Planned Next Week"],
                  ["issuesRisks", "Issues & Risks"],
                  ["instructionsReceived", "Instructions Received"],
                ] as [keyof typeof reportForm, string][]
              ).map(([field, label]) => (
                <div key={field}>
                  <label className="block text-xs text-slate-400 mb-1">{label}</label>
                  <textarea
                    rows={3}
                    value={reportForm[field] as string}
                    onChange={(e) =>
                      setReportForm((f) => ({ ...f, [field]: e.target.value }))
                    }
                    placeholder={`Enter ${label.toLowerCase()}…`}
                    className="w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              ))}

              <button
                onClick={handleSaveReport}
                disabled={saving || !selectedProjectId || !reportForm.weekEnding}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Save Report
              </button>
            </div>

            {/* Reports list */}
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-white">
                Previous Reports ({projectReports.length})
              </h2>
              {projectReports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 border border-dashed border-white/10 rounded-xl text-slate-500 text-sm">
                  No reports yet
                </div>
              ) : (
                projectReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white/3 border border-white/10 rounded-xl p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            Week ending{" "}
                            {new Date(report.week_ending).toLocaleDateString(
                              "en-GB"
                            )}
                          </span>
                          {report.overall_progress != null && (
                            <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 rounded-full text-[10px] font-semibold">
                              {report.overall_progress}%
                            </span>
                          )}
                        </div>
                        <div className="flex gap-4 mt-1">
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {report.labour_headcount ?? 0} on site
                          </span>
                          {(report.weather_days_lost ?? 0) > 0 && (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {report.weather_days_lost} weather day
                              {report.weather_days_lost !== 1 ? "s" : ""} lost
                            </span>
                          )}
                        </div>
                        {report.work_completed && (
                          <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                            {report.work_completed}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 ml-3 flex-shrink-0">
                        <button
                          onClick={() => generateWeeklyPDF(report)}
                          className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const res = await deleteProgressReportAction(report.id);
                            if (res.error) toast.error(res.error);
                            else toast.success("Report deleted");
                          }}
                          className="p-1.5 rounded-md bg-white/5 hover:bg-red-600/20 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Project Control ────────────────────────────────────────────────── */}
        {activeTab === "control" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Project Control — {selectedProject?.name ?? "Select a project"}
              </h2>
              <button
                onClick={() => generateProjectControlPDF({
                  project: selectedProject!,
                  contractVal,
                  invoicedAmt,
                  paidAmt,
                  outstandingAmt,
                  varAmt,
                  costAmt,
                  approvedVarCount,
                  pendingVarCount,
                  latestReport,
                  projectPhotos: projectPhotos.length,
                  invoices: invoices.filter(i => i.project_id === selectedProjectId),
                  variations: variations.filter(v => v.project_id === selectedProjectId),
                })}
                disabled={!selectedProject}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>

            {/* KPI strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Contract Value", value: fmt(contractVal), icon: DollarSign, colour: "blue" },
                { label: "Total Invoiced", value: fmt(invoicedAmt), icon: FileText, colour: "indigo" },
                { label: "Received", value: fmt(paidAmt), icon: CheckCircle2, colour: "green" },
                { label: "Outstanding", value: fmt(outstandingAmt), icon: Clock, colour: outstandingAmt > 0 ? "amber" : "slate" },
                { label: "Variations", value: fmt(varAmt), icon: GitBranch, colour: "purple" },
                { label: "Cost to Date", value: fmt(costAmt), icon: TrendingUp, colour: "rose" },
              ].map(({ label, value, icon: Icon, colour }) => (
                <div
                  key={label}
                  className="bg-white/3 border border-white/10 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${colour}-600/15`}>
                      <Icon className={`w-3.5 h-3.5 text-${colour}-400`} />
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                      {label}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Variations table */}
            <div className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Variations</h3>
                <div className="flex gap-3 text-xs text-slate-400">
                  <span className="text-green-400 font-medium">
                    {approvedVarCount} approved
                  </span>
                  <span className="text-amber-400 font-medium">
                    {pendingVarCount} pending
                  </span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Description", "Status", "Amount"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {variations
                    .filter((v) => v.project_id === selectedProjectId)
                    .map((v) => (
                      <tr
                        key={v.id}
                        className="border-b border-white/5 last:border-0 hover:bg-white/2"
                      >
                        <td className="px-5 py-3 text-slate-200 text-xs">
                          {v.description}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              v.status === "Approved"
                                ? "bg-green-600/20 text-green-400"
                                : v.status === "Rejected"
                                ? "bg-red-600/20 text-red-400"
                                : "bg-amber-600/20 text-amber-400"
                            }`}
                          >
                            {v.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-200 text-xs font-mono">
                          {v.amount != null ? fmt(v.amount) : "—"}
                        </td>
                      </tr>
                    ))}
                  {variations.filter((v) => v.project_id === selectedProjectId)
                    .length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-5 py-6 text-center text-slate-500 text-xs"
                      >
                        No variations on this project
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Invoice schedule */}
            <div className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">Invoice Schedule</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Invoice", "Issued", "Amount", "Status", "Paid"].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left px-5 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invoices
                    .filter((i) => i.project_id === selectedProjectId)
                    .map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-white/5 last:border-0 hover:bg-white/2"
                      >
                        <td className="px-5 py-3 text-slate-200 text-xs font-medium">
                          {inv.invoice_number ?? "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {inv.date_issued
                            ? new Date(inv.date_issued).toLocaleDateString(
                                "en-GB"
                              )
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-slate-200 text-xs font-mono">
                          {fmt(inv.amount_due)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              inv.status === "paid"
                                ? "bg-green-600/20 text-green-400"
                                : inv.status === "overdue"
                                ? "bg-red-600/20 text-red-400"
                                : "bg-amber-600/20 text-amber-400"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {inv.date_paid
                            ? new Date(inv.date_paid).toLocaleDateString(
                                "en-GB"
                              )
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  {invoices.filter((i) => i.project_id === selectedProjectId)
                    .length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-6 text-center text-slate-500 text-xs"
                      >
                        No invoices on this project
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Progress & Resources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Latest report summary */}
              <div className="bg-white/3 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Latest Progress Report
                </h3>
                {latestReport ? (
                  <div className="space-y-2 text-xs text-slate-400">
                    <div className="flex justify-between">
                      <span>Week ending</span>
                      <span className="text-white font-medium">
                        {new Date(latestReport.week_ending).toLocaleDateString(
                          "en-GB"
                        )}
                      </span>
                    </div>
                    {latestReport.overall_progress != null && (
                      <div className="flex justify-between">
                        <span>Overall progress</span>
                        <span className="text-blue-400 font-semibold">
                          {latestReport.overall_progress}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Labour</span>
                      <span className="text-white">
                        {latestReport.labour_headcount ?? 0}
                      </span>
                    </div>
                    {latestReport.work_completed && (
                      <p className="mt-2 text-slate-300 leading-relaxed line-clamp-3">
                        {latestReport.work_completed}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">No reports yet</p>
                )}
              </div>

              {/* Resources summary */}
              <div className="bg-white/3 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">
                  Resources Allocated
                </h3>
                {staffResources.filter(
                  (s) => s.project_id === selectedProjectId
                ).length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No staff resources allocated
                  </p>
                ) : (
                  <div className="space-y-2">
                    {staffResources
                      .filter((s) => s.project_id === selectedProjectId)
                      .slice(0, 6)
                      .map((s) => (
                        <div
                          key={s.id}
                          className="flex justify-between text-xs"
                        >
                          <span className="text-slate-300">{s.name}</span>
                          <span className="text-slate-500">
                            {s.role ?? "—"} · {s.days_allocated ?? 0}d
                          </span>
                        </div>
                      ))}
                    {staffResources.filter(
                      (s) => s.project_id === selectedProjectId
                    ).length > 6 && (
                      <p className="text-[10px] text-slate-600">
                        +
                        {staffResources.filter(
                          (s) => s.project_id === selectedProjectId
                        ).length - 6}{" "}
                        more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Portfolio Overview ─────────────────────────────────────────────── */}
        {activeTab === "portfolio" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">
                Portfolio Overview — {projects.length} Project
                {projects.length !== 1 ? "s" : ""}
              </h2>
              <button
                onClick={() => generatePortfolioPDF({
                  projects,
                  estimates,
                  invoices,
                  variations,
                  expenses,
                  progressReports,
                })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Portfolio PDF
              </button>
            </div>

            {/* Portfolio KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { label: "Total Contract Value", value: fmt(portfolioContractVal), colour: "blue" },
                { label: "Total Invoiced", value: fmt(portfolioInvoiced), colour: "indigo" },
                { label: "Cash Received", value: fmt(portfolioPaid), colour: "green" },
                { label: "Outstanding", value: fmt(portfolioOutstanding), colour: portfolioOutstanding > 0 ? "amber" : "slate" },
                { label: "Approved Variations", value: fmt(portfolioVars), colour: "purple" },
              ].map(({ label, value, colour }) => (
                <div
                  key={label}
                  className="bg-white/3 border border-white/10 rounded-xl p-4"
                >
                  <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2">
                    {label}
                  </p>
                  <p className="text-xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>

            {/* Per-project table */}
            <div className="bg-white/3 border border-white/10 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h3 className="text-sm font-semibold text-white">
                  Project Breakdown
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      {[
                        "Project",
                        "Client",
                        "Contract Value",
                        "Invoiced",
                        "Received",
                        "Outstanding",
                        "Variations",
                        "Progress",
                      ].map((h) => (
                        <th
                          key={h}
                          className="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => {
                      const cv = contractValue(project, estimates);
                      const inv = invoicedTotal(project.id, invoices);
                      const paid = paidTotal(project.id, invoices);
                      const varT = variationTotal(project.id, variations);
                      const outstanding = inv - paid;
                      const latestRpt = progressReports.find(
                        (r) => r.project_id === project.id
                      );
                      return (
                        <tr
                          key={project.id}
                          className="border-b border-white/5 last:border-0 hover:bg-white/2"
                        >
                          <td className="px-4 py-3">
                            <p className="text-white text-xs font-medium truncate max-w-[160px]">
                              {project.name}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-xs truncate max-w-[100px]">
                            {project.client_name ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-200 text-xs font-mono">
                            {fmt(cv)}
                          </td>
                          <td className="px-4 py-3 text-slate-200 text-xs font-mono">
                            {fmt(inv)}
                          </td>
                          <td className="px-4 py-3 text-green-400 text-xs font-mono">
                            {fmt(paid)}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono">
                            <span
                              className={
                                outstanding > 0
                                  ? "text-amber-400"
                                  : "text-slate-400"
                              }
                            >
                              {fmt(outstanding)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-purple-400 text-xs font-mono">
                            {fmt(varT)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {latestRpt?.overall_progress != null ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-white/10 rounded-full h-1.5 min-w-[60px]">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full"
                                    style={{
                                      width: `${latestRpt.overall_progress}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-blue-400 font-medium text-[10px]">
                                  {latestRpt.overall_progress}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/10 bg-white/3">
                      <td
                        colSpan={2}
                        className="px-4 py-3 text-xs font-bold text-slate-300"
                      >
                        TOTAL
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-white font-mono">
                        {fmt(portfolioContractVal)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-white font-mono">
                        {fmt(portfolioInvoiced)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-green-400 font-mono">
                        {fmt(portfolioPaid)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-amber-400 font-mono">
                        {fmt(portfolioOutstanding)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-purple-400 font-mono">
                        {fmt(portfolioVars)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PDF helpers (defined outside component to avoid re-creation) ─────────────

async function generateProjectControlPDF(data: {
  project: Project;
  contractVal: number;
  invoicedAmt: number;
  paidAmt: number;
  outstandingAmt: number;
  varAmt: number;
  costAmt: number;
  approvedVarCount: number;
  pendingVarCount: number;
  latestReport?: ProgressReport;
  projectPhotos: number;
  invoices: Invoice[];
  variations: Variation[];
}) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(n);

  const blue: [number, number, number] = [37, 99, 235];
  const dark: [number, number, number] = [15, 23, 42];
  const mid: [number, number, number] = [71, 85, 105];
  const light: [number, number, number] = [248, 250, 252];

  // Header
  doc.setFillColor(...blue);
  doc.rect(0, 0, 210, 28, "F");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("PROJECT CONTROL REPORT", 14, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${data.project.name}  ·  ${data.project.client_name ?? ""}`, 14, 20);
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB")}`,
    196,
    20,
    { align: "right" }
  );

  let y = 36;

  // KPI table
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Contract Value", fmt(data.contractVal)],
      ["Total Invoiced", fmt(data.invoicedAmt)],
      ["Cash Received", fmt(data.paidAmt)],
      ["Outstanding", fmt(data.outstandingAmt)],
      ["Approved Variations", fmt(data.varAmt)],
      ["Cost to Date", fmt(data.costAmt)],
      ["Approved Variations (count)", String(data.approvedVarCount)],
      ["Pending Variations (count)", String(data.pendingVarCount)],
    ],
    theme: "grid",
    headStyles: { fillColor: blue, textColor: [255, 255, 255], fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Variations
  if (data.variations.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...blue);
    doc.text("Variations", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Description", "Status", "Amount"]],
      body: data.variations.map((v) => [
        v.description,
        v.status,
        v.amount != null ? fmt(v.amount) : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: blue, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // Invoices
  if (data.invoices.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...blue);
    doc.text("Invoice Schedule", 14, y);
    y += 2;
    autoTable(doc, {
      startY: y,
      head: [["Invoice #", "Issued", "Amount", "Status", "Paid"]],
      body: data.invoices.map((i) => [
        i.invoice_number ?? "—",
        i.date_issued
          ? new Date(i.date_issued).toLocaleDateString("en-GB")
          : "—",
        fmt(i.amount_due),
        i.status,
        i.date_paid
          ? new Date(i.date_paid).toLocaleDateString("en-GB")
          : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: blue, textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
    });
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...mid);
  doc.text("Constructa — Construction Management Platform", 14, 287);

  doc.save(`Project_Control_${data.project.name}.pdf`);
}

async function generatePortfolioPDF(data: {
  projects: Project[];
  estimates: Estimate[];
  invoices: Invoice[];
  variations: Variation[];
  expenses: Expense[];
  progressReports: ProgressReport[];
}) {
  const jsPDF = (await import("jspdf")).default;
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(n);

  const blue: [number, number, number] = [37, 99, 235];
  const mid: [number, number, number] = [71, 85, 105];

  // Header
  doc.setFillColor(...blue);
  doc.rect(0, 0, 297, 20, "F");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("PORTFOLIO OVERVIEW", 14, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Generated: ${new Date().toLocaleDateString("en-GB")}  ·  ${data.projects.length} Projects`,
    283,
    13,
    { align: "right" }
  );

  // Portfolio totals
  const contractValue = (p: Project) => {
    const proj = data.estimates.filter((e) => e.project_id === p.id);
    const active = proj.find((e) => e.is_active) ?? proj[0];
    if (!active) return p.potential_value ?? 0;
    const base = active.total_cost ?? 0;
    const oh = 1 + (active.overhead_pct ?? 0) / 100;
    const risk = 1 + (active.risk_pct ?? 0) / 100;
    const profit = 1 + (active.profit_pct ?? 0) / 100;
    const disc = 1 - (active.discount_pct ?? 0) / 100;
    return base * oh * risk * profit * disc;
  };

  const rows = data.projects.map((p) => {
    const cv = contractValue(p);
    const inv = data.invoices
      .filter((i) => i.project_id === p.id)
      .reduce((s, i) => s + i.amount_due, 0);
    const paid = data.invoices
      .filter((i) => i.project_id === p.id && i.status === "paid")
      .reduce((s, i) => s + i.amount_due, 0);
    const varT = data.variations
      .filter((v) => v.project_id === p.id && v.status === "Approved")
      .reduce((s, v) => s + (v.amount ?? 0), 0);
    const rpt = data.progressReports.find((r) => r.project_id === p.id);
    return [
      p.name,
      p.client_name ?? "—",
      fmt(cv),
      fmt(inv),
      fmt(paid),
      fmt(inv - paid),
      fmt(varT),
      rpt?.overall_progress != null ? `${rpt.overall_progress}%` : "—",
    ];
  });

  // Totals row
  const totals = data.projects.reduce(
    (acc, p) => {
      acc.cv += contractValue(p);
      acc.inv += data.invoices
        .filter((i) => i.project_id === p.id)
        .reduce((s, i) => s + i.amount_due, 0);
      acc.paid += data.invoices
        .filter((i) => i.project_id === p.id && i.status === "paid")
        .reduce((s, i) => s + i.amount_due, 0);
      acc.varT += data.variations
        .filter((v) => v.project_id === p.id && v.status === "Approved")
        .reduce((s, v) => s + (v.amount ?? 0), 0);
      return acc;
    },
    { cv: 0, inv: 0, paid: 0, varT: 0 }
  );

  autoTable(doc, {
    startY: 26,
    head: [
      ["Project", "Client", "Contract Value", "Invoiced", "Received", "Outstanding", "Variations", "Progress"],
    ],
    body: rows,
    foot: [["TOTAL", "", fmt(totals.cv), fmt(totals.inv), fmt(totals.paid), fmt(totals.inv - totals.paid), fmt(totals.varT), ""]],
    theme: "striped",
    headStyles: { fillColor: blue, textColor: [255, 255, 255], fontSize: 8 },
    footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
      7: { halign: "center" },
    },
  });

  doc.setFontSize(8);
  doc.setTextColor(...mid);
  doc.text("Constructa — Construction Management Platform", 14, 198);

  doc.save(`Portfolio_Overview_${new Date().toISOString().split("T")[0]}.pdf`);
}
