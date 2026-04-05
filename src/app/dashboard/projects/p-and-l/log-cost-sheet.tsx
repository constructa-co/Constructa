"use client";

import React, { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { logCostAction } from "./actions";
import { TRADE_SECTIONS } from "./constants";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StaffResource {
  id: string;
  name: string;
  role?: string | null;
  job_title?: string | null;
  // Rate mode
  rate_mode: string;               // 'simple' | 'full'
  hourly_chargeout_rate: number;   // used in simple mode
  overtime_chargeout_rate: number;
  // Full buildup fields
  annual_salary: number;
  employer_ni_pct: number;
  employer_pension_pct: number;
  company_car_annual: number;
  car_allowance_annual: number;
  mobile_phone_annual: number;
  it_costs_annual: number;
  life_insurance_annual: number;
  other_benefits_annual: number;
  annual_working_days: number;
  holiday_days: number;
  public_holiday_days: number;
  overhead_absorption_pct: number;
  profit_uplift_pct: number;
}

export interface PlantResource {
  id: string;
  name: string;
  category: string;
  purchase_price: number;
  depreciation_years: number;
  residual_value: number;
  finance_cost_annual: number;
  maintenance_annual: number;
  insurance_annual: number;
  other_annual_costs: number;
  utilisation_months: number;
  working_days_per_month: number;
  profit_uplift_pct: number;
}

export interface EstimateLine {
  id: string;
  trade_section: string;
  description: string;
  line_total: number;
}

export interface LogCostSheetProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffCatalogue: StaffResource[];
  plantCatalogue: PlantResource[];
  totalCostsToDate: number;
  estimateLines: EstimateLine[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function gbp(n: number): string {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function calcStaffDailyChargeout(s: StaffResource): number {
  if (s.rate_mode === "simple") return s.hourly_chargeout_rate * 8;
  const niCost = s.annual_salary * (s.employer_ni_pct / 100);
  const pensionCost = s.annual_salary * (s.employer_pension_pct / 100);
  const totalAnnualCost =
    s.annual_salary +
    niCost +
    pensionCost +
    s.company_car_annual +
    (s.car_allowance_annual ?? 0) +
    (s.mobile_phone_annual ?? 0) +
    s.it_costs_annual +
    s.life_insurance_annual +
    s.other_benefits_annual;
  const workingDays = s.annual_working_days - s.holiday_days - s.public_holiday_days;
  if (workingDays <= 0) return 0;
  const dailyBase = totalAnnualCost / workingDays;
  const withOverhead = dailyBase * (1 + s.overhead_absorption_pct / 100);
  return withOverhead * (1 + s.profit_uplift_pct / 100);
}

function calcPlantDailyChargeout(p: PlantResource): number {
  const annualDepreciation =
    p.depreciation_years > 0
      ? (p.purchase_price - p.residual_value) / p.depreciation_years
      : 0;
  const runningCosts =
    p.finance_cost_annual +
    p.maintenance_annual +
    p.insurance_annual +
    p.other_annual_costs;
  const totalAnnual = annualDepreciation + runningCosts;
  const utilisationDays = p.utilisation_months * p.working_days_per_month;
  if (utilisationDays <= 0) return 0;
  return (totalAnnual / utilisationDays) * (1 + p.profit_uplift_pct / 100);
}

// ── Shared sub-components ──────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  qty: number;
  qtyUnit: string;
  rate: number;
  total: number;
}

function SummaryCard({ label, qty, qtyUnit, rate, total }: SummaryCardProps) {
  if (!label || qty <= 0) return null;
  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-1">
      <p className="text-sm text-slate-300 font-medium">{label}</p>
      <p className="text-slate-400 text-sm">
        {qty} {qtyUnit} @ {gbp(rate)}/{qtyUnit}
      </p>
      <p className="text-2xl font-bold text-blue-400">{gbp(total)}</p>
    </div>
  );
}

interface FieldRowProps {
  label: string;
  children: React.ReactNode;
}

function FieldRow({ label, children }: FieldRowProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-slate-300 text-sm">{label}</Label>
      {children}
    </div>
  );
}

const inputCls =
  "bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 focus-visible:ring-blue-500 focus-visible:border-blue-500";

const selectContentCls = "bg-slate-800 border-slate-700 text-slate-100";

