"use client";

import { useState, useRef, useTransition } from "react";
import {
  Users, CalendarDays, BarChart2, Plus, Trash2, X,
  AlertTriangle, CheckCircle2, Info, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  upsertAllocationAction,
  deleteAllocationAction,
  upsertAbsenceAction,
  deleteAbsenceAction,
  updateStaffTypeAction,
} from "./actions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Phase {
  name: string;
  calculatedDays: number;
  manualDays: number | null;
  manhours: number;
  startOffset: number;
  color?: string;
}

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  start_date: string;
  programme_phases: Phase[] | null;
}

interface Staff {
  id: string;
  name: string;
  job_title: string | null;
  role: string | null;
  staff_type: string;
  is_active: boolean;
}

interface Allocation {
  id: string;
  project_id: string;
  staff_resource_id: string | null;
  role_placeholder: string | null;
  trade_section: string | null;
  phase_name: string | null;
  start_date: string;
  end_date: string;
  days_allocated: number;
  days_per_week: number;
  is_confirmed: boolean;
  notes: string | null;
}

interface Absence {
  id: string;
  staff_resource_id: string;
  absence_type: string;
  start_date: string;
  end_date: string;
  notes: string | null;
}

interface LabourDemand {
  project_id: string;
  by_trade: { trade: string; hours: number }[];
}

