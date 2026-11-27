import type { WorkspaceStyles } from "@/lib/workspace-styles";
import { formatPlanDate } from "@/lib/programme-plan";
import { hireUnitLabel } from "@/lib/programme-costs";
import { offHireNeedsReview, type HireAnchorSource, type OffHireRow, type OffHireSchedule } from "@/lib/programme-off-hire";

function sourceText(source: HireAnchorSource | null, edge: "start" | "end"): string {
    if (!source) return "";
    return source.kind === "date" ? "fixed date" : `${edge} of ${source.stageName}`;
}

function movedText(days: number): string {
    if (days === 0) return "";
    return ` (moved ${days > 0 ? "+" : "−"}${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"})`;
}

function ruleText(row: OffHireRow): string {
    const days = `${row.offHireDays} ${row.offHireDays === 1 ? "day" : "days"}`;
    if (row.offHireRule === "call_date_plus_notice") return row.offHireDays ? `off-hire call, then ${days}' notice` : "off-hire call, no notice";
    if (row.offHireRule === "collection_date") return row.offHireDays ? `collected ${days} after` : "collected the same day";
    return "";
}

function billedText(row: OffHireRow): string {
    if (row.periods === null || row.periodsFromDates === null) return "";
    const basis = row.chargeableDayCount !== null ? `${row.chargeableDayCount} chargeable days` : `${row.calendarDays} calendar days`;
    const unit = hireUnitLabel(row.unit);
    const minimum = row.minimumApplied ? `; minimum hire of ${row.periods} applied` : "";
    return `${row.periods} × ${unit} (${basis}${minimum})`;
}

export function OffHireReview({ schedule, s }: { schedule: OffHireSchedule; s: WorkspaceStyles }) {
    if (!schedule.ok || schedule.rows.length === 0) return null;
    const review = offHireNeedsReview(schedule.rows);
    return (
        <div className="space-y-2" data-off-hire-review>
            <h3 className={`text-base font-semibold ${s.heading}`}>Plant on hire: dates from your programme</h3>
            <p className={`text-sm ${s.muted}`}>
                Planned dates from the saved programme. A planned off-hire is not an off-hire instruction: nothing is sent to, booked with or cancelled with a supplier.
            </p>
            {review && (
                <p className={`text-sm ${s.errorText}`} role="status" data-off-hire-moved>
                    The programme has moved hire dates since these hire costs were added. The estimate keeps the earlier price until you review and apply.
                </p>
            )}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className={s.muted}><th>Item</th><th>On hire</th><th>Planned off-hire</th><th>Supplier charges to</th><th>Billed</th></tr>
                    </thead>
                    <tbody>
                        {schedule.rows.map((row) => row.status === "refused" ? (
                            <tr key={row.id} data-off-hire-row={row.id} data-off-hire-status="refused">
                                <td className={s.body}>{row.description}</td>
                                <td colSpan={4} className={s.errorText}>Not worked out: {row.reason}</td>
                            </tr>
                        ) : (
                            <tr key={row.id} className={s.body} data-off-hire-row={row.id} data-off-hire-status="planned">
                                <td>{row.description}</td>
                                <td data-off-hire-on={row.onHireDate}>
                                    {formatPlanDate(row.onHireDate!, "short")}{row.moved ? movedText(row.moved.onHire) : ""}
                                    <span className={`block ${s.muted}`}>{sourceText(row.onHireSource, "start")}</span>
                                </td>
                                <td data-off-hire-off={row.plannedOffHireDate}>
                                    {formatPlanDate(row.plannedOffHireDate!, "short")}{row.moved ? movedText(row.moved.plannedOffHire) : ""}
                                    <span className={`block ${s.muted}`}>{sourceText(row.offHireSource, "end")}</span>
                                </td>
                                <td data-off-hire-charged={row.chargedToDate}>
                                    {formatPlanDate(row.chargedToDate!, "short")}{row.moved ? movedText(row.moved.chargedTo) : ""}
                                    <span className={`block ${s.muted}`}>{ruleText(row)}</span>
                                </td>
                                <td data-off-hire-billed>
                                    {billedText(row)}
                                    {row.applied?.savedPeriods != null && row.applied.savedPeriods !== row.periods && (
                                        <span className={`block ${s.errorText}`}>On the estimate: {row.applied.savedPeriods} × {hireUnitLabel(row.unit)}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