// ── WBS Picker — replaces generic trade section dropdown ──────────────────────
// mode "section": pick a trade section only (for Labour — spans multiple activities)
// mode "line":    pick a section, then optionally a specific estimate line item
function WBSPicker({
  lines,
  mode,
  tradeSection,
  lineId,
  onChange,
}: {
  lines: EstimateLine[];
  mode: "section" | "line";
  tradeSection: string;
  lineId: string;
  onChange: (tradeSection: string, lineId: string) => void;
}) {
  // Derive distinct sections from estimate lines
  const sections = [...new Set(lines.map((l) => l.trade_section).filter(Boolean))].sort();
  const linesInSection = lines.filter((l) => l.trade_section === tradeSection);

  // If no estimate lines — fall back to TRADE_SECTIONS constants
  if (sections.length === 0) {
    return (
      <FieldRow label="Trade Section">
        <Select value={tradeSection} onValueChange={(v) => onChange(v, "")}>
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="Select trade section" />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {TRADE_SECTIONS.map((t) => (
              <SelectItem key={t} value={t} className="text-slate-100 focus:bg-slate-700">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FieldRow>
    );
  }

  return (
    <div className="space-y-2">
      <FieldRow label={mode === "line" ? "WBS Section" : "Trade Section (WBS)"}>
        <Select
          value={tradeSection}
          onValueChange={(v) => onChange(v, "")}
        >
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="Select from estimate…" />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {sections.map((s) => (
              <SelectItem key={s} value={s} className="text-slate-100 focus:bg-slate-700">{s}</SelectItem>
            ))}
            <SelectItem value="__other" className="text-slate-500 focus:bg-slate-700 italic">
              Other / not in estimate
            </SelectItem>
          </SelectContent>
        </Select>
      </FieldRow>

      {/* Manual fallback when "Other" selected */}
      {tradeSection === "__other" && (
        <Select value={lineId} onValueChange={(v) => onChange("__other_manual_" + v, v)}>
          <SelectTrigger className={inputCls}>
            <SelectValue placeholder="Specify section…" />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {TRADE_SECTIONS.map((t) => (
              <SelectItem key={t} value={t} className="text-slate-100 focus:bg-slate-700">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Line item picker — only in "line" mode when a real section is selected */}
      {mode === "line" && tradeSection && tradeSection !== "__other" && linesInSection.length > 0 && (
        <FieldRow label="Specific Activity (optional)">
          <Select value={lineId} onValueChange={(v) => onChange(tradeSection, v)}>
            <SelectTrigger className={inputCls}>
              <SelectValue placeholder="Select activity or leave blank for section only" />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              <SelectItem value="" className="text-slate-500 focus:bg-slate-700 italic">
                — Section only —
              </SelectItem>
              {linesInSection.map((l) => (
                <SelectItem key={l.id} value={l.id} className="text-slate-100 focus:bg-slate-700">
                  {l.description}
                  {l.line_total > 0 && (
                    <span className="ml-2 text-slate-500 text-xs">
                      ({gbp(l.line_total)})
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
      )}
    </div>
  );
}

function DateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldRow label="Date">
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </FieldRow>
  );
}

function NotesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldRow label="Notes (optional)">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder="Any additional notes…"
        className={`${inputCls} resize-none`}
      />
    </FieldRow>
  );
}

// ── Tab 1: Labour ─────────────────────────────────────────────────────────────

type LabourTimeUnit = "hours" | "half_days" | "days";

interface LabourState {
  mode: "catalogue" | "manual";
  staffId: string;
  qty: string;              // quantity of timeUnit
  timeUnit: LabourTimeUnit;
  description: string;
  amount: string;
  tradeSection: string;
  lineId: string;
  date: string;
  notes: string;
}

const labourDefault: LabourState = {
  mode: "catalogue",
  staffId: "",
  qty: "",
  timeUnit: "days",
  description: "",
  amount: "",
  tradeSection: "",
  lineId: "",
  date: today(),
  notes: "",
};

interface LabourTabProps {
  staffCatalogue: StaffResource[];
  projectId: string;
  estimateLines: EstimateLine[];
  onDone: () => void;
}

function LabourTab({ staffCatalogue, projectId, estimateLines, onDone }: LabourTabProps) {
  const [form, setForm] = useState<LabourState>(labourDefault);
  const [isPending, startTransition] = useTransition();

  const set = useCallback(
    <K extends keyof LabourState>(key: K, value: LabourState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const useCatalogue = form.mode === "catalogue" && staffCatalogue.length > 0;
  const selectedStaff = staffCatalogue.find((s) => s.id === form.staffId) ?? null;
  const dailyRate = selectedStaff ? calcStaffDailyChargeout(selectedStaff) : 0;
  const hourlyRate = dailyRate / 8;

  const qty = parseFloat(form.qty) || 0;

  // Calculate amount based on time unit
  function calcAmount(): number {
    if (!selectedStaff) return 0;
    switch (form.timeUnit) {
      case "hours":     return hourlyRate * qty;
      case "half_days": return dailyRate * 0.5 * qty;
      case "days":      return dailyRate * qty;
    }
  }

  const catalogueTotal = calcAmount();

  const timeUnitLabels: Record<LabourTimeUnit, string> = {
    hours: "hrs",
    half_days: "half-days",
    days: "days",
  };

  // Resolve trade section (handle "Other" fallback)
  const resolvedSection = form.tradeSection.startsWith("__other_manual_")
    ? form.tradeSection.replace("__other_manual_", "")
    : form.tradeSection === "__other" ? "" : form.tradeSection;

  function validate(): string | null {
    if (useCatalogue) {
      if (!form.staffId) return "Please select a team member.";
      if (qty <= 0) return "Please enter a valid time allocation.";
      if (catalogueTotal <= 0) return "Calculated cost is £0 — check this staff member's rate setup.";
    } else {
      if (!form.description.trim()) return "Description is required.";
      if (parseFloat(form.amount) <= 0) return "Please enter a valid amount.";
    }
    if (!resolvedSection) return "Please select a trade section / WBS item.";
    if (!form.date) return "Please select a date.";
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { toast.error(err); return; }

    const amount = useCatalogue ? catalogueTotal : parseFloat(form.amount);
    const staffRole = selectedStaff ? (selectedStaff.job_title || selectedStaff.role || null) : null;
    const timeLabel = `${qty} ${timeUnitLabels[form.timeUnit]}`;
    const description = useCatalogue
      ? `${selectedStaff!.name}${staffRole ? ` (${staffRole})` : ""} — ${timeLabel}`
      : form.description.trim();

    startTransition(async () => {
      const res = await logCostAction({
        projectId,
        description,
        amount,
        cost_type: "labour",
        trade_section: resolvedSection,
        expense_date: form.date,
        supplier: useCatalogue ? selectedStaff!.id : undefined,
        estimate_line_id: form.lineId || undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Labour cost logged.");
        setForm(labourDefault);
        onDone();
      }
    });
  }

  return (
    <div className="space-y-4">
      {staffCatalogue.length > 0 && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => set("mode", "catalogue")}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${form.mode === "catalogue" ? "bg-blue-600 border-blue-600 text-white" : "border-slate-600 text-slate-400 hover:border-slate-500"}`}>
            From Catalogue
          </button>
          <button type="button" onClick={() => set("mode", "manual")}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${form.mode === "manual" ? "bg-blue-600 border-blue-600 text-white" : "border-slate-600 text-slate-400 hover:border-slate-500"}`}>
            Add Manually
          </button>
        </div>
      )}

      {useCatalogue ? (
        <>
          <FieldRow label="Team Member">
            <Select value={form.staffId} onValueChange={(v) => set("staffId", v)}>
              <SelectTrigger className={inputCls}><SelectValue placeholder="Select team member" /></SelectTrigger>
              <SelectContent className={selectContentCls}>
                {staffCatalogue.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-slate-100 focus:bg-slate-700">
                    {s.name}{(s.job_title || s.role) ? ` — ${s.job_title || s.role}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {selectedStaff && (
            <div className="grid grid-cols-3 gap-2 text-xs bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700">
              <div><span className="text-slate-500">Hourly: </span><span className="text-slate-200 font-medium">{gbp(hourlyRate)}</span></div>
              <div><span className="text-slate-500">Daily: </span><span className="text-slate-200 font-medium">{gbp(dailyRate)}</span></div>
              <div><span className="text-slate-500">Half-day: </span><span className="text-slate-200 font-medium">{gbp(dailyRate * 0.5)}</span></div>
            </div>
          )}

          {/* Time allocation with unit picker */}
          <FieldRow label="Time Allocation">
            <div className="flex gap-2">
              <Input
                type="number" min="0" step="0.5"
                value={form.qty}
                onChange={(e) => set("qty", e.target.value)}
                placeholder="e.g. 4"
                className={`${inputCls} flex-1`}
              />
              <Select value={form.timeUnit} onValueChange={(v) => set("timeUnit", v as LabourTimeUnit)}>
                <SelectTrigger className={`${inputCls} w-36`}><SelectValue /></SelectTrigger>
                <SelectContent className={selectContentCls}>
                  <SelectItem value="hours" className="text-slate-100 focus:bg-slate-700">Hours</SelectItem>
                  <SelectItem value="half_days" className="text-slate-100 focus:bg-slate-700">Half Days</SelectItem>
                  <SelectItem value="days" className="text-slate-100 focus:bg-slate-700">Full Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FieldRow>

          {selectedStaff && qty > 0 && (
            <SummaryCard
              label={`${selectedStaff.name}${selectedStaff.role ? ` (${selectedStaff.role})` : ""}`}
              qty={qty}
              qtyUnit={timeUnitLabels[form.timeUnit]}
              rate={form.timeUnit === "hours" ? hourlyRate : form.timeUnit === "half_days" ? dailyRate * 0.5 : dailyRate}
              total={catalogueTotal}
            />
          )}
        </>
      ) : (
        <>
          <FieldRow label="Description">
            <Input value={form.description} onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Site foreman — week 3" className={inputCls} />
          </FieldRow>
          <FieldRow label="Amount (£)">
            <Input type="number" min="0" step="0.01" value={form.amount}
              onChange={(e) => set("amount", e.target.value)} placeholder="0.00" className={inputCls} />
          </FieldRow>
        </>
      )}

      {/* WBS — section-level for labour (spans multiple activities) */}
      <WBSPicker
        lines={estimateLines}
        mode="section"
        tradeSection={form.tradeSection}
        lineId={form.lineId}
        onChange={(s, l) => { set("tradeSection", s); set("lineId", l); }}
      />
      <DateField value={form.date} onChange={(v) => set("date", v)} />
      <NotesField value={form.notes} onChange={(v) => set("notes", v)} />

      <Button onClick={handleSubmit} disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Log Labour Cost"}
      </Button>
    </div>
  );
}

// ── Tab 2: Plant — Owned ───────────────────────────────────────────────────────

interface PlantOwnedState {
  mode: "catalogue" | "manual";
  plantId: string;
  days: string;
  description: string;
  amount: string;
  tradeSection: string;
  lineId: string;
  date: string;
  notes: string;
}

const plantOwnedDefault: PlantOwnedState = {
  mode: "catalogue",
  plantId: "",
  days: "",
  description: "",
  amount: "",
  tradeSection: "",
  lineId: "",
  date: today(),
  notes: "",
};

interface PlantOwnedTabProps {
  plantCatalogue: PlantResource[];
  projectId: string;
  estimateLines: EstimateLine[];
  onDone: () => void;
}

function PlantOwnedTab({ plantCatalogue, projectId, estimateLines, onDone }: PlantOwnedTabProps) {
  const [form, setForm] = useState<PlantOwnedState>(plantOwnedDefault);
  const [isPending, startTransition] = useTransition();

  const set = useCallback(
    <K extends keyof PlantOwnedState>(key: K, value: PlantOwnedState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const useCatalogue = form.mode === "catalogue" && plantCatalogue.length > 0;
  const selectedPlant = plantCatalogue.find((p) => p.id === form.plantId) ?? null;
  const dailyRate = selectedPlant ? calcPlantDailyChargeout(selectedPlant) : 0;
  const days = parseFloat(form.days) || 0;
  const catalogueTotal = dailyRate * days;

  const resolvedSection = form.tradeSection.startsWith("__other_manual_")
    ? form.tradeSection.replace("__other_manual_", "")
    : form.tradeSection === "__other" ? "" : form.tradeSection;

  function validate(): string | null {
    if (useCatalogue) {
      if (!form.plantId) return "Please select a plant item.";
      if (days <= 0) return "Please enter a valid number of days.";
      if (catalogueTotal <= 0) return "Daily rate is £0 — check this plant item's rate setup.";
    } else {
      if (!form.description.trim()) return "Description is required.";
      if (parseFloat(form.amount) <= 0) return "Please enter a valid amount.";
    }
    if (!resolvedSection) return "Please select a trade section / WBS item.";
    if (!form.date) return "Please select a date.";
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { toast.error(err); return; }

    const amount = useCatalogue ? catalogueTotal : parseFloat(form.amount);
    const description = useCatalogue
      ? `${selectedPlant!.name} (${selectedPlant!.category}) — ${days} day${days !== 1 ? "s" : ""}`
      : form.description.trim();

    startTransition(async () => {
      const res = await logCostAction({
        projectId,
        description,
        amount,
        cost_type: "plant",
        trade_section: resolvedSection,
        expense_date: form.date,
        estimate_line_id: form.lineId || undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Plant cost logged.");
        setForm(plantOwnedDefault);
        onDone();
      }
    });
  }

  return (
    <div className="space-y-4">
      {plantCatalogue.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => set("mode", "catalogue")}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              form.mode === "catalogue"
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-slate-600 text-slate-400 hover:border-slate-500"
            }`}
          >
            From Catalogue
          </button>
          <button
            type="button"
            onClick={() => set("mode", "manual")}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              form.mode === "manual"
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-slate-600 text-slate-400 hover:border-slate-500"
            }`}
          >
            Add Manually
          </button>
        </div>
      )}

      {useCatalogue ? (
        <>
          <FieldRow label="Plant / Equipment">
            <Select value={form.plantId} onValueChange={(v) => set("plantId", v)}>
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder="Select plant/equipment" />
              </SelectTrigger>
              <SelectContent className={selectContentCls}>
                {plantCatalogue.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-slate-100 focus:bg-slate-700">
                    {p.name} — {p.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          {selectedPlant && (
            <div className="text-sm text-slate-400 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700">
              Daily chargeout rate:{" "}
              <span className="text-slate-200 font-medium">{gbp(dailyRate)}/day</span>
            </div>
          )}

          <FieldRow label="Number of Days">
            <Input
              type="number"
              min="0"
              step="0.5"
              value={form.days}
              onChange={(e) => set("days", e.target.value)}
              placeholder="e.g. 5"
              className={inputCls}
            />
          </FieldRow>

          {selectedPlant && days > 0 && (
            <SummaryCard
              label={`${selectedPlant.name} (${selectedPlant.category})`}
              qty={days}
              qtyUnit="days"
              rate={dailyRate}
              total={catalogueTotal}
            />
          )}
        </>
      ) : (
        <>
          <FieldRow label="Description">
            <Input
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. Excavator hire — 3 days"
              className={inputCls}
            />
          </FieldRow>
          <FieldRow label="Amount (£)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
          </FieldRow>
        </>
      )}

      <WBSPicker
        lines={estimateLines}
        mode="line"
        tradeSection={form.tradeSection}
        lineId={form.lineId}
        onChange={(s, l) => { set("tradeSection", s); set("lineId", l); }}
      />
      <DateField value={form.date} onChange={(v) => set("date", v)} />
      <NotesField value={form.notes} onChange={(v) => set("notes", v)} />

      <Button onClick={handleSubmit} disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Log Owned Plant Cost"}
      </Button>
    </div>
  );
}

// ── Tab 3: Plant — Hired ──────────────────────────────────────────────────────

type HireRateType = "daily" | "weekly" | "monthly";

interface PlantHiredState {
  supplier: string;
  equipmentDescription: string;
  hireRateType: HireRateType;
  hireRate: string;
  quantity: string;
  deliveryCharge: string;
  collectionCharge: string;
  invoiceRef: string;
  tradeSection: string;
  lineId: string;
  date: string;
}

const plantHiredDefault: PlantHiredState = {
  supplier: "",
  equipmentDescription: "",
  hireRateType: "daily",
  hireRate: "",
  quantity: "",
  deliveryCharge: "",
  collectionCharge: "",
  invoiceRef: "",
  tradeSection: "",
  lineId: "",
  date: today(),
};

interface PlantHiredTabProps {
  projectId: string;
  estimateLines: EstimateLine[];
  onDone: () => void;
}

function PlantHiredTab({ projectId, estimateLines, onDone }: PlantHiredTabProps) {
  const [form, setForm] = useState<PlantHiredState>(plantHiredDefault);
  const [isPending, startTransition] = useTransition();

  const set = useCallback(
    <K extends keyof PlantHiredState>(key: K, value: PlantHiredState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const rate = parseFloat(form.hireRate) || 0;
  const qty = parseFloat(form.quantity) || 0;
  const delivery = parseFloat(form.deliveryCharge) || 0;
  const collection = parseFloat(form.collectionCharge) || 0;
  const total = rate * qty + delivery + collection;

  const rateUnitLabel: Record<HireRateType, string> = {
    daily: "days",
    weekly: "weeks",
    monthly: "months",
  };

  const resolvedSection = form.tradeSection.startsWith("__other_manual_")
    ? form.tradeSection.replace("__other_manual_", "")
    : form.tradeSection === "__other" ? "" : form.tradeSection;

  function validate(): string | null {
    if (!form.equipmentDescription.trim()) return "Equipment description is required.";
    if (rate <= 0) return "Please enter a valid hire rate.";
    if (qty <= 0) return "Please enter a valid quantity.";
    if (!resolvedSection) return "Please select a trade section / WBS item.";
    if (!form.date) return "Please select a date.";
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { toast.error(err); return; }

    const description = `${form.equipmentDescription.trim()}${form.supplier ? ` — ${form.supplier.trim()}` : ""} (${qty} ${rateUnitLabel[form.hireRateType]} hire)`;

    startTransition(async () => {
      const res = await logCostAction({
        projectId,
        description,
        amount: total,
        cost_type: "plant",
        trade_section: resolvedSection,
        expense_date: form.date,
        supplier: form.supplier.trim() || undefined,
        estimate_line_id: form.lineId || undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Hired plant cost logged.");
        setForm(plantHiredDefault);
        onDone();
      }
    });
  }

  return (
    <div className="space-y-4">
      <FieldRow label="Supplier">
        <Input
          value={form.supplier}
          onChange={(e) => set("supplier", e.target.value)}
          placeholder="e.g. HSS Hire"
          className={inputCls}
        />
      </FieldRow>

      <FieldRow label="Equipment Description *">
        <Input
          value={form.equipmentDescription}
          onChange={(e) => set("equipmentDescription", e.target.value)}
          placeholder="e.g. 3T Mini Excavator with operator"
          className={inputCls}
        />
      </FieldRow>

      <FieldRow label="Hire Rate Type">
        <div className="flex gap-2">
          {(["daily", "weekly", "monthly"] as HireRateType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("hireRateType", t)}
              className={`flex-1 text-sm py-2 rounded-lg border transition-colors capitalize ${
                form.hireRateType === t
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "border-slate-600 text-slate-400 hover:border-slate-500 bg-slate-800"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Hire Rate (£)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.hireRate}
            onChange={(e) => set("hireRate", e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </FieldRow>
        <FieldRow label={`Quantity (${rateUnitLabel[form.hireRateType]})`}>
          <Input
            type="number"
            min="0"
            step="1"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </FieldRow>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Delivery Charge (£)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.deliveryCharge}
            onChange={(e) => set("deliveryCharge", e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </FieldRow>
        <FieldRow label="Collection Charge (£)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.collectionCharge}
            onChange={(e) => set("collectionCharge", e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </FieldRow>
      </div>

      <FieldRow label="Invoice Reference (optional)">
        <Input
          value={form.invoiceRef}
          onChange={(e) => set("invoiceRef", e.target.value)}
          placeholder="e.g. INV-00234"
          className={inputCls}
        />
      </FieldRow>

      {total > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-1">
          <p className="text-sm text-slate-300 font-medium">
            {form.equipmentDescription || "Hired plant"}
          </p>
          <p className="text-slate-400 text-sm">
            {qty} {rateUnitLabel[form.hireRateType]} @ {gbp(rate)}
            {delivery > 0 && ` + ${gbp(delivery)} delivery`}
            {collection > 0 && ` + ${gbp(collection)} collection`}
          </p>
          <p className="text-2xl font-bold text-blue-400">{gbp(total)}</p>
        </div>
      )}

      <WBSPicker
        lines={estimateLines}
        mode="line"
        tradeSection={form.tradeSection}
        lineId={form.lineId}
        onChange={(s, l) => { set("tradeSection", s); set("lineId", l); }}
      />
      <DateField value={form.date} onChange={(v) => set("date", v)} />

      <Button onClick={handleSubmit} disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Log Hired Plant Cost"}
      </Button>
    </div>
  );
}

// ── Tab 4: Materials ──────────────────────────────────────────────────────────

type MaterialUnit = "m2" | "m3" | "m" | "nr" | "tonne" | "kg" | "bag" | "sheet" | "length" | "item";

const MATERIAL_UNITS: MaterialUnit[] = ["m2", "m3", "m", "nr", "tonne", "kg", "bag", "sheet", "length", "item"];

interface MaterialsState {
  supplier: string;
  description: string;
  quantity: string;
  unit: MaterialUnit;
  unitRate: string;
  deliveryCharge: string;
  invoiceRef: string;
  tradeSection: string;
  lineId: string;
  date: string;
}

const materialsDefault: MaterialsState = {
  supplier: "",
  description: "",
  quantity: "",
  unit: "nr",
  unitRate: "",
  deliveryCharge: "",
  invoiceRef: "",
  tradeSection: "",
  lineId: "",
  date: today(),
};

interface MaterialsTabProps {
  projectId: string;
  estimateLines: EstimateLine[];
  onDone: () => void;
}

function MaterialsTab({ projectId, estimateLines, onDone }: MaterialsTabProps) {
  const [form, setForm] = useState<MaterialsState>(materialsDefault);
  const [isPending, startTransition] = useTransition();

  const set = useCallback(
    <K extends keyof MaterialsState>(key: K, value: MaterialsState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const qty = parseFloat(form.quantity) || 0;
  const unitRate = parseFloat(form.unitRate) || 0;
  const delivery = parseFloat(form.deliveryCharge) || 0;
  const total = qty * unitRate + delivery;

  const resolvedSection = form.tradeSection.startsWith("__other_manual_")
    ? form.tradeSection.replace("__other_manual_", "")
    : form.tradeSection === "__other" ? "" : form.tradeSection;

  function validate(): string | null {
    if (!form.description.trim()) return "Description is required.";
    if (qty <= 0) return "Please enter a valid quantity.";
    if (unitRate <= 0) return "Please enter a valid unit rate.";
    if (!resolvedSection) return "Please select a trade section / WBS item.";
    if (!form.date) return "Please select a date.";
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { toast.error(err); return; }

    const description = `${form.description.trim()} (${qty} ${form.unit} @ ${gbp(unitRate)}/${form.unit})`;

    startTransition(async () => {
      const res = await logCostAction({
        projectId,
        description,
        amount: total,
        cost_type: "materials",
        trade_section: resolvedSection,
        expense_date: form.date,
        supplier: form.supplier.trim() || undefined,
        estimate_line_id: form.lineId || undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Materials cost logged.");
        setForm(materialsDefault);
        onDone();
      }
    });
  }

  return (
    <div className="space-y-4">
      <FieldRow label="Supplier (optional)">
        <Input
          value={form.supplier}
          onChange={(e) => set("supplier", e.target.value)}
          placeholder="e.g. Travis Perkins"
          className={inputCls}
        />
      </FieldRow>

      <FieldRow label="Description *">
        <Input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="e.g. Ready-mix concrete C25"
          className={inputCls}
        />
      </FieldRow>

      <div className="grid grid-cols-3 gap-3">
        <FieldRow label="Quantity">
          <Input
            type="number"
            min="0"
            step="any"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            placeholder="0"
            className={inputCls}
          />
        </FieldRow>
        <FieldRow label="Unit">
          <Select value={form.unit} onValueChange={(v) => set("unit", v as MaterialUnit)}>
            <SelectTrigger className={inputCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              {MATERIAL_UNITS.map((u) => (
                <SelectItem key={u} value={u} className="text-slate-100 focus:bg-slate-700">
                  {u}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="Unit Rate (£)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.unitRate}
            onChange={(e) => set("unitRate", e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </FieldRow>
      </div>

      <FieldRow label="Delivery Charge (£, optional)">
        <Input
          type="number"
          min="0"
          step="0.01"
          value={form.deliveryCharge}
          onChange={(e) => set("deliveryCharge", e.target.value)}
          placeholder="0.00"
          className={inputCls}
        />
      </FieldRow>

      <FieldRow label="Invoice Reference">
        <Input
          value={form.invoiceRef}
          onChange={(e) => set("invoiceRef", e.target.value)}
          placeholder="e.g. INV-00105"
          className={inputCls}
        />
      </FieldRow>

      {total > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-1">
          <p className="text-sm text-slate-300 font-medium">
            {form.description || "Materials"}
          </p>
          <p className="text-slate-400 text-sm">
            {qty} {form.unit} @ {gbp(unitRate)}/{form.unit}
            {delivery > 0 && ` + ${gbp(delivery)} delivery`}
          </p>
          <p className="text-2xl font-bold text-blue-400">{gbp(total)}</p>
        </div>
      )}

      <WBSPicker
        lines={estimateLines}
        mode="line"
        tradeSection={form.tradeSection}
        lineId={form.lineId}
        onChange={(s, l) => { set("tradeSection", s); set("lineId", l); }}
      />
      <DateField value={form.date} onChange={(v) => set("date", v)} />

      <Button onClick={handleSubmit} disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Log Materials Cost"}
      </Button>
    </div>
  );
}

// ── Tab 5: Overhead / Other ───────────────────────────────────────────────────

type OverheadMode = "fixed" | "percentage";

interface OverheadState {
  description: string;
  mode: OverheadMode;
  fixedAmount: string;
  percentage: string;
  tradeSection: string;
  lineId: string;
  date: string;
  notes: string;
}

const overheadDefault: OverheadState = {
  description: "",
  mode: "fixed",
  fixedAmount: "",
  percentage: "",
  tradeSection: "",
  lineId: "",
  date: today(),
  notes: "",
};

interface OverheadTabProps {
  projectId: string;
  totalCostsToDate: number;
  estimateLines: EstimateLine[];
  onDone: () => void;
}

function OverheadTab({ projectId, totalCostsToDate, estimateLines, onDone }: OverheadTabProps) {
  const [form, setForm] = useState<OverheadState>(overheadDefault);
  const [isPending, startTransition] = useTransition();

  const set = useCallback(
    <K extends keyof OverheadState>(key: K, value: OverheadState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const pct = parseFloat(form.percentage) || 0;
  const calculatedFromPct = (pct / 100) * totalCostsToDate;
  const amount = form.mode === "fixed" ? parseFloat(form.fixedAmount) || 0 : calculatedFromPct;

  const resolvedSection = form.tradeSection.startsWith("__other_manual_")
    ? form.tradeSection.replace("__other_manual_", "")
    : form.tradeSection === "__other" ? "" : form.tradeSection;

  function validate(): string | null {
    if (!form.description.trim()) return "Description is required.";
    if (form.mode === "fixed" && (parseFloat(form.fixedAmount) || 0) <= 0)
      return "Please enter a valid amount.";
    if (form.mode === "percentage" && pct <= 0)
      return "Please enter a valid percentage.";
    if (!resolvedSection) return "Please select a trade section / WBS item.";
    if (!form.date) return "Please select a date.";
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) { toast.error(err); return; }

    const description =
      form.mode === "percentage"
        ? `${form.description.trim()} (${pct}% of costs to date)`
        : form.description.trim();

    startTransition(async () => {
      const res = await logCostAction({
        projectId,
        description,
        amount,
        cost_type: "overhead",
        trade_section: resolvedSection,
        expense_date: form.date,
        estimate_line_id: form.lineId || undefined,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Overhead cost logged.");
        setForm(overheadDefault);
        onDone();
      }
    });
  }

  return (
    <div className="space-y-4">
      <FieldRow label="Description *">
        <Input
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="e.g. Site overhead allocation"
          className={inputCls}
        />
      </FieldRow>

      <FieldRow label="Amount Type">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => set("mode", "fixed")}
            className={`flex-1 text-sm py-2 rounded-lg border transition-colors ${
              form.mode === "fixed"
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-slate-600 text-slate-400 hover:border-slate-500 bg-slate-800"
            }`}
          >
            Fixed Amount
          </button>
          <button
            type="button"
            onClick={() => set("mode", "percentage")}
            className={`flex-1 text-sm py-2 rounded-lg border transition-colors ${
              form.mode === "percentage"
                ? "bg-blue-600 border-blue-600 text-white"
                : "border-slate-600 text-slate-400 hover:border-slate-500 bg-slate-800"
            }`}
          >
            % of Costs to Date
          </button>
        </div>
      </FieldRow>

      {form.mode === "fixed" ? (
        <FieldRow label="Amount (£)">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.fixedAmount}
            onChange={(e) => set("fixedAmount", e.target.value)}
            placeholder="0.00"
            className={inputCls}
          />
        </FieldRow>
      ) : (
        <>
          <FieldRow label="Percentage (%)">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.percentage}
              onChange={(e) => set("percentage", e.target.value)}
              placeholder="e.g. 5"
              className={inputCls}
            />
          </FieldRow>
          <div className="text-sm text-slate-400 bg-slate-800/60 rounded-lg px-3 py-2 border border-slate-700">
            Costs to date:{" "}
            <span className="text-slate-200 font-medium">{gbp(totalCostsToDate)}</span>
            {pct > 0 && (
              <span className="ml-2 text-blue-400 font-medium">
                → {gbp(calculatedFromPct)}
              </span>
            )}
          </div>
        </>
      )}

      {amount > 0 && form.description && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-1">
          <p className="text-sm text-slate-300 font-medium">{form.description}</p>
          {form.mode === "percentage" && (
            <p className="text-slate-400 text-sm">
              {pct}% × {gbp(totalCostsToDate)}
            </p>
          )}
          <p className="text-2xl font-bold text-blue-400">{gbp(amount)}</p>
        </div>
      )}

      <WBSPicker
        lines={estimateLines}
        mode="section"
        tradeSection={form.tradeSection}
        lineId={form.lineId}
        onChange={(s, l) => { set("tradeSection", s); set("lineId", l); }}
      />
      <DateField value={form.date} onChange={(v) => set("date", v)} />
      <NotesField value={form.notes} onChange={(v) => set("notes", v)} />

      <Button onClick={handleSubmit} disabled={isPending} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
        {isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Log Overhead / Other Cost"}
      </Button>
    </div>
  );
}

// ── Root component ─────────────────────────────────────────────────────────────

export default function LogCostSheet({
  projectId,
  isOpen,
  onClose,
  onSuccess,
  staffCatalogue,
  plantCatalogue,
  totalCostsToDate,
  estimateLines,
}: LogCostSheetProps) {
  const [activeTab, setActiveTab] = useState("labour");

  function handleDone() {
    onSuccess();
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-slate-100">
            Log Cost
          </DialogTitle>
        </DialogHeader>

        {/* ── Custom tab bar (no shadcn Tabs needed) ── */}
        <div className="mt-2">
          <div className="flex border-b border-slate-700 mb-5 overflow-x-auto">
            {[
              { value: "labour",      label: "Labour" },
              { value: "plant-owned", label: "Plant — Owned" },
              { value: "plant-hired", label: "Plant — Hired" },
              { value: "materials",   label: "Materials" },
              { value: "overhead",    label: "Overhead / Other" },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.value
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "labour" && (
            <LabourTab staffCatalogue={staffCatalogue} projectId={projectId} estimateLines={estimateLines} onDone={handleDone} />
          )}
          {activeTab === "plant-owned" && (
            <PlantOwnedTab plantCatalogue={plantCatalogue} projectId={projectId} estimateLines={estimateLines} onDone={handleDone} />
          )}
          {activeTab === "plant-hired" && (
            <PlantHiredTab projectId={projectId} estimateLines={estimateLines} onDone={handleDone} />
          )}
          {activeTab === "materials" && (
            <MaterialsTab projectId={projectId} estimateLines={estimateLines} onDone={handleDone} />
          )}
          {activeTab === "overhead" && (
            <OverheadTab projectId={projectId} totalCostsToDate={totalCostsToDate} estimateLines={estimateLines} onDone={handleDone} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
