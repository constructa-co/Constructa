"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Search,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { restoreProjectAction } from "./actions";
import { toast } from "sonner";
import { coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";
import {
  financialTiles,
  gbp,
  isMeasured,
  pct,
  programmeRows,
  summariseArchive,
  toMeasured,
  variationRows,
  type ArchiveSnapshotFigures,
  type RowTone,
} from "./archive-format";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ArchiveSnapshot extends ArchiveSnapshotFigures {
  snapshot_date: string | null;
}

const ROW_TONE_CLASS: Record<RowTone, string> = {
  neutral: "text-white",
  late: "text-amber-400",
  ok: "text-emerald-400",
};

interface ArchivedProject {
  id: string;
  name: string;
  client_name: string | null;
  site_address: string | null;
  project_type: string | null;
  archived_at: string | null;
  archive_reason: string | null;
  start_date: string | null;
  archive_snapshots: ArchiveSnapshot[];
}

interface Props {
  projects: ArchivedProject[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function MarginIcon({ pct }: { pct: number | null }) {
  if (pct == null) return <Minus className="w-4 h-4 text-slate-400" />;
  if (pct >= 15) return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (pct >= 5) return <Minus className="w-4 h-4 text-amber-400" />;
  return <TrendingDown className="w-4 h-4 text-red-400" />;
}

function marginColour(pct: number | null): string {
  if (pct == null) return "text-slate-400";
  if (pct >= 15) return "text-emerald-400";
  if (pct >= 5) return "text-amber-400";
  return "text-red-400";
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ArchiveClient({ projects }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  // Project types for filter
  const projectTypes = Array.from(
    new Set(projects.map((p) => p.project_type).filter(Boolean))
  ) as string[];

  const filtered = projects.filter((p) => {
    const term = search.toLowerCase();
    const matchSearch =
      !term ||
      p.name.toLowerCase().includes(term) ||
      (p.client_name ?? "").toLowerCase().includes(term) ||
      (p.site_address ?? "").toLowerCase().includes(term);
    const matchType = typeFilter === "all" || p.project_type === typeFilter;
    return matchSearch && matchType;
  });

  // KPI summary
  // Only measured snapshot figures contribute; a null rollup drops its card.
  const { totalContractValue, avgMargin, totalRetention } = summariseArchive(
    projects.map((p) => p.archive_snapshots?.[0])
  );

  function handleRestore(projectId: string) {
    setRestoringId(projectId);
    startTransition(async () => {
      const result = await restoreProjectAction(projectId);
      setRestoringId(null);
      setConfirmRestoreId(null);
      if (result.error) {
        toast.error("Failed to restore: " + result.error);
      } else {
        toast.success("Project restored to active");
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <Archive className="w-5 h-5 text-slate-400" />
          <h1 className="text-xl font-semibold text-white">Project Archive</h1>
        </div>
        <p className="text-sm text-slate-400 ml-8">
          Closed projects with preserved financial outcomes
        </p>
      </div>

      <div className="p-6 space-y-6 max-w-6xl mx-auto">

        {/* KPI Strip */}
        {projects.length > 0 && (
          <div className="grid grid-flow-col auto-cols-fr gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-1">Archived Projects</p>
              <p className="text-2xl font-bold text-white">{projects.length}</p>
            </div>
            {totalContractValue != null && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Total Contract Value</p>
                <p className="text-2xl font-bold text-white">{gbp(totalContractValue)}</p>
              </div>
            )}
            {avgMargin != null && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                <p className="text-xs text-slate-400 mb-1">Avg Gross Margin</p>
                <p className={`text-2xl font-bold ${marginColour(avgMargin)}`}>
                  {pct(avgMargin)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Retention alert */}
        {totalRetention != null && totalRetention > 0 && (
          <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-800/50 rounded-lg px-4 py-3 text-sm text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>{gbp(totalRetention)}</strong> retention still outstanding across archived projects — raise final invoices to release.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Search projects, clients, addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="all">All types</option>
            {projectTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div className="text-center py-16">
            <Archive className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-slate-400 font-medium mb-2">No archived projects</h3>
            <p className="text-slate-500 text-sm">
              Projects you close and archive will appear here with their full financial record.
            </p>
          </div>
        )}

        {/* No search results */}
        {projects.length > 0 && filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-sm">
            No projects match your search.
          </div>
        )}

        {/* Project List */}
        <div className="space-y-3">
          {filtered.map((project) => {
            const snap = project.archive_snapshots?.[0];
            const isExpanded = expandedId === project.id;

            return (
              <div
                key={project.id}
                className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
              >
                {/* Row header */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : project.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-white truncate">{project.name}</span>
                      {project.project_type && (
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full shrink-0">
                          {project.project_type}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {project.client_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {project.client_name}
                        </span>
                      )}
                      {project.archived_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Archived {fmtDate(project.archived_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Financial summary inline */}
                  <div className="hidden sm:flex items-center gap-6 text-sm">
                    {isMeasured(snap?.contract_value) && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Contract Value</p>
                        <p className="text-white font-medium">{gbp(snap?.contract_value)}</p>
                      </div>
                    )}
                    {isMeasured(snap?.gross_margin_pct) && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Margin</p>
                        <p className={`font-medium flex items-center gap-1 justify-end ${marginColour(toMeasured(snap?.gross_margin_pct))}`}>
                          <MarginIcon pct={toMeasured(snap?.gross_margin_pct)} />
                          {pct(snap?.gross_margin_pct)}
                        </p>
                      </div>
                    )}
                    {isMeasured(snap?.final_account_amount) && (
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Final Account</p>
                        <p className="text-white font-medium">{gbp(snap?.final_account_amount)}</p>
                      </div>
                    )}
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && snap && (
                  <div className="border-t border-slate-800 px-5 py-4 space-y-4">
                    {/* Financial grid — only tiles backed by loaded data */}
                    {financialTiles(snap).length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                          Financial Outcome
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {financialTiles(snap).map((tile) => {
                            const colour =
                              tile.key === "margin"
                                ? marginColour(toMeasured(snap.gross_margin_pct))
                                : tile.key === "retention" && (toMeasured(snap.retention_outstanding) ?? 0) > 0
                                  ? "text-amber-400"
                                  : undefined;
                            return (
                              <div key={tile.key} className="bg-slate-800/50 rounded-lg p-3">
                                <p className="text-xs text-slate-500 mb-0.5">{tile.label}</p>
                                <p className={`text-sm font-semibold ${colour ?? "text-white"}`}>
                                  {tile.value}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Programme + Variations — sections without recorded data are omitted */}
                    {(programmeRows(snap).length > 0 || variationRows(snap).length > 0) && (
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { title: "Programme", rows: programmeRows(snap) },
                          { title: "Variations", rows: variationRows(snap) },
                        ]
                          .filter((section) => section.rows.length > 0)
                          .map((section) => (
                            <div key={section.title}>
                              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                                {section.title}
                              </h4>
                              <div className="space-y-2 text-sm">
                                {section.rows.map((row) => (
                                  <div key={row.label} className="flex justify-between">
                                    <span className="text-slate-400">{row.label}</span>
                                    <span className={ROW_TONE_CLASS[row.tone]}>{row.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}

                    {/* Archive reason */}
                    {project.archive_reason && (
                      <div className="bg-slate-800/50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Archive notes</p>
                        <p className="text-sm text-slate-300">{project.archive_reason}</p>
                      </div>
                    )}

                    {/* Restore */}
                    <div className="flex justify-end pt-2">
                      {confirmRestoreId === project.id ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-slate-400">Restore this project to active?</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 hover:bg-slate-800"
                            onClick={() => setConfirmRestoreId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className={`${corePrimaryButton} ${coreFocusVisibleRing}`}
                            disabled={isPending}
                            onClick={() => handleRestore(project.id)}
                          >
                            <RotateCcw className="w-3 h-3 mr-1.5" />
                            {restoringId === project.id ? "Restoring…" : "Confirm Restore"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                          onClick={() => setConfirmRestoreId(project.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1.5" />
                          Restore to Active
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
