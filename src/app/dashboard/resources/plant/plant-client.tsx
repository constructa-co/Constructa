"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, PackageOpen } from "lucide-react";
import {
  upsertPlantResourceAction,
  deletePlantResourceAction,
  type PlantResourceInput,
} from "./actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlantRow {
  id: string;
  user_id: string;
  name: string;
  category: "excavator" | "dumper" | "vehicle" | "scaffold" | "lifting" | "tool" | "other";
  description: string | null;
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
  notes: string | null;
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORIES: { value: PlantRow["category"]; label: string }[] = [
  { value: "excavator", label: "🔧 Excavator" },
  { value: "dumper",    label: "🚛 Dumper" },
  { value: "vehicle",   label: "🚗 Vehicle" },
  { value: "scaffold",  label: "🏗️ Scaffold" },
  { value: "lifting",   label: "🏋️ Lifting Equipment" },
  { value: "tool",      label: "🔨 Power Tool" },
  { value: "other",     label: "📦 Other" },
];

function categoryLabel(val: PlantRow["category"]): string {
  return CATEGORIES.find((c) => c.value === val)?.label ?? val;
}

// ---------------------------------------------------------------------------
// Calculation helpers
// ---------------------------------------------------------------------------

export function calcPlantAnnualCost(p: PlantRow | PlantResourceInput): number {
  const depreciation =
    p.depreciation_years > 0
      ? (p.purchase_price - p.residual_value) / p.depreciation_years
      : 0;
  return (
    depreciation +
    p.finance_cost_annual +
    p.maintenance_annual +
    p.insurance_annual +
    p.other_annual_costs
  );
}

export function calcPlantDailyChargeout(p: PlantRow | PlantResourceInput): number {
  const annualCost = calcPlantAnnualCost(p);
  const chargeableDays = p.utilisation_months * p.working_days_per_month;
  if (chargeableDays <= 0) return 0;
  const dailyCost = annualCost / chargeableDays;
  return dailyCost * (1 + p.profit_uplift_pct / 100);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function gbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function gbp0(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Default blank form
// ---------------------------------------------------------------------------

const BLANK: PlantResourceInput = {
  name: "",
  category: "other",
  description: "",
  purchase_price: 0,
  depreciation_years: 5,
  residual_value: 0,
  finance_cost_annual: 0,
  maintenance_annual: 0,
  insurance_annual: 0,
  other_annual_costs: 0,
  utilisation_months: 10,
  working_days_per_month: 20,
  profit_uplift_pct: 20,
  notes: "",
  is_active: true,
};

// ---------------------------------------------------------------------------
// Mini UI primitives (dark slate theme)
// ---------------------------------------------------------------------------

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-slate-400 mb-1">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 " +
        "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 " +
        "disabled:opacity-50 " +
        (props.className ?? "")
      }
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={2}
      {...props}
      className={
        "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 " +
        "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none " +
        (props.className ?? "")
      }
    />
  );
}

function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={
        "w-full h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 " +
        "focus:outline-none focus:ring-2 focus:ring-blue-600 " +
        (props.className ?? "")
      }
    >
      {children}
    </select>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3 mt-5 first:mt-0">
      {children}
    </h4>
  );
}

// ---------------------------------------------------------------------------
// Live Rate Preview
// ---------------------------------------------------------------------------

