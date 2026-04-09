"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, BarChart2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  project_type: string | null;
  contract_value: number | null;
  status: string;
}

interface PlRow {
  project_id: string;
  gross_margin_pct: number | null;
}

interface VarRow {
  project_id: string;
  value: number | null;
  status: string | null;
}

interface SchedRow {
  project_id: string;
  planned_end_date: string | null;
  actual_end_date: string | null;
}

interface BenchmarkRow {
  project_type: string | null;
  contract_value_band: string | null;
  gross_margin_pct: number | null;
  variation_rate_pct: number | null;
  programme_delay_days: number | null;
}

interface Props {
  projects: Project[];
  plRows: PlRow[];
  varRows: VarRow[];
  schedRows: SchedRow[];
  benchmarks: BenchmarkRow[];
  hasConsent: boolean;
}

const BAND_ORDER = ["0-50k", "50k-100k", "100k-250k", "250k-500k", "500k+"];

function cvBand(val: number | null): string {
  if (!val) return "0-50k";
  if (val < 50_000)  return "0-50k";
  if (val < 100_000) return "50k-100k";
  if (val < 250_000) return "100k-250k";
  if (val < 500_000) return "250k-500k";
  return "500k+";
}

function avg(vals: number[]): number | null {
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function round1(n: number | null): string {
  if (n == null) return "—";
  return n.toFixed(1);
}

type Direction = "up" | "down" | "neutral";

function delta(mine: number | null, bench: number | null, higherIsBetter: boolean): Direction {
  if (mine == null || bench == null) return "neutral";
  const diff = mine - bench;
  if (Math.abs(diff) < 0.5) return "neutral";
  if (diff > 0) return higherIsBetter ? "up" : "down";
  return higherIsBetter ? "down" : "up";
}

function DeltaBadge({ mine, bench, higherIsBetter, unit = "%" }: {
  mine: number | null;
  bench: number | null;
  higherIsBetter: boolean;
  unit?: string;
}) {
  const dir = delta(mine, bench, higherIsBetter);
  if (mine == null || bench == null) return <span className="text-xs text-slate-500">—</span>;

  const diff = mine - bench;
  const label = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}${unit} vs benchmark`;

  if (dir === "up")
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-400">
        <TrendingUp className="w-3 h-3" /> {label}
      </span>
    );
  if (dir === "down")
    return (
      <span className="flex items-center gap-1 text-xs text-red-400">
        <TrendingDown className="w-3 h-3" /> {label}
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-slate-500">
      <Minus className="w-3 h-3" /> In line with benchmark
    </span>
  );
}

function MetricCard({
  title,
  mine,
  bench,
  higherIsBetter,
  unit = "%",
  description,
}: {
  title: string;
  mine: number | null;
  bench: number | null;
  higherIsBetter: boolean;
  unit?: string;
  description: string;
}) {
  const dir = delta(mine, bench, higherIsBetter);
  const borderColor =
    dir === "up" ? "border-emerald-700/40" :
    dir === "down" ? "border-red-700/40" :
    "border-slate-800";

  return (
    <div className={`bg-slate-900 border rounded-xl p-5 space-y-3 ${borderColor}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
        {dir === "up" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
        {dir === "down" && <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
      </div>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-2xl font-bold text-white">
            {mine != null ? `${mine.toFixed(1)}${unit}` : "—"}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">Your average</p>
        </div>
        {bench != null && (
          <div className="pb-0.5">
            <p className="text-base font-semibold text-slate-400">
              {bench.toFixed(1)}{unit}
            </p>
            <p className="text-[10px] text-slate-500">Industry avg</p>
          </div>
        )}
      </div>
      <DeltaBadge mine={mine} bench={bench} higherIsBetter={higherIsBetter} unit={unit} />
      <p className="text-[11px] text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

export default function IntelligenceClient({
  projects,
  plRows,
  varRows,
  schedRows,
  benchmarks,
  hasConsent,
}: Props) {

  // ── Compute my metrics ────────────────────────────────────────────────────
  const myMetrics = useMemo(() => {
    const latestPl = new Map<string, number>();
    for (const r of plRows) {
      if (!latestPl.has(r.project_id) && r.gross_margin_pct != null) {
        latestPl.set(r.project_id, r.gross_margin_pct);
      }
    }

    const marginVals: number[] = [];
    const variationRates: number[] = [];
    const delayDays: number[] = [];

    for (const p of projects) {
      const margin = latestPl.get(p.id);
      if (margin != null) marginVals.push(margin);

      const projVars = varRows.filter(v => v.project_id === p.id);
      const approvedVarTotal = projVars
        .filter(v => v.status === "approved")
        .reduce((s, v) => s + (v.value ?? 0), 0);
      if (p.contract_value && p.contract_value > 0) {
        variationRates.push((approvedVarTotal / p.contract_value) * 100);
      }

      const sched = schedRows.find(s => s.project_id === p.id);
      if (sched?.planned_end_date && sched?.actual_end_date) {
        const diff = Math.round(
          (new Date(sched.actual_end_date).getTime() - new Date(sched.planned_end_date).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        delayDays.push(diff);
      }
    }

    return {
      grossMargin:    avg(marginVals),
      variationRate:  avg(variationRates),
      programmeDelay: avg(delayDays),
      projectCount:   projects.length,
    };
  }, [projects, plRows, varRows, schedRows]);

  // ── Compute benchmark averages across all data ────────────────────────────
  const benchMetrics = useMemo(() => {
    const margins  = benchmarks.map(b => b.gross_margin_pct).filter((v): v is number => v != null);
    const varRates = benchmarks.map(b => b.variation_rate_pct).filter((v): v is number => v != null);
    const delays   = benchmarks.map(b => b.programme_delay_days).filter((v): v is number => v != null);
    return {
      grossMargin:    avg(margins),
      variationRate:  avg(varRates),
      programmeDelay: avg(delays),
      sampleSize:     benchmarks.length,
    };
  }, [benchmarks]);

  const hasSufficientData = myMetrics.projectCount >= 1;
  const hasBenchmarks = benchMetrics.sampleSize > 0;

  // ── Per project-type breakdown ────────────────────────────────────────────
  const typeBreakdown = useMemo(() => {
    const types = Array.from(new Set(projects.map(p => p.project_type ?? "Unknown")));
    return types.map(type => {
      const typeProjects = projects.filter(p => (p.project_type ?? "Unknown") === type);
      const margins = typeProjects
        .map(p => {
          for (const r of plRows) {
            if (r.project_id === p.id && r.gross_margin_pct != null) return r.gross_margin_pct;
          }
          return null;
        })
        .filter((v): v is number => v != null);

      const benchForType = benchmarks.filter(b => b.project_type === type);
      const benchMargins = benchForType.map(b => b.gross_margin_pct).filter((v): v is number => v != null);

      return {
        type,
        count: typeProjects.length,
        myMargin: avg(margins),
        benchMargin: avg(benchMargins),
        benchSample: benchForType.length,
      };
    });
  }, [projects, plRows, benchmarks]);

  return (
    <div className="max-w-4xl mx-auto p-8 pt-12 space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Business Intelligence</h1>
          <p className="text-slate-400 mt-1">
            How your business compares to industry benchmarks.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2">
          <BarChart2 className="w-3.5 h-3.5" />
          <span>{benchMetrics.sampleSize} benchmark records</span>
        </div>
      </div>

      {/* Consent nudge */}
      {!hasConsent && (
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-300">
            <span className="font-semibold">Help improve these benchmarks.</span>{" "}
            Enable anonymised data sharing in{" "}
            <Link href="/dashboard/settings/profile" className="underline hover:text-blue-200">
              Profile Settings
            </Link>{" "}
            to contribute your data and strengthen the industry dataset.
          </div>
        </div>
      )}

      {/* No data state */}
      {!hasSufficientData && (
        <div className="text-center py-16 border border-dashed border-slate-800 rounded-xl">
          <BarChart2 className="w-10 h-10 mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400 font-semibold">No project data yet</p>
          <p className="text-slate-600 text-sm mt-1">
            Complete projects with cost and programme data will appear here.
          </p>
        </div>
      )}

      {hasSufficientData && (
        <>
          {/* Summary KPI strip */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{myMetrics.projectCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Projects analysed</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {myMetrics.grossMargin != null ? `${myMetrics.grossMargin.toFixed(1)}%` : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Avg gross margin</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">
                {myMetrics.programmeDelay != null
                  ? `${myMetrics.programmeDelay > 0 ? "+" : ""}${myMetrics.programmeDelay.toFixed(0)}d`
                  : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Avg programme variance</p>
            </div>
          </div>

          {/* Metric cards */}
          {!hasBenchmarks ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
              <p className="text-slate-500 text-sm">
                Industry benchmarks will appear here once enough anonymised data has been contributed by contractors.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Gross Margin"
                mine={myMetrics.grossMargin}
                bench={benchMetrics.grossMargin}
                higherIsBetter={true}
                unit="%"
                description="Net revenue minus direct project costs, as a percentage of contract value."
              />
              <MetricCard
                title="Variation Rate"
                mine={myMetrics.variationRate}
                bench={benchMetrics.variationRate}
                higherIsBetter={false}
                unit="%"
                description="Approved variation value as a percentage of original contract value. Lower is better."
              />
              <MetricCard
                title="Programme Delay"
                mine={myMetrics.programmeDelay}
                bench={benchMetrics.programmeDelay}
                higherIsBetter={false}
                unit=" days"
                description="Average days over planned completion. Negative means early delivery."
              />
            </div>
          )}

          {/* By project type */}
          {typeBreakdown.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Margin by Project Type</h2>
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Type</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Projects</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Your Margin</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Industry Avg</th>
                      <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Vs Benchmark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {typeBreakdown.map((row, i) => {
                      const diff = row.myMargin != null && row.benchMargin != null
                        ? row.myMargin - row.benchMargin
                        : null;
                      return (
                        <tr key={row.type} className={i < typeBreakdown.length - 1 ? "border-b border-slate-800/50" : ""}>
                          <td className="px-4 py-3 text-white font-medium">{row.type}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{row.count}</td>
                          <td className="px-4 py-3 text-right text-white font-semibold">
                            {row.myMargin != null ? `${row.myMargin.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-400">
                            {row.benchMargin != null ? `${row.benchMargin.toFixed(1)}%` : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {diff == null ? (
                              <span className="text-slate-600">—</span>
                            ) : diff > 0.5 ? (
                              <span className="text-emerald-400 font-medium">+{diff.toFixed(1)}%</span>
                            ) : diff < -0.5 ? (
                              <span className="text-red-400 font-medium">{diff.toFixed(1)}%</span>
                            ) : (
                              <span className="text-slate-500">≈ benchmark</span>
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

          {/* About benchmarks */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">About These Benchmarks</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Industry benchmarks are computed from anonymised project data contributed by Constructa users who have enabled data sharing.
              All data is stripped of identifying information before aggregation.
              Benchmarks become more accurate as the dataset grows.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
