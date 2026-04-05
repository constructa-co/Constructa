"use client";

import { useState, useTransition, useEffect } from "react";
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
  upsertStaffResourceAction,
  deleteStaffResourceAction,
  type StaffResourceInput,
} from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface StaffRow {
  id: string;
  user_id: string;
  name: string;
  role: string | null;
  annual_salary: number;
  employer_ni_pct: number;
  employer_pension_pct: number;
  company_car_annual: number;
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

function gbp(n: number) {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function calcStaffAnnualCost(s: StaffRow | StaffResourceInput): number {
  const niCost = s.annual_salary * (s.employer_ni_pct / 100);
  const pensionCost = s.annual_salary * (s.employer_pension_pct / 100);
  return (
    s.annual_salary +
    niCost +
    pensionCost +
    s.company_car_annual +
    s.it_costs_annual +
    s.life_insurance_annual +
    s.other_benefits_annual
  );
}

export function calcStaffDailyChargeout(s: StaffRow | StaffResourceInput): number {
  const totalAnnualCost = calcStaffAnnualCost(s);
  const workingDays = s.annual_working_days - s.holiday_days - s.public_holiday_days;
  if (workingDays <= 0) return 0;
  const dailyBase = totalAnnualCost / workingDays;
  const withOverhead = dailyBase * (1 + s.overhead_absorption_pct / 100);
  return withOverhead * (1 + s.profit_uplift_pct / 100);
}

// ── Default form values ────────────────────────────────────────────────────────

const DEFAULTS: Omit<StaffResourceInput, "name"> = {
  role: "",
  annual_salary: 0,
  employer_ni_pct: 13.8,
  employer_pension_pct: 3.0,
  company_car_annual: 0,
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

type FormState = Omit<StaffResourceInput, "id"> & { id?: string };

function rowToForm(row: StaffRow): FormState {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? "",
    annual_salary: row.annual_salary,
    employer_ni_pct: row.employer_ni_pct,
    employer_pension_pct: row.employer_pension_pct,
    company_car_annual: row.company_car_annual,
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

function freshForm(): FormState {
  return { name: "", ...DEFAULTS };
}

// ── Rate Preview Panel ─────────────────────────────────────────────────────────

function RatePreview({ form }: { form: FormState }) {
  const salary = form.annual_salary;
  const niCost = salary * (form.employer_ni_pct / 100);
  const pensionCost = salary * (form.employer_pension_pct / 100);
  const benefits =
    form.company_car_annual +
    form.it_costs_annual +
    form.life_insurance_annual +
    form.other_benefits_annual;
  const totalAnnual = salary + niCost + pensionCost + benefits;
  const chargeableDays =
    form.annual_working_days - form.holiday_days - form.public_holiday_days;
  const dailyCost = chargeableDays > 0 ? totalAnnual / chargeableDays : 0;
  const overheadAmount = dailyCost * (form.overhead_absorption_pct / 100);
  const dailyWithOverhead = dailyCost + overheadAmount;
  const profitAmount = dailyWithOverhead * (form.profit_uplift_pct / 100);
  const chargeout = dailyWithOverhead + profitAmount;

  const row = (label: string, value: string, highlight?: boolean) => (
    <div
      className={`flex justify-between gap-4 ${highlight ? "border-t border-slate-700 pt-1 mt-1 font-semibold text-slate-100" : "text-slate-400"}`}
    >
      <span className="text-xs">{label}</span>
      <span className="text-xs font-mono tabular-nums text-right whitespace-nowrap">{value}</span>
    </div>
  );

  return (
    <div className="rounded-md bg-slate-900/50 border border-slate-700 p-4 space-y-1">
      <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Live Rate Preview</p>
      {row("Annual salary:", gbp(salary))}
      {row(`+ Employer NI (${form.employer_ni_pct}%):`, gbp(niCost))}
      {row(`+ Pension (${form.employer_pension_pct}%):`, gbp(pensionCost))}
      {row("+ Benefits:", gbp(benefits))}
      {row("= Total annual cost:", gbp(totalAnnual), true)}
      {row(`÷ Chargeable days (${Math.max(0, chargeableDays)}):`, "")}
      {row("= Daily cost:", gbp(dailyCost), true)}
      {row(`+ Overhead (${form.overhead_absorption_pct}%):`, gbp(overheadAmount))}
      {row(`+ Profit (${form.profit_uplift_pct}%):`, gbp(profitAmount))}
      {row("= Daily chargeout:", gbp(chargeout), true)}
    </div>
  );
}

// ── Form Field Helpers ─────────────────────────────────────────────────────────

function FieldGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-slate-300 text-sm">{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
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
}: {
  value: number;
  onChange: (v: number) => void;
  step?: string;
  min?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-slate-400 text-sm pointer-events-none">{prefix}</span>
      )}
      <Input
        type="number"
        step={step}
        min={min}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 ${prefix ? "pl-7" : ""} ${suffix ? "pr-8" : ""}`}
      />
      {suffix && (
        <span className="absolute right-3 text-slate-400 text-sm pointer-events-none">{suffix}</span>
      )}
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
  const [form, setForm] = useState<FormState>(initial ?? freshForm());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm(initial ?? freshForm());
  }, [initial, open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const chargeableDays = Math.max(0, form.annual_working_days - form.holiday_days - form.public_holiday_days);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    startTransition(async () => {
      const result = await upsertStaffResourceAction({
        ...form,
        role: form.role || null,
        notes: form.notes || null,
      });
      if (result.error) {
        toast.error("Failed to save: " + result.error);
      } else {
        toast.success(form.id ? "Staff member updated" : "Staff member added");
        onSaved();
        onOpenChange(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {form.id ? "Edit Staff Member" : "Add Staff Member"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Basic Info */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-1">
              Basic Info
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Name *">
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Sarah Johnson"
                  required
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                />
              </FieldGroup>
              <FieldGroup label="Role / Job Title">
                <Input
                  value={form.role ?? ""}
                  onChange={(e) => set("role", e.target.value)}
                  placeholder="e.g. Site Manager"
                  className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-blue-500"
                />
              </FieldGroup>
            </div>
          </section>

          {/* Salary */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-1">
              Salary
            </h3>
            <FieldGroup label="Annual Salary *">
              <NumericInput
                value={form.annual_salary}
                onChange={(v) => set("annual_salary", v)}
                step="1"
                prefix="£"
              />
            </FieldGroup>
          </section>

          {/* Employer On-Costs */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-1">
              Employer On-Costs
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup
                label="Employer NI %"
                hint="UK statutory rate: 13.8%"
              >
                <NumericInput
                  value={form.employer_ni_pct}
                  onChange={(v) => set("employer_ni_pct", v)}
                  suffix="%"
                />
              </FieldGroup>
              <FieldGroup
                label="Employer Pension %"
                hint="UK statutory minimum: 3%"
              >
                <NumericInput
                  value={form.employer_pension_pct}
                  onChange={(v) => set("employer_pension_pct", v)}
                  suffix="%"
                />
              </FieldGroup>
            </div>
          </section>

          {/* Annual Benefits */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-1">
              Annual Benefits (£)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Company Car">
                <NumericInput
                  value={form.company_car_annual}
                  onChange={(v) => set("company_car_annual", v)}
                  step="1"
                  prefix="£"
                />
              </FieldGroup>
              <FieldGroup label="IT Costs">
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
          </section>

          {/* Working Time */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-1">
              Working Time
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <FieldGroup label="Annual Working Days">
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
            <p className="text-xs text-slate-400">
              Chargeable days:{" "}
              <span className="font-semibold text-slate-200">{chargeableDays}</span>
            </p>
          </section>

          {/* Overhead & Profit */}
          <section className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-1">
              Overhead &amp; Profit
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <FieldGroup label="Overhead Absorption %">
                <NumericInput
                  value={form.overhead_absorption_pct}
                  onChange={(v) => set("overhead_absorption_pct", v)}
                  suffix="%"
                />
              </FieldGroup>
              <FieldGroup label="Profit Uplift %">
                <NumericInput
                  value={form.profit_uplift_pct}
                  onChange={(v) => set("profit_uplift_pct", v)}
                  suffix="%"
                />
              </FieldGroup>
            </div>
          </section>

          {/* Live Rate Preview */}
          <RatePreview form={form} />

          {/* Notes */}
          <section className="space-y-2">
            <Label className="text-slate-300 text-sm">Notes (optional)</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Any additional notes about this team member…"
              rows={3}
              className="bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 resize-none"
            />
          </section>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isPending ? "Saving…" : form.id ? "Save Changes" : "Add Staff Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Client Component ──────────────────────────────────────────────────────

export default function StaffResourcesClient({ staff }: { staff: StaffRow[] }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<StaffRow | null>(null);
  const [deletingId, startDeleteTransition] = useTransition();

  function openAdd() {
    setEditingRow(null);
    setDialogOpen(true);
  }

  function openEdit(row: StaffRow) {
    setEditingRow(row);
    setDialogOpen(true);
  }

  function handleDelete(row: StaffRow) {
    if (!confirm(`Remove "${row.name}" from your staff catalogue?`)) return;
    startDeleteTransition(async () => {
      await deleteStaffResourceAction(row.id);
      toast.success(`${row.name} removed`);
    });
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button
          onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          + Add Staff Member
        </Button>
      </div>

      {/* Empty State */}
      {staff.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 py-20 text-center">
          <p className="text-slate-400 text-lg font-medium mb-1">No staff profiles yet</p>
          <p className="text-slate-500 text-sm mb-6">
            Add your first team member to build your labour cost catalogue
          </p>
          <Button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white">
            + Add Staff Member
          </Button>
        </div>
      )}

      {/* Staff Table */}
      {staff.length > 0 && (
        <div className="rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-700">
                <th className="text-left text-slate-400 font-medium px-4 py-3">Name</th>
                <th className="text-left text-slate-400 font-medium px-4 py-3">Role</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Annual Salary</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Total Annual Cost</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Chargeable Days</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Daily Cost</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Chargeout / Day</th>
                <th className="text-right text-slate-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {staff.map((row) => {
                const annualCost = calcStaffAnnualCost(row);
                const chargeableDays = Math.max(
                  0,
                  row.annual_working_days - row.holiday_days - row.public_holiday_days
                );
                const dailyCost = chargeableDays > 0 ? annualCost / chargeableDays : 0;
                const chargeout = calcStaffDailyChargeout(row);

                return (
                  <tr
                    key={row.id}
                    className="bg-slate-800/20 hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-100 font-medium">
                      <div className="flex items-center gap-2">
                        {row.name}
                        {!row.is_active && (
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-500">
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {row.role || <span className="text-slate-600 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 font-mono tabular-nums">
                      {gbp(row.annual_salary)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 font-mono tabular-nums">
                      {gbp(annualCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400">
                      {chargeableDays}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-200 font-mono tabular-nums">
                      {gbp(dailyCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-400 font-mono tabular-nums">
                      {gbp(chargeout)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(row)}
                          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100 h-8 px-3 text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(row)}
                          disabled={deletingId}
                          className="border-red-900 text-red-400 hover:bg-red-950 hover:text-red-300 h-8 px-3 text-xs"
                        >
                          Delete
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
        onSaved={() => {}}
      />
    </div>
  );
}