function RatePreview({ form }: { form: PlantResourceInput }) {
  const depreciationYrs = form.depreciation_years;
  const depreciation =
    depreciationYrs > 0
      ? (form.purchase_price - form.residual_value) / depreciationYrs
      : 0;
  const annualCost = calcPlantAnnualCost(form);
  const chargeableDays = form.utilisation_months * form.working_days_per_month;
  const dailyCost = chargeableDays > 0 ? annualCost / chargeableDays : 0;
  const profitAmount = dailyCost * (form.profit_uplift_pct / 100);
  const dailyChargeout = dailyCost + profitAmount;

  const Row = ({
    label,
    value,
    highlight,
    separator,
  }: {
    label: string;
    value: string;
    highlight?: boolean;
    separator?: boolean;
  }) => (
    <>
      {separator && <div className="border-t border-slate-700/60 my-1.5" />}
      <div
        className={`flex justify-between items-center text-xs py-0.5 ${
          highlight ? "font-semibold text-blue-300" : "text-slate-400"
        }`}
      >
        <span>{label}</span>
        <span className={highlight ? "text-blue-300" : "text-slate-300"}>{value}</span>
      </div>
    </>
  );

  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl p-4 space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Live Rate Preview
      </p>
      <Row label="Purchase price" value={gbp0(form.purchase_price)} />
      <Row
        label={`Annual depreciation (${depreciationYrs}yr)`}
        value={gbp0(depreciation)}
      />
      <Row label="+ Finance costs" value={gbp0(form.finance_cost_annual)} />
      <Row label="+ Maintenance" value={gbp0(form.maintenance_annual)} />
      <Row label="+ Insurance" value={gbp0(form.insurance_annual)} />
      {form.other_annual_costs > 0 && (
        <Row label="+ Other costs" value={gbp0(form.other_annual_costs)} />
      )}
      <Row label="= Total Annual Cost" value={gbp0(annualCost)} highlight separator />
      <Row
        label={`÷ Chargeable days (${chargeableDays})`}
        value=""
      />
      <Row label="= Daily cost" value={gbp(dailyCost)} separator />
      <Row label={`+ Profit (${form.profit_uplift_pct}%)`} value={gbp(profitAmount)} />
      <Row label="= Daily Chargeout" value={gbp(dailyChargeout)} highlight separator />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add / Edit Dialog
// ---------------------------------------------------------------------------

function PlantDialog({
  initial,
  onClose,
}: {
  initial: Partial<PlantResourceInput> & { id?: string };
  onClose: () => void;
}) {
  const [form, setForm] = useState<PlantResourceInput & { id?: string }>({
    ...BLANK,
    ...initial,
  });
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof PlantResourceInput>(key: K, value: PlantResourceInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function num(val: string): number {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }

  function int(val: string): number {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : n;
  }

  const chargeableDays = form.utilisation_months * form.working_days_per_month;
  const annualDepreciation =
    form.depreciation_years > 0
      ? (form.purchase_price - form.residual_value) / form.depreciation_years
      : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await upsertPlantResourceAction(form);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(form.id ? "Plant item updated" : "Plant item added");
        onClose();
      }
    });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-100">
            {form.id ? "Edit Plant Item" : "Add Plant Item"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">
            {/* Left: form fields */}
            <div className="p-6 space-y-1 border-r border-slate-700/50">
              {/* Basic Info */}
              <SectionHeading>Basic Info</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. 3T Mini Excavator"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    id="category"
                    value={form.category}
                    onChange={(e) => set("category", e.target.value as PlantRow["category"])}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="mt-3">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={form.description ?? ""}
                  onChange={(e) => set("description", e.target.value || null)}
                  placeholder="Make, model, specification..."
                />
              </div>

              {/* Capital Cost */}
              <SectionHeading>Capital Cost</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="purchase_price">Purchase Price (£) *</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    min={0}
                    step={1}
                    value={form.purchase_price}
                    onChange={(e) => set("purchase_price", num(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="depreciation_years">Depreciation Period (years)</Label>
                  <Input
                    id="depreciation_years"
                    type="number"
                    min={0}
                    step={1}
                    value={form.depreciation_years}
                    onChange={(e) => set("depreciation_years", int(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="residual_value">Residual / Salvage Value (£)</Label>
                  <Input
                    id="residual_value"
                    type="number"
                    min={0}
                    step={1}
                    value={form.residual_value}
                    onChange={(e) => set("residual_value", num(e.target.value))}
                  />
                </div>
              </div>
              {form.depreciation_years > 0 && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Annual depreciation:{" "}
                  <span className="text-slate-300 font-medium">{gbp0(annualDepreciation)}</span>
                </p>
              )}

              {/* Annual Running Costs */}
              <SectionHeading>Annual Running Costs</SectionHeading>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="finance_cost_annual">Finance / HP Cost (£)</Label>
                  <Input
                    id="finance_cost_annual"
                    type="number"
                    min={0}
                    step={1}
                    value={form.finance_cost_annual}
                    onChange={(e) => set("finance_cost_annual", num(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="maintenance_annual">Maintenance &amp; Repairs (£)</Label>
                  <Input
                    id="maintenance_annual"
                    type="number"
                    min={0}
                    step={1}
                    value={form.maintenance_annual}
                    onChange={(e) => set("maintenance_annual", num(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="insurance_annual">Insurance (£)</Label>
                  <Input
                    id="insurance_annual"
                    type="number"
                    min={0}
                    step={1}
                    value={form.insurance_annual}
                    onChange={(e) => set("insurance_annual", num(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="other_annual_costs">Other Costs (£)</Label>
                  <Input
                    id="other_annual_costs"
                    type="number"
                    min={0}
                    step={1}
                    value={form.other_annual_costs}
                    onChange={(e) => set("other_annual_costs", num(e.target.value))}
                  />
                </div>
              </div>

              {/* Utilisation */}
              <SectionHeading>Utilisation</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="utilisation_months">Months charged per year (1–12)</Label>
                  <Input
                    id="utilisation_months"
                    type="number"
                    min={1}
                    max={12}
                    step={1}
                    value={form.utilisation_months}
                    onChange={(e) => set("utilisation_months", Math.min(12, Math.max(1, int(e.target.value))))}
                  />
                  <p className="text-xs text-slate-600 mt-1">
                    10 months accounts for periods of low utilisation / maintenance
                  </p>
                </div>
                <div>
                  <Label htmlFor="working_days_per_month">Working days per month</Label>
                  <Input
                    id="working_days_per_month"
                    type="number"
                    min={1}
                    step={1}
                    value={form.working_days_per_month}
                    onChange={(e) => set("working_days_per_month", Math.max(1, int(e.target.value)))}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                Chargeable days:{" "}
                <span className="text-slate-300 font-medium">{chargeableDays} per year</span>
              </p>

              {/* Profit Uplift */}
              <SectionHeading>Profit Uplift</SectionHeading>
              <div className="w-40">
                <Label htmlFor="profit_uplift_pct">Profit on hire (%)</Label>
                <Input
                  id="profit_uplift_pct"
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.profit_uplift_pct}
                  onChange={(e) => set("profit_uplift_pct", num(e.target.value))}
                />
              </div>

              {/* Notes */}
              <SectionHeading>Notes</SectionHeading>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value || null)}
                placeholder="Any additional notes..."
              />
            </div>

            {/* Right: live preview */}
            <div className="p-6">
              <RatePreview form={form} />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-700 bg-slate-900 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {form.id ? "Save Changes" : "Add Plant Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function PlantResourcesClient({ plant }: { plant: PlantRow[] }) {
  const [dialogItem, setDialogItem] = useState<
    (Partial<PlantResourceInput> & { id?: string }) | null
  >(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function openAdd() {
    setDialogItem({ ...BLANK });
  }

  function openEdit(row: PlantRow) {
    setDialogItem({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      purchase_price: row.purchase_price,
      depreciation_years: row.depreciation_years,
      residual_value: row.residual_value,
      finance_cost_annual: row.finance_cost_annual,
      maintenance_annual: row.maintenance_annual,
      insurance_annual: row.insurance_annual,
      other_annual_costs: row.other_annual_costs,
      utilisation_months: row.utilisation_months,
      working_days_per_month: row.working_days_per_month,
      profit_uplift_pct: row.profit_uplift_pct,
      notes: row.notes,
      is_active: row.is_active,
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Remove this plant item? This cannot be undone.")) return;
    setDeletingId(id);
    startTransition(async () => {
      await deletePlantResourceAction(id);
      setDeletingId(null);
      toast.success("Plant item removed");
    });
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {plant.length === 0
            ? "No assets registered yet"
            : `${plant.length} asset${plant.length !== 1 ? "s" : ""} registered`}
        </p>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Plant Item
        </button>
      </div>

      {/* Empty state */}
      {plant.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-slate-700 text-center">
          <PackageOpen className="w-12 h-12 text-slate-600 mb-4" />
          <p className="text-slate-400 font-medium mb-1">No plant registered yet</p>
          <p className="text-sm text-slate-600 mb-6 max-w-xs">
            Add your owned assets to track depreciation, running costs and generate daily
            chargeout rates.
          </p>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add First Asset
          </button>
        </div>
      )}

      {/* Table */}
      {plant.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/60">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Category
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Purchase Price
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Annual Running Cost
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Chargeable Days/yr
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Daily Cost
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Daily Chargeout
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {plant.map((row) => {
                const annualCost = calcPlantAnnualCost(row);
                const chargeableDays = row.utilisation_months * row.working_days_per_month;
                const dailyCost = chargeableDays > 0 ? annualCost / chargeableDays : 0;
                const dailyChargeout = calcPlantDailyChargeout(row);
                const isDeleting = deletingId === row.id;

                return (
                  <tr
                    key={row.id}
                    className="bg-slate-900 hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {row.name}
                      {row.description && (
                        <p className="text-xs text-slate-500 font-normal mt-0.5">
                          {row.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {categoryLabel(row.category)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                      {gbp0(row.purchase_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                      {gbp0(annualCost)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                      {chargeableDays}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                      {gbp(dailyCost)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-300 tabular-nums">
                      {gbp(dailyChargeout)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Delete"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      {dialogItem && (
        <PlantDialog initial={dialogItem} onClose={() => setDialogItem(null)} />
      )}
    </div>
  );
}
