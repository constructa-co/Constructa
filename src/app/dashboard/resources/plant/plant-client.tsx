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
  category: "heavy_plant" | "light_plant" | "lifting" | "temp_works" | "light_tools" | "specialist_tools" | "other";
  description: string | null;
  // Rate mode
  rate_mode: string;             // 'simple' | 'full'
  daily_chargeout_rate: number;  // used in simple mode
  // Full buildup
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

// ── UK Construction Plant Name Suggestions ────────────────────────────────────

const PLANT_NAME_SUGGESTIONS = [
  // Heavy plant
  "1.5T Mini Digger","3T Mini Excavator","5T Excavator","8T Excavator","13T Excavator","20T Excavator","30T Excavator",
  "1T Site Dumper","3T Site Dumper","6T Site Dumper","9T Site Dumper",
  "Bulldozer / D6","Motor Grader","Vibratory Compactor","Roller",
  // Lifting
  "Mobile Crane","Tower Crane","Crawler Crane","Telescopic Handler / Telehandler","3.5T Forklift","5T Forklift",
  "Cherry Picker / MEWP (12m)","Cherry Picker / MEWP (20m)","Spider Lift","Boom Lift",
  // Light plant
  "Road Saw / Floor Saw","Disc Cutter / Angle Grinder","Breaker (Electric)","Breaker (Petrol)","Compactor Plate","Vibrating Roller (Hand-guided)","Wacker Plate",
  "Concrete Mixer","Concrete Pump","Poker Vibrator","Screed Rail System",
  "Pressure Washer","Road Sweeper (pedestrian)","Road Sweeper (ride-on)",
  // Tools
  "SDS Drill","Rotary Hammer Drill","Core Drill","Chop Saw / Mitre Saw","Table Saw","Jigsaw","Circular Saw",
  "Planer","Sander (Belt)","Angle Grinder","Nail Gun","Fixing Gun",
  // Temp works
  "Scaffold Tower","Trench Box / Drag Box","Trench Strut System","Shoring System","Formwork System","Props / Acrow Props",
  "Lighting Tower","Generator (10kVA)","Generator (20kVA)","Generator (60kVA)",
  "Welfare Unit","Toilet Block","Site Cabin / Office","Storage Container",
  "Dewatering Pump","Submersible Pump",
];

