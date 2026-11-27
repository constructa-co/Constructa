import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { WorkspaceStyles } from "@/lib/workspace-styles";
import { formatPlanDate } from "@/lib/programme-plan";
import { CREW_CHECK_REASON_TEXT, type CrewCheck, type CrewFeasibility } from "@/lib/programme-crew";
import type { ProgrammeCostStage, ShiftKey } from "@/lib/programme-costs";

const SHIFT_WORD: Record<ShiftKey, string> = { day: "day", night: "night" };

export function hours(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} h`;
}

function stageNames(indexes: readonly number[], stages: readonly Pick<ProgrammeCostStage, "name">[]): string {
    return indexes.map((index) => stages[index]?.name ?? `Stage ${index + 1}`).join(", ");
}

/** One-line summary for the panel header, shown even while the panel is closed. */
export function crewCheckHeadline(check: CrewFeasibility | null): string | null {
    if (!check || check.status !== "short") return null;
    const shortShifts = check.crews.reduce((sum, crew) => sum + crew.shortWindows.length, 0);
    return `Crew check: the planned crews are short of the priced labour hours on ${shortShifts} ${shortShifts === 1 ? "shift" : "shifts"}. Open Programme costs to review.`;
}

function ShortCrew({ crew, stages, s, scheduleHref }: { crew: CrewCheck; stages: readonly ProgrammeCostStage[]; s: WorkspaceStyles; scheduleHref: string }) {
    const needs = crew.shortWindows.reduce((sum, window) => sum + window.demandHours, 0);
    const has = crew.shortWindows.reduce((sum, window) => sum + window.capacityHours, 0);
    const involved = [...new Set(crew.shortWindows.flatMap((window) => window.stages))].sort((a, b) => a - b);
    const count = crew.shortWindows.length;
    return (
        <div role="alert" className={`${s.errorBox} space-y-2 text-sm`} data-crew-short={crew.crewId}>
            <p className="flex items-start gap-2 font-semibold">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span>
                    {crew.name} ({SHIFT_WORD[crew.shift]} shift) is short on {count} {count === 1 ? "shift" : "shifts"}
                    {crew.firstShortDate && crew.lastShortDate && (crew.firstShortDate === crew.lastShortDate
                        ? ` on ${formatPlanDate(crew.firstShortDate, "short")}`
                        : ` between ${formatPlanDate(crew.firstShortDate, "short")} and ${formatPlanDate(crew.lastShortDate, "short")}`)}.
                </span>
            </p>
            <p data-crew-short-figures>
                On those shifts the priced labour needs {hours(needs)}; the crew has {hours(has)} ({crew.operatives} {crew.operatives === 1 ? "operative" : "operatives"} × {hours(crew.productiveHoursPerShift)} a shift). Short by {hours(crew.shortfallHours)}.
            </p>
            <p>Stages involved: {stageNames(involved, stages)}.</p>
            <p>
                You could lengthen {involved.length === 1 ? "this stage" : "these stages"} on the programme, plan more operatives or hours for this crew, or move overlapping stages apart.
                Nothing here changes your programme or your price.{" "}
                <Link href={scheduleHref} className="underline">Open the programme</Link>
            </p>
            <details>
                <summary className="cursor-pointer">Shift by shift</summary>
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead><tr><th>Date</th><th>Shift</th><th>Stages</th><th>Needs</th><th>Has</th><th>Short</th></tr></thead>
                        <tbody>
                            {crew.shortWindows.map((window) => (
                                <tr key={`${window.date}-${window.shift}`} data-crew-short-window={window.date}>
                                    <td>{formatPlanDate(window.date, "short")}</td><td>{SHIFT_WORD[window.shift]}</td>
                                    <td>{stageNames(window.stages, stages)}</td>
                                    <td>{hours(window.demandHours)}</td><td>{hours(window.capacityHours)}</td><td>{hours(window.shortfallHours)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>
        </div>
    );
}

export function CrewCheckView({ check, stages, s, scheduleHref }: {
    check: CrewFeasibility;
    stages: readonly ProgrammeCostStage[];
    s: WorkspaceStyles;
    scheduleHref: string;
}) {
    const shortCrews = check.crews.filter((crew) => crew.shortWindows.length > 0);
    return (
        <div className="space-y-3" data-crew-check data-crew-check-status={check.status}>
            <h3 className={`text-base font-semibold ${s.heading}`}>Crew check against the programme</h3>
            <p className={`text-sm ${s.muted}`}>
                Compares each stage&apos;s priced labour hours, spread evenly over its working shifts, with the hours your planned crews can work on those dates.
                A crew shared by overlapping stages is counted once on each date. This is a check only: it never changes dates, lengths or prices.
            </p>
            {check.status === "not_set" && (
                <p className={`${s.noticeBox} text-sm`}>Not checked yet. Add the crews you plan and choose one for each stage&apos;s shifts to check the programme length against the priced labour.</p>
            )}
            {check.status === "cannot_check" && (
                <p className={`${s.noticeBox} text-sm`}>Cannot be checked yet: the information below is missing.</p>
            )}
            {check.status === "fits" && (
                <p className={`${s.noticeBox} text-sm`} data-crew-check-fits>
                    The planned crews have the hours for the priced labour on every working shift of the programme.
                </p>
            )}
            {check.status === "partial" && (
                <p className={`${s.noticeBox} text-sm`}>
                    The planned crews have the hours on the {check.checkedStageShifts} of {check.totalStageShifts} stage shifts that could be checked. The rest are not checked, so this is not a full check.
                </p>
            )}
            {shortCrews.map((crew) => <ShortCrew key={crew.crewId} crew={crew} stages={stages} s={s} scheduleHref={scheduleHref} />)}
            {check.unchecked.length > 0 && check.status !== "not_set" && (
                <div className={`text-sm ${s.body}`} data-crew-check-unchecked>
                    <p className="font-semibold">Not checked:</p>
                    <ul className="list-disc pl-5">
                        {check.unchecked.map((item) => (
                            <li key={`${item.stage}-${item.shift}`}>{item.stageName}, {SHIFT_WORD[item.shift]} shift: {CREW_CHECK_REASON_TEXT[item.reason]}.</li>
                        ))}
                    </ul>
                </div>
            )}
            {check.paidGangNotes.map((note) => (
                <p key={note.shift} className={`text-sm ${s.muted}`} data-crew-paid-gang-note={note.shift}>
                    On {note.datesBelow} {SHIFT_WORD[note.shift]} {note.datesBelow === 1 ? "shift" : "shifts"} you plan fewer operatives (as few as {note.lowestPlanned}) than the minimum paid gang of {note.minimumPaidGang}.
                    The minimum paid gang is priced as a cost; only the planned crew counts as working hours here.
                </p>
            ))}
        </div>
    );
}
