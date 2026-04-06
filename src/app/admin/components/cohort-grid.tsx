import type { CohortRow } from "../types";

interface CohortGridProps {
    cohorts: CohortRow[];
    maxMonths?: number;
}

/**
 * Returns a Tailwind bg + text class pair for a given retention %.
 * null values get a distinct "empty" treatment.
 */
function cellClass(pct: number | null, isM0: boolean): string {
    if (isM0) return "bg-amber-500 text-zinc-950 font-semibold";
    if (pct === null) return "bg-zinc-800 text-zinc-600";
    if (pct >= 80) return "bg-amber-500 text-zinc-950 font-semibold";
    if (pct >= 60) return "bg-amber-700 text-zinc-100";
    if (pct >= 40) return "bg-yellow-700 text-zinc-100";
    if (pct >= 20) return "bg-zinc-600 text-zinc-200";
    return "bg-zinc-700 text-zinc-400";
}

function CellValue({ pct }: { pct: number | null }) {
    if (pct === null) return <span>—</span>;
    return <span>{Math.round(pct)}%</span>;
}

export default function CohortGrid({
    cohorts,
    maxMonths = 12,
}: CohortGridProps) {
    if (!cohorts || cohorts.length === 0) {
        return (
            <div className="flex items-center justify-center text-zinc-500 text-sm py-10 px-4 text-center">
                No cohort data yet — check back after 2+ months of usage
            </div>
        );
    }

    const cols = Math.min(maxMonths, 12);
    const columnHeaders = Array.from({ length: cols }, (_, i) =>
        i === 0 ? "M+0" : `M+${i}`
    );

    // Show newest cohort at top → oldest at bottom
    const orderedCohorts = [...cohorts].reverse();

    return (
        <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-xs min-w-max">
                <thead>
                    <tr>
                        {/* Row header column */}
                        <th className="text-left text-zinc-400 font-medium px-3 py-2 whitespace-nowrap sticky left-0 bg-zinc-950 z-10">
                            Cohort
                        </th>
                        {columnHeaders.map((h) => (
                            <th
                                key={h}
                                className="text-center text-zinc-500 font-medium px-2 py-2 whitespace-nowrap min-w-[52px]"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {orderedCohorts.map((row) => (
                        <tr
                            key={row.cohortMonth}
                            className="border-t border-zinc-800/50"
                        >
                            {/* Row header */}
                            <td className="text-zinc-300 px-3 py-1.5 whitespace-nowrap sticky left-0 bg-zinc-950 z-10">
                                {row.cohortLabel}
                                <span className="text-zinc-500 ml-1.5">
                                    (n={row.cohortSize})
                                </span>
                            </td>

                            {/* Data cells */}
                            {Array.from({ length: cols }, (_, colIdx) => {
                                const isM0 = colIdx === 0;
                                // M+0 is always 100%
                                const rawPct = isM0
                                    ? 100
                                    : row.retention[colIdx] ?? null;

                                return (
                                    <td key={colIdx} className="px-1 py-1 text-center">
                                        <span
                                            className={`inline-flex items-center justify-center rounded w-full min-w-[44px] py-1 px-1 ${cellClass(
                                                rawPct,
                                                isM0
                                            )}`}
                                        >
                                            <CellValue pct={rawPct} />
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