const CATEGORIES: { value: PlantRow["category"]; label: string }[] = [
  { value: "heavy_plant",      label: "Heavy Plant" },
  { value: "light_plant",      label: "Light Plant" },
  { value: "lifting",          label: "Lifting Equipment" },
  { value: "temp_works",       label: "Temporary Works" },
  { value: "light_tools",      label: "Light Tools" },
  { value: "specialist_tools", label: "Specialist Tools" },
  { value: "other",            label: "Other" },
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

export function calcPlantDailyChargeout(p: { rate_mode?: string; daily_chargeout_rate?: number } & PlantResourceInput): number {
  if (p.rate_mode === "simple") return p.daily_chargeout_rate ?? 0;
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
  rate_mode: "simple",
  daily_chargeout_rate: 0,
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
// Mini UI primitives (theme-aware via CSS variables)
// ---------------------------------------------------------------------------

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-muted-foreground mb-1">
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      onFocus={(e) => {
        if (props.type === "number") e.target.select();
        props.onFocus?.(e);
      }}
      className={
        "w-full h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground " +
        "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 " +
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
        "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground " +
        "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none " +
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
        "w-full h-10 rounded-lg border border-border bg-input px-3 text-sm text-foreground " +
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
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 mt-5 first:mt-0">
      {children}
    </h4>
  );
}

// ---------------------------------------------------------------------------
// Live Rate Preview
// ---------------------------------------------------------------------------

function RatePreview({ form }: { form: PlantResourceInput }) {
  const isSimple = form.rate_mode === "simple";

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
      {separator && <div className="border-t border-border/60 my-1.5" />}
      <div
        className={`flex justify-between items-center text-xs py-0.5 ${
          highlight ? "font-semibold text-blue-300" : "text-muted-foreground"
        }`}
      >
        <span>{label}</span>
        <span className={highlight ? "text-blue-300" : "text-foreground/80"}>{value}</span>
      </div>
    </>
  );

  if (isSimple) {
    const daily = form.daily_chargeout_rate;
    return (
      <div className="bg-card border border-border/60 rounded-xl p-4 space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Rate Summary
        </p>
        <Row label="Half day" value={gbp(daily / 2)} />
        <Row label="Daily chargeout" value={gbp(daily)} highlight separator />
        <Row label="Weekly (5 days)" value={gbp(daily * 5)} />
        <Row label="Monthly (20 days)" value={gbp(daily * 20)} />
      </div>
    );
  }

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

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 space-y-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
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
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {form.id ? "Edit Plant Item" : "Add Plant Item"}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground/80 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-0">
            {/* Left: form fields */}
            <div className="p-6 space-y-1 border-r border-border/50">
              {/* Basic Info */}
              <SectionHeading>Basic Info</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    list="plant-name-suggestions"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="e.g. 3T Mini Excavator"
                    required
                  />
                  <datalist id="plant-name-suggestions">
                    {PLANT_NAME_SUGGESTIONS.map((n) => <option key={n} value={n} />)}
                  </datalist>
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

              {/* Rate Mode Toggle */}
              <SectionHeading>Rate Mode</SectionHeading>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => set("rate_mode", "simple")}
                  className={[
                    "rounded-lg border-2 p-3 text-left transition-colors",
                    form.rate_mode === "simple"
                      ? "border-blue-500 bg-blue-950/40"
                      : "border-border bg-input/40 hover:border-border",
                  ].join(" ")}
                >
                  <p className={["font-semibold text-sm", form.rate_mode === "simple" ? "text-blue-300" : "text-foreground/80"].join(" ")}>
                    Simple Rate
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enter daily chargeout directly</p>
                </button>
                <button
                  type="button"
                  onClick={() => set("rate_mode", "full")}
                  className={[
                    "rounded-lg border-2 p-3 text-left transition-colors",
                    form.rate_mode === "full"
                      ? "border-blue-500 bg-blue-950/40"
                      : "border-border bg-input/40 hover:border-border",
                  ].join(" ")}
                >
                  <p className={["font-semibold text-sm", form.rate_mode === "full" ? "text-blue-300" : "text-foreground/80"].join(" ")}>
                    Full Buildup
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Build from depreciation + costs</p>
                </button>
              </div>

              {/* Simple mode: just ask for daily rate */}
              {form.rate_mode === "simple" && (
                <div className="mt-3">
                  <Label htmlFor="daily_chargeout_rate">Daily Chargeout Rate (£/day) *</Label>
                  <Input
                    id="daily_chargeout_rate"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.daily_chargeout_rate}
                    onChange={(e) => set("daily_chargeout_rate", parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 450.00"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Half-day:{" "}
                    <span className="text-foreground/80">{gbp(form.daily_chargeout_rate / 2)}</span>
                    {" "}· Weekly:{" "}
                    <span className="text-foreground/80">{gbp(form.daily_chargeout_rate * 5)}</span>
                  </p>
                </div>
              )}

              {/* Capital Cost — full buildup only */}
              {form.rate_mode === "full" && <><SectionHeading>Capital Cost</SectionHeading>
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
                <p className="text-xs text-muted-foreground mt-1.5">
                  Annual depreciation:{" "}
                  <span className="text-foreground/80 font-medium">{gbp0(annualDepreciation)}</span>
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
                  <p className="text-xs text-muted-foreground/60 mt-1">
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
              <p className="text-xs text-muted-foreground mt-1.5">
                Chargeable days:{" "}
                <span className="text-foreground/80 font-medium">{chargeableDays} per year</span>
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
              </>}

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
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border bg-card px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-input transition-colors"
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
      rate_mode: row.rate_mode || "full",
      daily_chargeout_rate: row.daily_chargeout_rate ?? 0,
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
        <p className="text-sm text-muted-foreground">
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
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-border text-center">
          <PackageOpen className="w-12 h-12 text-muted-foreground/60 mb-4" />
          <p className="text-muted-foreground font-medium mb-1">No plant registered yet</p>
          <p className="text-sm text-muted-foreground/60 mb-6 max-w-xs">
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
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-input/60">
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Category
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mode
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Half Day
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Daily Chargeout
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Weekly
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {plant.map((row) => {
                const isSimple = (row.rate_mode || "full") === "simple";
                const dailyChargeout = calcPlantDailyChargeout(row);
                const halfDay = dailyChargeout / 2;
                const weekly = dailyChargeout * 5;
                const isDeleting = deletingId === row.id;

                return (
                  <tr
                    key={row.id}
                    className="bg-card hover:bg-input/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {row.name}
                      {row.description && (
                        <p className="text-xs text-muted-foreground font-normal mt-0.5">
                          {row.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground/80 whitespace-nowrap text-sm">
                      {categoryLabel(row.category)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={[
                        "text-xs px-2 py-0.5 rounded-full border",
                        isSimple
                          ? "border-border text-muted-foreground"
                          : "border-blue-700/50 bg-blue-900/50 text-blue-300",
                      ].join(" ")}>
                        {isSimple ? "Simple" : "Buildup"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground/80 tabular-nums font-mono text-sm">
                      {gbp(halfDay)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-300 tabular-nums font-mono text-sm">
                      {gbp(dailyChargeout)}
                    </td>
                    <td className="px-4 py-3 text-right text-foreground/80 tabular-nums font-mono text-sm">
                      {gbp(weekly)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={isDeleting}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
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