interface Props {
  projects: Project[];
  staff: Staff[];
  allocations: Allocation[];
  absences: Absence[];
  labourDemand: LabourDemand[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WEEK_PX = 52;
const ROW_H   = 48;
const BAR_PAD = 6;

const PROJECT_PALETTE = [
  "#2563eb","#7c3aed","#059669","#d97706",
  "#dc2626","#0891b2","#4f46e5","#ea580c",
  "#0d9488","#9333ea","#16a34a","#b45309",
];

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function workingDaysToCal(wd: number): number {
  // approximate: × 7/5
  return Math.ceil(wd * 1.4);
}

function workingDaysBetween(a: Date, b: Date): number {
  let count = 0;
  const d = new Date(a);
  while (d < b) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

function getProjectDates(p: Project): { start: Date; end: Date } {
  const start = new Date(p.start_date + "T00:00:00");
  if (!p.programme_phases?.length) {
    return { start, end: addDays(start, 90) };
  }
  let maxEnd = start;
  for (const ph of p.programme_phases) {
    const phStart = addDays(start, ph.startOffset);
    const phEnd = addDays(phStart, workingDaysToCal(ph.manualDays ?? ph.calculatedDays));
    if (phEnd > maxEnd) maxEnd = phEnd;
  }
  return { start, end: maxEnd };
}

function weekOffset(timeline: Date, d: Date): number {
  return Math.floor((d.getTime() - timeline.getTime()) / (7 * 86_400_000));
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtDateInput(d: Date): string {
  return d.toISOString().split("T")[0];
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Allocation form ───────────────────────────────────────────────────────────

interface AllocationFormData {
  project_id: string;
  staff_resource_id: string;
  role_placeholder: string;
  trade_section: string;
  phase_name: string;
  start_date: string;
  end_date: string;
  days_per_week: string;
  is_confirmed: boolean;
  notes: string;
}

function AllocationModal({
  projects,
  staff,
  labourDemand,
  onClose,
  onSave,
}: {
  projects: Project[];
  staff: Staff[];
  labourDemand: LabourDemand[];
  onClose: () => void;
  onSave: (data: AllocationFormData) => void;
}) {
  const [form, setForm] = useState<AllocationFormData>({
    project_id: projects[0]?.id ?? "",
    staff_resource_id: staff[0]?.id ?? "",
    role_placeholder: "",
    trade_section: "",
    phase_name: "",
    start_date: fmtDateInput(new Date()),
    end_date: fmtDateInput(addDays(new Date(), 14)),
    days_per_week: "5",
    is_confirmed: true,
    notes: "",
  });

  const set = (k: keyof AllocationFormData, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const selectedProject = projects.find(p => p.id === form.project_id);
  const projectDemand = labourDemand.find(d => d.project_id === form.project_id);
  const tradeSections = projectDemand?.by_trade.map(t => t.trade) ?? [];

  const phases = selectedProject?.programme_phases ?? [];

  // Auto-compute days_allocated based on dates + days_per_week
  const start = new Date(form.start_date + "T00:00:00");
  const end   = new Date(form.end_date + "T00:00:00");
  const calDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  const daysPerWeek = parseFloat(form.days_per_week) || 5;
  const computedDays = Math.round((calDays / 7) * daysPerWeek * 10) / 10;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Add Resource Allocation</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Project</label>
            <select value={form.project_id} onChange={e => set("project_id", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Person</label>
            <select value={form.staff_resource_id} onChange={e => set("staff_resource_id", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500">
              <option value="">— Role only (not yet named) —</option>
              {staff.filter(s => s.staff_type === "direct_labour").map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.job_title ? ` (${s.job_title})` : ""}</option>
              ))}
            </select>
          </div>

          {!form.staff_resource_id && (
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Role / Trade (placeholder)</label>
              <input value={form.role_placeholder} onChange={e => set("role_placeholder", e.target.value)}
                placeholder="e.g. Carpenter, Groundworker"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500" />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">Trade / Section</label>
            <input list="trade-sections" value={form.trade_section} onChange={e => set("trade_section", e.target.value)}
              placeholder="e.g. Carpentry"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500" />
            <datalist id="trade-sections">
              {tradeSections.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Programme Phase</label>
            <input list="phases" value={form.phase_name} onChange={e => set("phase_name", e.target.value)}
              placeholder="e.g. First Fix"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500" />
            <datalist id="phases">
              {phases.map(ph => <option key={ph.name} value={ph.name} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Start date</label>
            <input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">End date</label>
            <input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500" />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Days / week</label>
            <select value={form.days_per_week} onChange={e => set("days_per_week", e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-slate-500">
              {["1","2","3","4","5"].map(d => <option key={d} value={d}>{d} day{d !== "1" ? "s" : ""}</option>)}
            </select>
          </div>

          <div className="flex items-end pb-0.5">
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white w-full text-center">
              <span className="text-blue-400 font-semibold">{computedDays}</span>
              <span className="text-slate-500 ml-1">days total</span>
            </div>
          </div>

          <div className="col-span-2 flex items-center gap-2">
            <input type="checkbox" id="confirmed" checked={form.is_confirmed}
              onChange={e => set("is_confirmed", e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-0" />
            <label htmlFor="confirmed" className="text-sm text-slate-300">Confirmed allocation (uncheck = tentative / bid stage)</label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 border border-slate-700 text-slate-400 hover:text-white text-sm rounded-xl py-2.5 transition-colors">
            Cancel
          </button>
          <button onClick={() => onSave({ ...form, days_per_week: form.days_per_week })}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-xl py-2.5 font-medium transition-colors">
            Add Allocation
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Portfolio Timeline Gantt ───────────────────────────────────────────────────

function PortfolioTimeline({
  projects,
  staff,
  allocations,
  absences,
}: {
  projects: Project[];
  staff: Staff[];
  allocations: Allocation[];
  absences: Absence[];
}) {
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (projects.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
        <CalendarDays className="w-10 h-10 mx-auto mb-3 text-slate-600" />
        <p className="text-slate-500">No projects with start dates yet.</p>
        <p className="text-slate-600 text-xs mt-1">Set a start date on your projects to see them here.</p>
      </div>
    );
  }

  // ── Compute timeline bounds ────────────────────────────────────────────────
  const projectDates = projects.map(p => ({ p, ...getProjectDates(p) }));
  const earliest = projectDates.reduce((m, pd) => pd.start < m ? pd.start : m, projectDates[0].start);
  const latest   = projectDates.reduce((m, pd) => pd.end > m ? pd.end : m, projectDates[0].end);
  const allocDates = allocations.map(a => new Date(a.end_date + "T00:00:00"));
  const allocMax  = allocDates.reduce((m, d) => d > m ? d : m, latest);

  const timelineStart = startOfWeek(addDays(earliest, -7)); // 1 week buffer
  const timelineEnd   = addDays(Math.max(latest.getTime(), allocMax.getTime()) > 0
    ? new Date(Math.max(latest.getTime(), allocMax.getTime()))
    : latest, 21); // 3 week end buffer
  const totalWeeks    = Math.max(12, weekOffset(timelineStart, timelineEnd) + 1);
  const totalPx       = totalWeeks * WEEK_PX;

  // ── Today offset ──────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayLeft = weekOffset(timelineStart, today) * WEEK_PX
    + (today.getDay() === 0 ? 6 : today.getDay() - 1) / 5 * WEEK_PX;

  // ── Month header ──────────────────────────────────────────────────────────
  const months: { label: string; left: number; width: number }[] = [];
  let cur = new Date(timelineStart);
  while (cur <= timelineEnd) {
    const mStart = new Date(cur);
    const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    const mEnd = nextMonth < timelineEnd ? nextMonth : timelineEnd;
    months.push({
      label: `${MONTH_NAMES[cur.getMonth()]} ${cur.getFullYear()}`,
      left: weekOffset(timelineStart, mStart) * WEEK_PX,
      width: weekOffset(timelineStart, mEnd) * WEEK_PX - weekOffset(timelineStart, mStart) * WEEK_PX,
    });
    cur = nextMonth;
  }

  // ── Week header ───────────────────────────────────────────────────────────
  const weeks: { label: string; left: number }[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const d = addDays(timelineStart, i * 7);
    weeks.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, left: i * WEEK_PX });
  }

  // ── Project colour map ────────────────────────────────────────────────────
  const projectColour = new Map<string, string>();
  projects.forEach((p, i) => projectColour.set(p.id, PROJECT_PALETTE[i % PROJECT_PALETTE.length]));

  // ── Detect gaps between consecutive projects ──────────────────────────────
  const sortedDates = [...projectDates].sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: { left: number; width: number; label: string }[] = [];
  for (let i = 0; i < sortedDates.length - 1; i++) {
    const gapStart = sortedDates[i].end;
    const gapEnd   = sortedDates[i + 1].start;
    if (gapEnd > gapStart) {
      const gapWeeks = Math.ceil((gapEnd.getTime() - gapStart.getTime()) / (7 * 86_400_000));
      if (gapWeeks > 0) {
        gaps.push({
          left:  weekOffset(timelineStart, gapStart) * WEEK_PX,
          width: gapWeeks * WEEK_PX,
          label: `${gapWeeks}w gap`,
        });
      }
    }
  }

  // ── Detect staff conflicts ────────────────────────────────────────────────
  const conflictIds = new Set<string>();
  for (const s of staff) {
    const sAllocs = allocations.filter(a => a.staff_resource_id === s.id);
    for (let i = 0; i < sAllocs.length; i++) {
      for (let j = i + 1; j < sAllocs.length; j++) {
        const a = sAllocs[i], b = sAllocs[j];
        const aStart = new Date(a.start_date), aEnd = new Date(a.end_date);
        const bStart = new Date(b.start_date), bEnd = new Date(b.end_date);
        if (aStart <= bEnd && bStart <= aEnd) {
          conflictIds.add(a.id);
          conflictIds.add(b.id);
        }
      }
    }
  }

  const directStaff  = staff.filter(s => s.staff_type === "direct_labour");
  const overheadStaff = staff.filter(s => s.staff_type === "overhead");

  function renderRow(s: Staff) {
    const sAllocs  = allocations.filter(a => a.staff_resource_id === s.id);
    const sAbsences = absences.filter(a => a.staff_resource_id === s.id);
    return (
      <div key={s.id} className="relative border-b border-slate-800/40" style={{ height: ROW_H }}>
        {/* Allocation bars */}
        {sAllocs.map(a => {
          const aStart = new Date(a.start_date + "T00:00:00");
          const aEnd   = new Date(a.end_date + "T00:00:00");
          const left   = weekOffset(timelineStart, aStart) * WEEK_PX;
          const wks    = Math.max(0.5, (aEnd.getTime() - aStart.getTime()) / (7 * 86_400_000));
          const width  = wks * WEEK_PX - 4;
          const colour = projectColour.get(a.project_id) ?? "#475569";
          const isConflict = conflictIds.has(a.id);
          const proj = projects.find(p => p.id === a.project_id);
          return (
            <div
              key={a.id}
              className={`absolute top-2 rounded-md flex items-center px-2 overflow-hidden text-[10px] text-white font-medium ${isConflict ? "ring-2 ring-red-400" : ""} ${!a.is_confirmed ? "opacity-60 border border-dashed border-white/30" : ""}`}
              style={{ left, width: Math.max(width, 8), height: ROW_H - BAR_PAD * 2, backgroundColor: colour }}
              title={`${proj?.name ?? ""} — ${a.trade_section ?? a.role_placeholder ?? ""}${isConflict ? " ⚠ CONFLICT" : ""}`}
            >
              <span className="truncate">{proj?.name ?? ""}</span>
              {isConflict && <AlertTriangle className="w-3 h-3 ml-1 text-red-200 shrink-0" />}
            </div>
          );
        })}

        {/* Absence blocks */}
        {sAbsences.map(ab => {
          const abStart = new Date(ab.start_date + "T00:00:00");
          const abEnd   = new Date(ab.end_date + "T00:00:00");
          const left  = weekOffset(timelineStart, abStart) * WEEK_PX;
          const wks   = Math.max(0.5, (abEnd.getTime() - abStart.getTime()) / (7 * 86_400_000));
          return (
            <div key={ab.id}
              className="absolute top-2 rounded-md bg-slate-600/50 border border-dashed border-slate-500 flex items-center justify-center overflow-hidden"
              style={{ left, width: Math.max(wks * WEEK_PX - 4, 8), height: ROW_H - BAR_PAD * 2 }}
              title={ab.absence_type}>
              <span className="text-[9px] text-slate-400 truncate px-1">{ab.absence_type}</span>
            </div>
          );
        })}

        {/* Unallocated indicator if no allocations */}
        {sAllocs.length === 0 && (
          <div className="absolute inset-y-3 inset-x-0 flex items-center px-3">
            <div className="h-0.5 w-full border-t border-dashed border-slate-700" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-800">
      {/* Sticky label column */}
      <div className="w-44 shrink-0 bg-slate-900 border-r border-slate-800 z-10" style={{ minWidth: 176 }}>
        {/* Header spacer */}
        <div className="border-b border-slate-800" style={{ height: 32 }} />
        <div className="border-b border-slate-800" style={{ height: 24 }} />

        {/* Projects section */}
        <div className="px-3 py-1 bg-slate-950/80 border-b border-slate-800">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Projects</span>
        </div>
        {projectDates.map(({ p }) => (
          <div key={p.id} className="border-b border-slate-800/40 px-3 flex flex-col justify-center" style={{ height: ROW_H }}>
            <p className="text-xs font-medium text-white truncate">{p.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{statusLabel(p.status)}</p>
          </div>
        ))}

        {/* Direct labour */}
        {directStaff.length > 0 && (
          <>
            <div className="px-3 py-1 bg-slate-950/80 border-b border-slate-800 border-t border-slate-700">
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">Direct Labour</span>
            </div>
            {directStaff.map(s => (
              <div key={s.id} className="border-b border-slate-800/40 px-3 flex flex-col justify-center" style={{ height: ROW_H }}>
                <p className="text-xs font-medium text-white truncate">{s.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{s.job_title ?? s.role ?? ""}</p>
              </div>
            ))}
          </>
        )}

        {/* Overhead staff */}
        {overheadStaff.length > 0 && (
          <>
            <div className="px-3 py-1 bg-slate-950/80 border-b border-slate-800 border-t border-slate-700">
              <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Overhead / HO</span>
            </div>
            {overheadStaff.map(s => (
              <div key={s.id} className="border-b border-slate-800/40 px-3 flex flex-col justify-center" style={{ height: ROW_H }}>
                <p className="text-xs font-medium text-white truncate">{s.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{s.job_title ?? s.role ?? ""}</p>
              </div>
            ))}
          </>
        )}

        {staff.length === 0 && (
          <div className="px-3 py-3 text-[10px] text-slate-600">
            Add staff in Labour Rates
          </div>
        )}
      </div>

      {/* Scrollable timeline */}
      <div className="flex-1 overflow-x-auto" ref={scrollRef}>
        <div className="relative" style={{ width: totalPx, minWidth: totalPx }}>

          {/* Month header */}
          <div className="relative border-b border-slate-800 bg-slate-900/50" style={{ height: 32 }}>
            {months.map((m, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-r border-slate-700/50 flex items-center px-2"
                style={{ left: m.left, width: m.width }}>
                <span className="text-[11px] text-slate-400 font-semibold truncate">{m.label}</span>
              </div>
            ))}
          </div>

          {/* Week header */}
          <div className="relative border-b border-slate-800 bg-slate-950/30" style={{ height: 24 }}>
            {weeks.map((w, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-r border-slate-800/40 flex items-center justify-center"
                style={{ left: w.left, width: WEEK_PX }}>
                <span className="text-[9px] text-slate-600">{w.label}</span>
              </div>
            ))}
          </div>

          {/* Projects section header */}
          <div className="border-b border-slate-800 bg-slate-950/60" style={{ height: 24 }} />

          {/* Project rows */}
          {projectDates.map(({ p, start, end }) => {
            const left  = weekOffset(timelineStart, start) * WEEK_PX;
            const wks   = Math.max(1, (end.getTime() - start.getTime()) / (7 * 86_400_000));
            const width = wks * WEEK_PX - 4;
            const colour = projectColour.get(p.id) ?? "#475569";
            const phases = p.programme_phases ?? [];

            return (
              <div key={p.id} className="relative border-b border-slate-800/40" style={{ height: ROW_H }}>
                {/* Weekend background stripes (optional: skip for perf) */}

                {/* Project background bar */}
                <div className="absolute top-3 rounded-lg overflow-hidden"
                  style={{ left, width: Math.max(width, 8), height: ROW_H - 18, backgroundColor: `${colour}22`, border: `1px solid ${colour}55` }}>
                  {/* Phase segments within the project bar */}
                  {phases.map((ph, i) => {
                    const phStart = addDays(start, ph.startOffset);
                    const phCal   = workingDaysToCal(ph.manualDays ?? ph.calculatedDays);
                    const phEnd   = addDays(phStart, phCal);
                    const phLeft  = Math.max(0, (phStart.getTime() - start.getTime()) / (7 * 86_400_000)) * WEEK_PX;
                    const phWidth = Math.max(4, (phEnd.getTime() - phStart.getTime()) / (7 * 86_400_000)) * WEEK_PX;
                    const phH = ROW_H - 22;
                    return (
                      <div key={i}
                        className="absolute top-0 rounded-sm"
                        style={{ left: phLeft, width: phWidth, height: phH, backgroundColor: colour, opacity: 0.65 + (i % 3) * 0.1 }}
                        title={`${ph.name} — ${ph.manualDays ?? ph.calculatedDays} days`}
                      />
                    );
                  })}
                </div>

                {/* Project name label on bar */}
                <div className="absolute top-3 px-2 flex items-center pointer-events-none"
                  style={{ left, width: Math.max(width, 8), height: ROW_H - 18 }}>
                  <span className="text-[10px] font-semibold text-white truncate"
                    style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
                    {fmtDate(start)} – {fmtDate(end)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Gap overlays */}
          {gaps.map((g, i) => (
            <div key={i} className="absolute pointer-events-none"
              style={{ left: g.left, width: g.width, top: 56, bottom: 0, backgroundColor: "rgba(245,158,11,0.05)", borderLeft: "1px dashed rgba(245,158,11,0.3)", borderRight: "1px dashed rgba(245,158,11,0.3)" }}>
              <span className="absolute top-2 left-1 text-[9px] text-amber-500/70 font-medium">{g.label}</span>
            </div>
          ))}

          {/* Direct labour section header */}
          {directStaff.length > 0 && (
            <div className="border-b border-slate-800 border-t border-slate-700 bg-slate-950/60" style={{ height: 24 }}>
              <div className="absolute left-0 h-full border-t border-slate-700" style={{ width: totalPx }} />
            </div>
          )}

          {/* Direct labour rows */}
          {directStaff.map(s => renderRow(s))}

          {/* Overhead section header */}
          {overheadStaff.length > 0 && (
            <div className="border-b border-slate-800 border-t border-slate-700 bg-slate-950/60" style={{ height: 24 }} />
          )}

          {/* Overhead rows */}
          {overheadStaff.map(s => renderRow(s))}

          {/* Today line — spans full height */}
          {todayLeft > 0 && todayLeft < totalPx && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 pointer-events-none z-20"
              style={{ left: todayLeft }}>
              <div className="absolute -top-0.5 -left-2 bg-red-500 text-white text-[8px] px-1 rounded">today</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    active: "Live", completed: "Complete", closed: "Closed",
    estimating: "Estimating", proposal_sent: "Proposal Sent",
    lead: "Lead", won: "Won",
  };
  return map[s] ?? s;
}

// ── Demand vs Supply tab ──────────────────────────────────────────────────────

function DemandSupply({
  projects,
  staff,
  allocations,
  labourDemand,
}: {
  projects: Project[];
  staff: Staff[];
  allocations: Allocation[];
  labourDemand: LabourDemand[];
}) {
  // Aggregate total demand per trade across all projects
  const demandByTrade = new Map<string, number>();
  for (const d of labourDemand) {
    for (const t of d.by_trade) {
      demandByTrade.set(t.trade, (demandByTrade.get(t.trade) ?? 0) + t.hours);
    }
  }

  // Aggregate allocated days per trade
  const allocByTrade = new Map<string, number>();
  for (const a of allocations) {
    if (a.trade_section) {
      allocByTrade.set(a.trade_section, (allocByTrade.get(a.trade_section) ?? 0) + a.days_allocated);
    }
  }

  const trades = Array.from(new Set([...demandByTrade.keys(), ...allocByTrade.keys()])).sort();

  return (
    <div className="space-y-6">
      {/* Per-project demand */}
      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Labour Demand by Project</h3>
        <div className="space-y-3">
          {projects.map(p => {
            const demand = labourDemand.find(d => d.project_id === p.id);
            if (!demand) return null;
            const totalDays = demand.by_trade.reduce((s, t) => s + t.hours / 8, 0);
            return (
              <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">{statusLabel(p.status)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{totalDays.toFixed(0)}</p>
                    <p className="text-[10px] text-slate-500">total labour days</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {demand.by_trade.sort((a, b) => b.hours - a.hours).map(t => (
                    <div key={t.trade} className="bg-slate-800 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-slate-400 truncate">{t.trade}</p>
                      <p className="text-sm font-semibold text-white">{(t.hours / 8).toFixed(1)} <span className="text-xs text-slate-500">days</span></p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-project trade summary */}
      {trades.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Trade Summary — Demand vs Allocated</h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Trade</th>
                  <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Demand (days)</th>
                  <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Allocated (days)</th>
                  <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Gap</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, i) => {
                  const demand = (demandByTrade.get(trade) ?? 0) / 8;
                  const alloc  = allocByTrade.get(trade) ?? 0;
                  const gap    = demand - alloc;
                  return (
                    <tr key={trade} className={i < trades.length - 1 ? "border-b border-slate-800/50" : ""}>
                      <td className="px-4 py-3 text-white font-medium">{trade}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{demand.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{alloc.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right">
                        {gap > 0.5 ? (
                          <span className="text-amber-400 font-medium">-{gap.toFixed(1)} unallocated</span>
                        ) : gap < -0.5 ? (
                          <span className="text-red-400 font-medium">+{Math.abs(gap).toFixed(1)} over</span>
                        ) : (
                          <span className="text-emerald-400 font-medium">✓ covered</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {trades.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
          <BarChart2 className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-500 text-sm">No estimate data yet.</p>
          <p className="text-slate-600 text-xs mt-1">Build out estimates on your projects to see labour demand here.</p>
        </div>
      )}
    </div>
  );
}

// ── Manage Allocations tab ────────────────────────────────────────────────────

function ManageAllocations({
  projects,
  staff,
  allocations,
  absences,
  labourDemand,
  onRefresh,
}: {
  projects: Project[];
  staff: Staff[];
  allocations: Allocation[];
  absences: Absence[];
  labourDemand: LabourDemand[];
  onRefresh: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    staff_resource_id: staff[0]?.id ?? "",
    absence_type: "Holiday",
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  async function handleSaveAllocation(data: AllocationFormData) {
    const daysPerWeek = parseFloat(data.days_per_week) || 5;
    const start = new Date(data.start_date + "T00:00:00");
    const end   = new Date(data.end_date + "T00:00:00");
    const calDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    const days = Math.round((calDays / 7) * daysPerWeek * 10) / 10;

    startTransition(async () => {
      const res = await upsertAllocationAction({
        project_id:        data.project_id,
        staff_resource_id: data.staff_resource_id || null,
        role_placeholder:  data.role_placeholder || undefined,
        trade_section:     data.trade_section || undefined,
        phase_name:        data.phase_name || undefined,
        start_date:        data.start_date,
        end_date:          data.end_date,
        days_allocated:    days || 1,
        days_per_week:     daysPerWeek,
        is_confirmed:      data.is_confirmed,
        notes:             data.notes || undefined,
      });
      if (res.error) toast.error(res.error);
      else { toast.success("Allocation added"); setShowModal(false); }
    });
  }

  async function handleDeleteAllocation(id: string) {
    startTransition(async () => {
      const res = await deleteAllocationAction(id);
      if (res.error) toast.error(res.error);
      else toast.success("Allocation removed");
    });
  }

  async function handleSaveAbsence() {
    startTransition(async () => {
      const res = await upsertAbsenceAction(absenceForm);
      if (res.error) toast.error(res.error);
      else { toast.success("Absence recorded"); setShowAbsenceForm(false); }
    });
  }

  async function handleDeleteAbsence(id: string) {
    startTransition(async () => {
      const res = await deleteAbsenceAction(id);
      if (res.error) toast.error(res.error);
      else toast.success("Absence removed");
    });
  }

  const projectMap = new Map(projects.map(p => [p.id, p]));
  const staffMap   = new Map(staff.map(s => [s.id, s]));

  const allocsByProject = new Map<string, Allocation[]>();
  for (const a of allocations) {
    if (!allocsByProject.has(a.project_id)) allocsByProject.set(a.project_id, []);
    allocsByProject.get(a.project_id)!.push(a);
  }

  return (
    <div className="space-y-6">
      {/* Actions row */}
      <div className="flex gap-3">
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Allocation
        </button>
        <button onClick={() => setShowAbsenceForm(!showAbsenceForm)}
          className="flex items-center gap-2 border border-slate-700 text-slate-300 hover:text-white text-sm px-4 py-2 rounded-lg transition-colors">
          <CalendarDays className="w-4 h-4" /> Record Absence
        </button>
      </div>

      {/* Absence form */}
      {showAbsenceForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Record Absence / Leave</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Person</label>
              <select value={absenceForm.staff_resource_id}
                onChange={e => setAbsenceForm(f => ({ ...f, staff_resource_id: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select value={absenceForm.absence_type}
                onChange={e => setAbsenceForm(f => ({ ...f, absence_type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {["Holiday","Training","Other"].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">From</label>
              <input type="date" value={absenceForm.start_date}
                onChange={e => setAbsenceForm(f => ({ ...f, start_date: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">To</label>
              <input type="date" value={absenceForm.end_date}
                onChange={e => setAbsenceForm(f => ({ ...f, end_date: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3 mt-3">
            <button onClick={handleSaveAbsence}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors">
              Save
            </button>
            <button onClick={() => setShowAbsenceForm(false)}
              className="text-slate-400 hover:text-white text-sm px-4 py-2 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Allocations by project */}
      {allocations.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
          <Users className="w-8 h-8 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-500 text-sm">No allocations yet.</p>
          <p className="text-slate-600 text-xs mt-1">Assign your staff to projects to track utilisation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(allocsByProject.entries()).map(([projectId, pallocs]) => {
            const proj = projectMap.get(projectId);
            return (
              <div key={projectId} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PROJECT_PALETTE[projects.findIndex(p => p.id === projectId) % PROJECT_PALETTE.length] }} />
                  <p className="text-sm font-semibold text-white">{proj?.name ?? "Unknown project"}</p>
                  <span className="text-xs text-slate-500 ml-auto">{statusLabel(proj?.status ?? "")}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800/50">
                      <th className="text-left px-4 py-2 text-xs text-slate-500 font-medium">Person / Role</th>
                      <th className="text-left px-4 py-2 text-xs text-slate-500 font-medium hidden sm:table-cell">Trade</th>
                      <th className="text-left px-4 py-2 text-xs text-slate-500 font-medium hidden md:table-cell">Dates</th>
                      <th className="text-right px-4 py-2 text-xs text-slate-500 font-medium">Days</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pallocs.map((a, i) => {
                      const person = a.staff_resource_id ? staffMap.get(a.staff_resource_id) : null;
                      return (
                        <tr key={a.id} className={i < pallocs.length - 1 ? "border-b border-slate-800/40" : ""}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {!a.is_confirmed && <span className="text-[9px] text-amber-400 border border-amber-700/40 rounded px-1">tentative</span>}
                              <span className="text-white">{person?.name ?? a.role_placeholder ?? "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-400 hidden sm:table-cell">{a.trade_section ?? "—"}</td>
                          <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell">
                            {new Date(a.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            {" – "}
                            {new Date(a.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-white">{a.days_allocated}</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleDeleteAllocation(a.id)}
                              className="text-slate-600 hover:text-red-400 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Absences */}
      {absences.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Upcoming Absences</h3>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Person</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Type</th>
                  <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Dates</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {absences.map((a, i) => {
                  const person = staffMap.get(a.staff_resource_id);
                  return (
                    <tr key={a.id} className={i < absences.length - 1 ? "border-b border-slate-800/50" : ""}>
                      <td className="px-4 py-3 text-white">{person?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-400">{a.absence_type}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {new Date(a.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        {" – "}
                        {new Date(a.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleDeleteAbsence(a.id)}
                          className="text-slate-600 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <AllocationModal
          projects={projects}
          staff={staff}
          labourDemand={labourDemand}
          onClose={() => setShowModal(false)}
          onSave={handleSaveAllocation}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS = [
  { id: "timeline",    label: "Portfolio Timeline", icon: CalendarDays },
  { id: "allocations", label: "Manage Allocations", icon: Users },
  { id: "demand",      label: "Demand vs Supply",   icon: BarChart2 },
] as const;

type TabId = typeof TABS[number]["id"];

export default function PortfolioClient({ projects, staff, allocations, absences, labourDemand }: Props) {
  const [tab, setTab] = useState<TabId>("timeline");
  const [isPending, startTransition] = useTransition();

  const conflictCount = (() => {
    const ids = new Set<string>();
    for (const s of staff) {
      const sa = allocations.filter(a => a.staff_resource_id === s.id);
      for (let i = 0; i < sa.length; i++) {
        for (let j = i + 1; j < sa.length; j++) {
          const a = sa[i], b = sa[j];
          if (new Date(a.start_date) <= new Date(b.end_date) && new Date(b.start_date) <= new Date(a.end_date)) {
            ids.add(s.id);
          }
        }
      }
    }
    return ids.size;
  })();

  return (
    <div className="p-6 pt-10 space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Resource Portfolio</h1>
          <p className="text-slate-400 mt-1">
            All projects on one timeline — see where your people are, where the gaps are, and where you're stretched.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <p className="text-lg font-bold text-white">{projects.length}</p>
            <p className="text-[10px] text-slate-500">projects</p>
          </div>
          <div className="text-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <p className="text-lg font-bold text-white">{staff.length}</p>
            <p className="text-[10px] text-slate-500">people</p>
          </div>
          {conflictCount > 0 && (
            <div className="text-center bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2">
              <p className="text-lg font-bold text-red-400">{conflictCount}</p>
              <p className="text-[10px] text-red-500">conflicts</p>
            </div>
          )}
        </div>
      </div>

      {/* Conflict banner */}
      {conflictCount > 0 && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-700/40 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">
            <span className="font-semibold">{conflictCount} resource conflict{conflictCount > 1 ? "s" : ""} detected.</span>{" "}
            The same person is allocated to overlapping projects. Review highlighted bars on the timeline.
          </p>
        </div>
      )}

      {/* Staff type info */}
      {staff.length === 0 && (
        <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-700/40 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-sm text-blue-300">
            Add your team in <a href="/dashboard/resources/staff" className="underline hover:text-blue-200">Labour Rates</a> first.
            Direct labour shows on project timelines; overhead/head office staff are tracked separately for management accounts.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-1">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t.id
                  ? "bg-slate-900 text-white border border-b-0 border-slate-800"
                  : "text-slate-500 hover:text-slate-300"
              }`}>
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "timeline" && (
        <PortfolioTimeline
          projects={projects}
          staff={staff}
          allocations={allocations}
          absences={absences}
        />
      )}

      {tab === "allocations" && (
        <ManageAllocations
          projects={projects}
          staff={staff}
          allocations={allocations}
          absences={absences}
          labourDemand={labourDemand}
          onRefresh={() => {}}
        />
      )}

      {tab === "demand" && (
        <DemandSupply
          projects={projects}
          staff={staff}
          allocations={allocations}
          labourDemand={labourDemand}
        />
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500 pt-2 border-t border-slate-800/50">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/60 border border-blue-500/40" /> Project bar (phased)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm border border-dashed border-slate-500" /> Absence / leave</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500/50" /> Workload gap</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-900/50 ring-1 ring-red-500" /> Conflict</span>
        <span className="flex items-center gap-1.5"><span className="w-0.5 h-3 bg-red-500" /> Today</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-600/50 border border-dashed border-white/20" /> Tentative allocation</span>
      </div>
    </div>
  );
}
