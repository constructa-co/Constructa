"use client";

import { useState } from "react";
import type { AdminData, CostEntry } from "../types";
import { PLAN_PRICE_GBP } from "../types";
import { saveCostEntryAction } from "../actions";

interface Props {
  data: AdminData;
}

const VALID_CATEGORIES = [
  "Supabase",
  "Vercel",
  "OpenAI",
  "Stripe Fees",
  "Marketing",
  "Tools",
  "Other",
] as const;

function fmt(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDecimal(n: number, digits = 2) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function currentYYYYMM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function groupByMonth(entries: CostEntry[]) {
  const map = new Map<string, CostEntry[]>();
  for (const e of entries) {
    const key = e.month.slice(0, 7); // "2024-01"
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

function monthLabel(yyyyMM: string) {
  const [year, month] = yyyyMM.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleString("en-GB", { month: "short", year: "2-digit" });
}

export default function CostsTab({ data }: Props) {
  const { costs, revenue, totalSubscribers } = data;

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // P&L figures
  const mrr = revenue.mrr;
  const infraCost =
    costs.manualCosts
      .filter(
        (e) =>
          e.month.startsWith(currentYYYYMM()) &&
          (e.category === "Supabase" || e.category === "Vercel")
      )
      .reduce((s, e) => s + e.amount_gbp, 0) || 0;
  const openaiMtd = costs.openaiMtdCostGbp;
  const totalCogs = openaiMtd + infraCost;
  const grossProfit = mrr - totalCogs;
  const grossMargin = mrr > 0 ? (grossProfit / mrr) * 100 : 0;
  const otherSaasCosts =
    costs.manualCosts
      .filter(
        (e) =>
          e.month.startsWith(currentYYYYMM()) &&
          !["Supabase", "Vercel", "OpenAI"].includes(e.category)
      )
      .reduce((s, e) => s + e.amount_gbp, 0) || 0;
  const ebitda = grossProfit - otherSaasCosts;
  const monthlyBurn = totalCogs + otherSaasCosts;
  const runway = mrr > 0 && monthlyBurn > 0 ? monthlyBurn / (mrr - monthlyBurn) : null;

  // Cost per user
  const costPerUser =
    totalSubscribers > 0 ? costs.totalMonthlyCostGbp / totalSubscribers : 0;
  const grossProfitPerUser = PLAN_PRICE_GBP - costPerUser;
  const contributionMargin =
    PLAN_PRICE_GBP > 0 ? (grossProfitPerUser / PLAN_PRICE_GBP) * 100 : 0;

  // Daily bar chart
  const maxDailyCost = Math.max(
    ...costs.openaiDailyCosts.map((d) => d.cost_gbp),
    0.01
  );

  // Manual cost entries — current month + last 3 months
  const now = new Date();
  const relevantMonths: string[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    relevantMonths.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    );
  }
  const filteredEntries = costs.manualCosts.filter((e) =>
    relevantMonths.includes(e.month.slice(0, 7))
  );
  const grouped = groupByMonth(filteredEntries);

  async function handleAddCost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const fd = new FormData(e.currentTarget);
    const result = await saveCostEntryAction(fd);
    setSaving(false);
    if (result.success) {
      setSaveSuccess(true);
      setAddOpen(false);
      (e.target as HTMLFormElement).reset();
    } else {
      setSaveError(result.error ?? "Unknown error");
    }
  }

  return (
    <div className="space-y-6">
      {/* ── P&L Summary ── */}
      <div className="rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 border border-zinc-700 p-6">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4">
          P&amp;L Summary — MTD
        </h2>
        <table className="w-full text-sm">
          <tbody>
            <tr className="text-zinc-100">
              <td className="py-1 font-medium">Revenue (MRR)</td>
              <td className="py-1 text-right tabular-nums font-semibold text-emerald-400">
                {fmt(mrr)}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="py-1">
                <div className="border-t border-zinc-600" />
              </td>
            </tr>
            <tr className="text-zinc-400">
              <td className="py-1 pl-2 italic">Cost of Revenue (COGS)</td>
              <td />
            </tr>
            <tr className="text-zinc-300">
              <td className="py-1 pl-4">
                OpenAI API (MTD)
                <span className="ml-2 text-xs text-sky-400 font-medium">[live]</span>
              </td>
              <td className="py-1 text-right tabular-nums">{fmtDecimal(openaiMtd)}</td>
            </tr>
            <tr className="text-zinc-300">
              <td className="py-1 pl-4">
                Infrastructure (Supabase + Vercel)
                <span className="ml-2 text-xs text-amber-400 font-medium">[manual]</span>
              </td>
              <td className="py-1 text-right tabular-nums">{fmtDecimal(infraCost)}</td>
            </tr>
            <tr className="text-zinc-500">
              <td className="py-1 pl-4">
                Payment processing
                <span className="ml-2 text-xs text-zinc-500 font-medium">
                  [when billing live]
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">£0</td>
            </tr>
            <tr>
              <td colSpan={2} className="py-1">
                <div className="border-t border-zinc-600" />
              </td>
            </tr>
            <tr className={grossProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
              <td className="py-1 font-semibold">Gross Profit</td>
              <td className="py-1 text-right tabular-nums font-semibold">
                {fmt(grossProfit)}{" "}
                <span className="text-xs font-normal opacity-80">
                  {grossMargin.toFixed(0)}% margin
                </span>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="py-1">
                <div className="border-t border-zinc-600" />
              </td>
            </tr>
            <tr className="text-zinc-400">
              <td className="py-1 pl-2 italic">Operating Expenses</td>
              <td />
            </tr>
            <tr className="text-zinc-300">
              <td className="py-1 pl-4">
                Other SaaS tools
                <span className="ml-2 text-xs text-amber-400 font-medium">[manual]</span>
              </td>
              <td className="py-1 text-right tabular-nums">{fmtDecimal(otherSaasCosts)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="py-1">
                <div className="border-t border-zinc-600" />
              </td>
            </tr>
            <tr className="text-zinc-100 font-semibold">
              <td className="py-1">EBITDA (est.)</td>
              <td className="py-1 text-right tabular-nums">{fmt(ebitda)}</td>
            </tr>
            <tr>
              <td colSpan={2} className="py-1">
                <div className="border-t border-zinc-600" />
              </td>
            </tr>
            <tr className="text-zinc-300">
              <td className="py-1">Monthly Burn</td>
              <td className="py-1 text-right tabular-nums">{fmt(monthlyBurn)}</td>
            </tr>
            <tr className="text-zinc-300">
              <td className="py-1">Runway (at current burn)</td>
              <td className="py-1 text-right tabular-nums">
                {mrr > 0 && runway !== null
                  ? `${runway.toFixed(0)} months`
                  : "N/A"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Cost Breakdown KPI Cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total COGS", value: fmtDecimal(totalCogs) },
          { label: "Cost Per User", value: fmtDecimal(costPerUser) },
          {
            label: "Gross Margin",
            value: `${costs.grossMarginPct.toFixed(1)}%`,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 flex flex-col gap-1"
          >
            <span className="text-xs text-zinc-400 uppercase tracking-wide">
              {kpi.label}
            </span>
            <span className="text-2xl font-bold text-zinc-100">{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* ── OpenAI Spend Panel ── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
          OpenAI Spend
        </h3>
        <div className="flex gap-6">
          <div>
            <span className="text-xs text-zinc-400">MTD (GBP)</span>
            <p className="text-xl font-bold text-zinc-100">
              {fmtDecimal(costs.openaiMtdCostGbp)}
            </p>
          </div>
          <div>
            <span className="text-xs text-zinc-400">MTD (USD)</span>
            <p className="text-xl font-bold text-zinc-100">
              ${(costs.openaiMtdCostGbp * 1.27).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Daily bar chart */}
        <div>
          <span className="text-xs text-zinc-500 mb-2 block">Daily cost (last 30d)</span>
          <div className="flex items-end gap-0.5 h-20">
            {costs.openaiDailyCosts.map((day) => {
              const heightPct = maxDailyCost > 0 ? (day.cost_gbp / maxDailyCost) * 100 : 0;
              return (
                <div
                  key={day.date}
                  title={`${day.date}: ${fmtDecimal(day.cost_gbp)}`}
                  className="flex-1 min-w-0 rounded-sm bg-sky-600 hover:bg-sky-400 transition-colors cursor-default"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                />
              );
            })}
          </div>
        </div>

        <p className="text-xs text-zinc-500">
          Estimated based on token usage × blended gpt-4o-mini rate
        </p>
      </div>

      {/* ── Manual Cost Entries Table ── */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-widest">
            Manual Cost Entries
          </h3>
          <button
            onClick={() => {
              setAddOpen((o) => !o);
              setSaveError(null);
              setSaveSuccess(false);
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
          >
            {addOpen ? "Cancel" : "+ Add cost entry"}
          </button>
        </div>

        {/* Inline add form */}
        {addOpen && (
          <form
            onSubmit={handleAddCost}
            className="rounded-lg bg-zinc-800 border border-zinc-600 p-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Month</label>
                <input
                  name="month"
                  type="month"
                  defaultValue={currentYYYYMM()}
                  required
                  className="rounded-md bg-zinc-700 border border-zinc-600 text-zinc-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Category</label>
                <select
                  name="category"
                  required
                  className="rounded-md bg-zinc-700 border border-zinc-600 text-zinc-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  {VALID_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Description</label>
                <input
                  name="description"
                  type="text"
                  placeholder="e.g. Pro plan"
                  className="rounded-md bg-zinc-700 border border-zinc-600 text-zinc-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-400">Amount (£)</label>
                <input
                  name="amount_gbp"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  required
                  className="rounded-md bg-zinc-700 border border-zinc-600 text-zinc-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
            {saveError && (
              <p className="text-xs text-red-400">{saveError}</p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="text-sm px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {saveSuccess && (
          <p className="text-xs text-emerald-400">Cost entry saved.</p>
        )}

        {/* Entries grouped by month */}
        {relevantMonths.map((ym) => {
          const entries = grouped.get(ym) ?? [];
          return (
            <div key={ym}>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                {monthLabel(ym)}
              </h4>
              {entries.length === 0 ? (
                <p className="text-xs text-zinc-600 pl-2">No entries</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500 border-b border-zinc-800">
                      <th className="text-left py-1.5 font-medium">Month</th>
                      <th className="text-left py-1.5 font-medium">Category</th>
                      <th className="text-left py-1.5 font-medium">Description</th>
                      <th className="text-right py-1.5 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-b border-zinc-800 last:border-0 text-zinc-300"
                      >
                        <td className="py-1.5">{monthLabel(entry.month.slice(0, 7))}</td>
                        <td className="py-1.5">
                          <span className="px-1.5 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300">
                            {entry.category}
                          </span>
                        </td>
                        <td className="py-1.5 text-zinc-400">
                          {entry.description ?? "—"}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {fmtDecimal(entry.amount_gbp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Unit Economics ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Revenue per user", value: `£${PLAN_PRICE_GBP}/mo` },
          { label: "COGS per user", value: fmtDecimal(costPerUser) },
          { label: "Gross profit per user", value: fmtDecimal(grossProfitPerUser) },
          {
            label: "Contribution margin",
            value: `${contributionMargin.toFixed(1)}%`,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-zinc-900 border border-zinc-700 p-3 flex flex-col gap-1"
          >
            <span className="text-xs text-zinc-500 leading-tight">{card.label}</span>
            <span className="text-lg font-bold text-zinc-100">{card.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
