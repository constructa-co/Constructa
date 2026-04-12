"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  upsertStaffResourceAction,
  deleteStaffResourceAction,
  type StaffResourceInput,
} from "./actions";
import { Pencil, Trash2, Users } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StaffRow {
  id: string;
  user_id: string;
  title: string; // 'Mr' | 'Mrs' | 'Ms' | 'Dr' | 'Mx' | 'Prof'
  first_name: string | null;
  last_name: string | null;
  name: string; // legacy - still in DB
  job_title: string | null;
  role: string | null; // legacy
  rate_mode: string; // 'simple' | 'full'
  // Simple mode fields
  hourly_chargeout_rate: number;
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
  notes: string | null;
  is_active: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function gbp(n: number): string {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function displayName(s: StaffRow): string {
  if (s.first_name || s.last_name) {
    return [s.title, s.first_name, s.last_name].filter(Boolean).join(" ");
  }
  return s.name || "Unnamed";
}

export function calcStaffDailyChargeout(s: StaffRow): number {
  if (s.rate_mode === "simple") return s.hourly_chargeout_rate * 8;
  const niCost = s.annual_salary * (s.employer_ni_pct / 100);
  const pensionCost = s.annual_salary * (s.employer_pension_pct / 100);
  const totalAnnualCost =
    s.annual_salary +
    niCost +
    pensionCost +
    s.company_car_annual +
    s.car_allowance_annual +
    s.mobile_phone_annual +
    s.it_costs_annual +
    s.life_insurance_annual +
    s.other_benefits_annual;
  const workingDays = s.annual_working_days - s.holiday_days - s.public_holiday_days;
  if (workingDays <= 0) return 0;
  const dailyBase = totalAnnualCost / workingDays;
  const withOverhead = dailyBase * (1 + s.overhead_absorption_pct / 100);
  return withOverhead * (1 + s.profit_uplift_pct / 100);
}

function calcFullAnnualCost(f: FormState): number {
  const niCost = f.annual_salary * (f.employer_ni_pct / 100);
  const pensionCost = f.annual_salary * (f.employer_pension_pct / 100);
  return (
    f.annual_salary +
    niCost +
    pensionCost +
    f.company_car_annual +
    f.car_allowance_annual +
    f.mobile_phone_annual +
    f.it_costs_annual +
    f.life_insurance_annual +
    f.other_benefits_annual
  );
}

// ── Form state ─────────────────────────────────────────────────────────────────

interface FormState {
  id?: string;
  title: string;
  first_name: string;
  last_name: string;
  name: string;
  job_title: string;
  rate_mode: "simple" | "full";
  // simple
  hourly_chargeout_rate: number;
  overtime_chargeout_rate: number;
  // full
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
  notes: string;
  is_active: boolean;
}

const DEFAULTS: FormState = {
  title: "Mr",
  first_name: "",
  last_name: "",
  name: "",
  job_title: "",
  rate_mode: "simple",
  hourly_chargeout_rate: 0,
  overtime_chargeout_rate: 0,
  annual_salary: 0,
  employer_ni_pct: 13.8,
  employer_pension_pct: 3,
  company_car_annual: 0,
  car_allowance_annual: 0,
  mobile_phone_annual: 0,
  it_costs_annual: 0,
  life_insurance_annual: 0,
  other_benefits_annual: 0,
  annual_working_days: 260,
  holiday_days: 25,
  public_holiday_days: 8,
  overhead_absorption_pct: 15,
  profit_uplift_pct: 20,
  notes: "",
  is_active: true,
};

function rowToForm(row: StaffRow): FormState {
  return {
    id: row.id,
    title: row.title || "Mr",
    first_name: row.first_name ?? "",
    last_name: row.last_name ?? "",
    name: row.name,
    job_title: row.job_title ?? "",
    rate_mode: row.rate_mode === "full" ? "full" : "simple",
    hourly_chargeout_rate: row.hourly_chargeout_rate,
    overtime_chargeout_rate: row.overtime_chargeout_rate,
    annual_salary: row.annual_salary,
    employer_ni_pct: row.employer_ni_pct,
    employer_pension_pct: row.employer_pension_pct,
    company_car_annual: row.company_car_annual,
    car_allowance_annual: row.car_allowance_annual,
    mobile_phone_annual: row.mobile_phone_annual,
    it_costs_annual: row.it_costs_annual,
    life_insurance_annual: row.life_insurance_annual,
    other_benefits_annual: row.other_benefits_annual,
    annual_working_days: row.annual_working_days,
    holiday_days: row.holiday_days,
    public_holiday_days: row.public_holiday_days,
    overhead_absorption_pct: row.overhead_absorption_pct,
    profit_uplift_pct: row.profit_uplift_pct,
    notes: row.notes ?? "",
    is_active: row.is_active,
  };
}

function formToInput(f: FormState): StaffResourceInput {
  const firstName = f.first_name.trim();
  const lastName = f.last_name.trim();
  const derivedName =
    [f.title, firstName, lastName].filter(Boolean).join(" ") || f.name || "Unnamed";

  return {
    id: f.id,
    name: derivedName,
    title: f.title,
    first_name: firstName || null,
    last_name: lastName || null,
    job_title: f.job_title.trim() || null,
    rate_mode: f.rate_mode,
    hourly_chargeout_rate: f.hourly_chargeout_rate,
    overtime_chargeout_rate: f.overtime_chargeout_rate,
    annual_salary: f.annual_salary,
    employer_ni_pct: f.employer_ni_pct,
    employer_pension_pct: f.employer_pension_pct,
    company_car_annual: f.company_car_annual,
    car_allowance_annual: f.car_allowance_annual,
    mobile_phone_annual: f.mobile_phone_annual,
    it_costs_annual: f.it_costs_annual,
    life_insurance_annual: f.life_insurance_annual,
    other_benefits_annual: f.other_benefits_annual,
    annual_working_days: f.annual_working_days,
    holiday_days: f.holiday_days,
    public_holiday_days: f.public_holiday_days,
    overhead_absorption_pct: f.overhead_absorption_pct,
    profit_uplift_pct: f.profit_uplift_pct,
    notes: f.notes.trim() || null,
    is_active: f.is_active,
    role: null,
  } as unknown as StaffResourceInput;
}

// ── UK Construction Job Title Suggestions ──────────────────────────────────────

const JOB_TITLE_SUGGESTIONS = [
  "Contracts Manager","Project Manager","Site Manager","Site Supervisor","Assistant Site Manager",
  "Quantity Surveyor","Assistant QS","Commercial Manager","Estimator","Bid Manager",
  "Groundworker","Senior Groundworker","Groundworks Foreman","Cat B Groundworker",
  "Bricklayer","Senior Bricklayer","Bricklaying Foreman",
  "Carpenter","Joiner","Carpenter & Joiner","Shopfitter",
  "Plasterer","Dry Liner","Ceiling Fixer",
  "Electrician","Electrical Foreman","Electrical Engineer",
  "Plumber","Pipefitter","Heating Engineer","Gas Engineer",
  "Roofer","Flat Roofer","Roofing Foreman",
  "Tiler (Floor)","Tiler (Wall)","Tiler (Floor & Wall)",
  "Painter & Decorator","Spray Painter",
  "Steelfixer","Reinforced Concrete (RC) Labourer",
  "Concrete Finisher","Concrete Pump Operator",
  "Plant Operator","360 Operator","Dumper Driver","Telehandler Operator","Crane Operator","Forklift Driver",
  "Scaffolder","Advanced Scaffolder","Scaffolding Foreman",
  "Banksman / Slinger","Rigger",
  "CSCS Labourer","General Operative",
  "Health & Safety Manager","Temporary Works Coordinator",
  "Director","Managing Director","Operations Director","Commercial Director",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold pb-1 border-b border-border/50 mb-3">
      {children}
    </h3>
  );
}

function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-foreground/80 text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

function NumericInput({
  value,
  onChange,
  step = "0.01",
  min = "0",
  prefix,
  suffix,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
  min?: string;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-muted-foreground text-sm pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <Input
        type="number"
        step={step}
        min={min}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onFocus={(e) => e.target.select()}
        className={[
          "bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500",
          prefix ? "pl-7" : "",
          suffix ? "pr-8" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      {suffix && (
        <span className="absolute right-3 text-muted-foreground text-sm pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ── Rate Preview Panel ─────────────────────────────────────────────────────────

function RatePreviewPanel({ form }: { form: FormState }) {
  const salary = form.annual_salary;
  const niCost = salary * (form.employer_ni_pct / 100);
  const pensionCost = salary * (form.employer_pension_pct / 100);
  const companyCarCost = form.company_car_annual;
  const carAllowance = form.car_allowance_annual;
  const mobileCost = form.mobile_phone_annual;
  const itCost = form.it_costs_annual;
  const lifeCost = form.life_insurance_annual;
  const otherCost = form.other_benefits_annual;
  const totalAnnual =
    salary +
    niCost +
    pensionCost +
    companyCarCost +
    carAllowance +
    mobileCost +
    itCost +
    lifeCost +
    otherCost;
  const chargeableDays = Math.max(
    0,
    form.annual_working_days - form.holiday_days - form.public_holiday_days
  );
  const dailyBase = chargeableDays > 0 ? totalAnnual / chargeableDays : 0;
  const overheadAmount = dailyBase * (form.overhead_absorption_pct / 100);
  const dailyWithOverhead = dailyBase + overheadAmount;
  const profitAmount = dailyWithOverhead * (form.profit_uplift_pct / 100);
  const chargeout = dailyWithOverhead + profitAmount;

  const PAD = 28; // label column width in chars
  const AMOUNT_PAD = 12; // amount column width

  function previewLine(
    label: string,
    amount: number | null,
    separator?: boolean
  ): React.ReactNode {
    const amountStr = amount !== null ? gbp(amount) : "";
    const isZero = amount === 0;
    return (
      <div
        key={label}
        className={[
          "flex justify-between gap-2",
          separator ? "border-t border-border pt-1 mt-1" : "",
          separator ? "text-foreground font-semibold" : isZero ? "text-muted-foreground/60" : "text-muted-foreground",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="font-mono text-xs truncate shrink">{label}</span>
        <span className="font-mono text-xs text-right whitespace-nowrap shrink-0 tabular-nums">
          {isZero && !separator ? "—" : amountStr}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-card/60 border border-border rounded-xl p-4 font-mono text-sm space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 font-sans">
        Live Rate Preview
      </p>
      {previewLine("Annual salary:", salary)}
      {previewLine(`+ Employer NI (${form.employer_ni_pct}%):`, niCost)}
      {previewLine(`+ Employer pension (${form.employer_pension_pct}%):`, pensionCost)}
      {previewLine("+ Company car:", companyCarCost)}
      {previewLine("+ Car allowance:", carAllowance)}
      {previewLine("+ Mobile phone:", mobileCost)}
      {previewLine("+ IT costs:", itCost)}
      {previewLine("+ Life insurance:", lifeCost)}
      {previewLine("+ Other benefits:", otherCost)}
      {previewLine("= Total annual cost:", totalAnnual, true)}
      <div className="text-muted-foreground font-mono text-xs py-0.5">
        {`÷ Chargeable days (${chargeableDays}):`}
      </div>
      {previewLine("= Daily base cost:", dailyBase, true)}
      {previewLine(`+ Overhead (${form.overhead_absorption_pct}%):`, overheadAmount)}
      {previewLine(`+ Profit (${form.profit_uplift_pct}%):`, profitAmount)}
      {previewLine("= Daily chargeout rate:", chargeout, true)}
    </div>
  );
}

// ── Staff Form Dialog ──────────────────────────────────────────────────────────

function StaffFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: FormState | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ?? { ...DEFAULTS });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(initial ?? { ...DEFAULTS });
  }, [initial, open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const chargeableDays = Math.max(
    0,
    form.annual_working_days - form.holiday_days - form.public_holiday_days
  );

  const simpleDayRate = form.hourly_chargeout_rate * 8;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasName = form.first_name.trim() || form.last_name.trim() || form.name.trim();
    if (!hasName) {
      toast.error("Please enter at least a first or last name");
      return;
    }
    startTransition(async () => {
      const result = await upsertStaffResourceAction(formToInput(form));
      if (result?.error) {
        toast.error("Failed to save: " + result.error);
      } else {
        toast.success(form.id ? "Staff member updated" : "Staff member added");
        onSaved();
        onOpenChange(false);
      }
    });
  }

  const isEdit = Boolean(form.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg">
            {isEdit ? "Edit Staff Member" : "Add Staff Member"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-1">
          {/* ── Section 1: Personal Details ─────────────────────────────────── */}
          <section>
            <SectionHeading>Personal Details</SectionHeading>
            <div className="space-y-4">
              {/* Title + First + Last */}
              <div className="grid grid-cols-[auto_1fr_1fr] gap-3 items-end">
                <FieldGroup label="Title">
                  <Select value={form.title} onValueChange={(v) => set("title", v)}>
                    <SelectTrigger className="bg-input border-border text-foreground w-24 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-input border-border text-foreground">
                      {["Mr", "Mrs", "Ms", "Dr", "Mx", "Prof"].map((t) => (
                        <SelectItem
                          key={t}
                          value={t}
                          className="focus:bg-muted focus:text-foreground"
                        >
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldGroup>

                <FieldGroup label="First Name">
                  <Input
                    value={form.first_name}
                    onChange={(e) => set("first_name", e.target.value)}
                    placeholder="e.g. Sarah"
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500"
                  />
                </FieldGroup>

                <FieldGroup label="Last Name">
                  <Input
                    value={form.last_name}
                    onChange={(e) => set("last_name", e.target.value)}
                    placeholder="e.g. Johnson"
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500"
                  />
                </FieldGroup>
              </div>

              {/* Job Title with autocomplete suggestions */}
              <FieldGroup label="Job Title">
                <Input
                  list="job-title-suggestions"
                  value={form.job_title}
                  onChange={(e) => set("job_title", e.target.value)}
                  placeholder="e.g. Site Manager, Electrician, Director"
                  className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500"
                />
                <datalist id="job-title-suggestions">
                  {JOB_TITLE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}
                </datalist>
              </FieldGroup>
            </div>
          </section>

          {/* ── Section 2: Rate Mode Toggle ──────────────────────────────────── */}
          <section>
            <SectionHeading>Rate Mode</SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => set("rate_mode", "simple")}
                className={[
                  "rounded-lg border-2 p-4 text-left transition-colors",
                  form.rate_mode === "simple"
                    ? "border-blue-500 bg-blue-950/40"
                    : "border-border bg-input/40 hover:border-border",
                ].join(" ")}
              >
                <p
                  className={[
                    "font-semibold text-sm",
                    form.rate_mode === "simple" ? "text-blue-300" : "text-foreground/80",
                  ].join(" ")}
                >
                  Simple Rate
                </p>
                <p className="text-xs text-muted-foreground mt-1">Enter chargeout rate directly</p>
              </button>

              <button
                type="button"
                onClick={() => set("rate_mode", "full")}
                className={[
                  "rounded-lg border-2 p-4 text-left transition-colors",
                  form.rate_mode === "full"
                    ? "border-blue-500 bg-blue-950/40"
                    : "border-border bg-input/40 hover:border-border",
                ].join(" ")}
              >
                <p
                  className={[
                    "font-semibold text-sm",
                    form.rate_mode === "full" ? "text-blue-300" : "text-foreground/80",
                  ].join(" ")}
                >
                  Full Cost Buildup
                </p>
                <p className="text-xs text-muted-foreground mt-1">Build from salary + on-costs</p>
              </button>
            </div>
          </section>

          {/* ── Section 3A: Simple Mode ──────────────────────────────────────── */}
          {form.rate_mode === "simple" && (
            <section>
              <SectionHeading>Rates</SectionHeading>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Hourly Chargeout Rate (£/hr)">
                    <NumericInput
                      value={form.hourly_chargeout_rate}
                      onChange={(v) => set("hourly_chargeout_rate", v)}
                      step="0.01"
                      prefix="£"
                    />
                  </FieldGroup>
                  <FieldGroup label="Overtime Rate (£/hr)">
                    <NumericInput
                      value={form.overtime_chargeout_rate}
                      onChange={(v) => set("overtime_chargeout_rate", v)}
                      step="0.01"
                      prefix="£"
                    />
                  </FieldGroup>
                </div>

                <div className="bg-input/60 border border-border rounded-lg p-3 text-sm">
                  <span className="text-muted-foreground">Day rate: </span>
                  <span className="text-foreground font-semibold font-mono">
                    {gbp(simpleDayRate)}
                  </span>
                  <span className="text-muted-foreground ml-1">(8 hrs)</span>
                </div>
              </div>
            </section>
          )}

          {/* ── Section 3B: Full Buildup ─────────────────────────────────────── */}
          {form.rate_mode === "full" && (
            <section className="space-y-6">
              {/* Annual Salary */}
              <div>
                <SectionHeading>Annual Salary</SectionHeading>
                <FieldGroup label="Annual Salary (£) *">
                  <NumericInput
                    value={form.annual_salary}
                    onChange={(v) => set("annual_salary", v)}
                    step="1"
                    prefix="£"
                  />
                </FieldGroup>
              </div>

              {/* Employer On-Costs */}
              <div>
                <SectionHeading>Employer On-Costs</SectionHeading>
                <p className="text-xs text-muted-foreground mb-3">
                  UK statutory minimums shown as defaults
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup
                    label="Employer NI %"
                    hint="Currently 13.8% in UK above secondary threshold"
                  >
                    <NumericInput
                      value={form.employer_ni_pct}
                      onChange={(v) => set("employer_ni_pct", v)}
                      step="0.1"
                      suffix="%"
                    />
                  </FieldGroup>
                  <FieldGroup
                    label="Employer Pension %"
                    hint="Auto-enrolment minimum is 3%"
                  >
                    <NumericInput
                      value={form.employer_pension_pct}
                      onChange={(v) => set("employer_pension_pct", v)}
                      step="0.1"
                      suffix="%"
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Annual Benefits & Allowances */}
              <div>
                <SectionHeading>Annual Benefits &amp; Allowances</SectionHeading>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup label="Company Car">
                    <NumericInput
                      value={form.company_car_annual}
                      onChange={(v) => set("company_car_annual", v)}
                      step="1"
                      prefix="£"
                      placeholder="Annual lease/fuel/insurance"
                    />
                  </FieldGroup>
                  <FieldGroup label="Car Allowance">
                    <NumericInput
                      value={form.car_allowance_annual}
                      onChange={(v) => set("car_allowance_annual", v)}
                      step="1"
                      prefix="£"
                    />
                  </FieldGroup>
                  <FieldGroup label="Mobile Phone">
                    <NumericInput
                      value={form.mobile_phone_annual}
                      onChange={(v) => set("mobile_phone_annual", v)}
                      step="1"
                      prefix="£"
                    />
                  </FieldGroup>
                  <FieldGroup label="IT Costs" hint="Laptop, software, etc.">
                    <NumericInput
                      value={form.it_costs_annual}
                      onChange={(v) => set("it_costs_annual", v)}
                      step="1"
                      prefix="£"
                    />
                  </FieldGroup>
                  <FieldGroup label="Life Insurance">
                    <NumericInput
                      value={form.life_insurance_annual}
                      onChange={(v) => set("life_insurance_annual", v)}
                      step="1"
                      prefix="£"
                    />
                  </FieldGroup>
                  <FieldGroup label="Other Benefits">
                    <NumericInput
                      value={form.other_benefits_annual}
                      onChange={(v) => set("other_benefits_annual", v)}
                      step="1"
                      prefix="£"
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Working Time */}
              <div>
                <SectionHeading>Working Time</SectionHeading>
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <FieldGroup
                    label="Annual Working Days"
                    hint="52 weeks × 5 days"
                  >
                    <NumericInput
                      value={form.annual_working_days}
                      onChange={(v) => set("annual_working_days", Math.round(v))}
                      step="1"
                      min="1"
                    />
                  </FieldGroup>
                  <FieldGroup label="Holiday Days">
                    <NumericInput
                      value={form.holiday_days}
                      onChange={(v) => set("holiday_days", Math.round(v))}
                      step="1"
                      min="0"
                    />
                  </FieldGroup>
                  <FieldGroup label="Public Holidays">
                    <NumericInput
                      value={form.public_holiday_days}
                      onChange={(v) => set("public_holiday_days", Math.round(v))}
                      step="1"
                      min="0"
                    />
                  </FieldGroup>
                </div>
                <div className="bg-input/60 border border-border rounded-lg p-3 text-sm">
                  <span className="text-muted-foreground">Chargeable days: </span>
                  <span className="text-foreground font-semibold">{chargeableDays}</span>
                  <span className="text-muted-foreground"> per year</span>
                </div>
              </div>

              {/* Overhead & Profit */}
              <div>
                <SectionHeading>Overhead &amp; Profit</SectionHeading>
                <div className="grid grid-cols-2 gap-4">
                  <FieldGroup
                    label="Overhead Absorption %"
                    hint="% added to cover office, vehicles, admin"
                  >
                    <NumericInput
                      value={form.overhead_absorption_pct}
                      onChange={(v) => set("overhead_absorption_pct", v)}
                      step="0.5"
                      suffix="%"
                    />
                  </FieldGroup>
                  <FieldGroup label="Profit Uplift %">
                    <NumericInput
                      value={form.profit_uplift_pct}
                      onChange={(v) => set("profit_uplift_pct", v)}
                      step="0.5"
                      suffix="%"
                    />
                  </FieldGroup>
                </div>
              </div>

              {/* Live Rate Preview */}
              <RatePreviewPanel form={form} />
            </section>
          )}

          {/* ── Notes ────────────────────────────────────────────────────────── */}
          <section>
            <SectionHeading>Notes</SectionHeading>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any additional notes about this team member…"
              rows={3}
              className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 resize-none"
            />
          </section>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="border-border text-foreground/80 hover:bg-input hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Staff Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────────

export default function StaffResourcesClient({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<StaffRow | null>(null);
  const [, startDeleteTransition] = useTransition();

  function openAdd() {
    setEditingRow(null);
    setDialogOpen(true);
  }

  function openEdit(row: StaffRow) {
    setEditingRow(row);
    setDialogOpen(true);
  }

  function handleDelete(row: StaffRow) {
    const name = displayName(row);
    if (!confirm(`Remove "${name}" from your staff catalogue? This cannot be undone.`)) return;
    startDeleteTransition(async () => {
      await deleteStaffResourceAction(row.id);
      toast.success(`${name} removed`);
      router.refresh();
    });
  }

  function handleSaved() {
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Staff &amp; Contractors</h2>
          <p className="text-sm text-muted-foreground">Build accurate labour cost profiles for your team</p>
        </div>
        <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
          + Add Staff Member
        </Button>
      </div>

      {/* Empty State */}
      {staff.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-24 text-center">
          <Users className="w-10 h-10 text-muted-foreground/60 mb-4" />
          <p className="text-foreground/80 text-base font-semibold mb-1">Add your first team member</p>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs">
            Create cost profiles for employees and contractors to use in project estimates
          </p>
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
            + Add Staff Member
          </Button>
        </div>
      )}

      {/* Staff Table */}
      {staff.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-input/60 border-b border-border">
                <th className="text-left text-muted-foreground font-medium px-4 py-3">
                  Name &amp; Job Title
                </th>
                <th className="text-left text-muted-foreground font-medium px-4 py-3">Mode</th>
                <th className="text-right text-muted-foreground font-medium px-4 py-3">Hourly</th>
                <th className="text-right text-muted-foreground font-medium px-4 py-3">Daily</th>
                <th className="text-right text-muted-foreground font-medium px-4 py-3">Annual</th>
                <th className="text-right text-muted-foreground font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {staff.map((row) => {
                const isSimple = row.rate_mode === "simple";
                const dailyChargeout = calcStaffDailyChargeout(row);
                const hourlyChargeout = isSimple
                  ? row.hourly_chargeout_rate
                  : dailyChargeout / 8;
                const chargeableDays = Math.max(
                  0,
                  row.annual_working_days - row.holiday_days - row.public_holiday_days
                );
                // Annual = chargeout × chargeable days for both modes
                const annualChargeout = dailyChargeout * chargeableDays;
                // Full mode only: actual total employer cost
                const annualEmployerCost = isSimple
                  ? null
                  : (() => {
                      const ni = row.annual_salary * (row.employer_ni_pct / 100);
                      const pension = row.annual_salary * (row.employer_pension_pct / 100);
                      return (
                        row.annual_salary + ni + pension +
                        row.company_car_annual + row.car_allowance_annual +
                        row.mobile_phone_annual + row.it_costs_annual +
                        row.life_insurance_annual + row.other_benefits_annual
                      );
                    })();

                return (
                  <tr
                    key={row.id}
                    className="bg-input/20 hover:bg-input/50 transition-colors"
                  >
                    {/* Name & Job Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="text-foreground font-medium leading-tight">
                            {displayName(row)}
                          </p>
                          {row.job_title && (
                            <p className="text-muted-foreground text-xs mt-0.5 leading-tight">
                              {row.job_title}
                            </p>
                          )}
                        </div>
                        {!row.is_active && (
                          <Badge
                            variant="outline"
                            className="text-xs border-border text-muted-foreground ml-1 shrink-0"
                          >
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Rate Mode Badge */}
                    <td className="px-4 py-3">
                      {isSimple ? (
                        <Badge
                          variant="outline"
                          className="border-border text-muted-foreground text-xs"
                        >
                          Simple
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-900/50 text-blue-300 border-blue-700/50 text-xs">
                          Full Buildup
                        </Badge>
                      )}
                    </td>

                    {/* Hourly */}
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-sm">
                      <span className="text-foreground">{gbp(hourlyChargeout)}</span>
                      <span className="text-muted-foreground/60 text-xs">/hr</span>
                    </td>

                    {/* Daily */}
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-sm">
                      <span className="text-blue-300 font-semibold">{gbp(dailyChargeout)}</span>
                      <span className="text-muted-foreground/60 text-xs">/day</span>
                    </td>

                    {/* Annual */}
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums font-mono text-sm">
                        <span className="text-foreground">{gbp(annualChargeout)}</span>
                        <span className="text-muted-foreground/60 text-xs">/yr</span>
                      </div>
                      {annualEmployerCost !== null && (
                        <p className="text-muted-foreground/60 text-xs font-sans mt-0.5">
                          cost: {gbp(annualEmployerCost)}
                        </p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(row)}
                          className="h-8 w-8 text-muted-foreground hover:text-red-400 hover:bg-red-950/30"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Dialog */}
      <StaffFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editingRow ? rowToForm(editingRow) : null}
        onSaved={handleSaved}
      />
    </div>
  );
}
