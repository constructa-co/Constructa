import { formatWorkingDuration } from "@/lib/programme-plan";
import { programmeAxisDays, programmeAxisLabels, programmeBasisNote, programmeFacts, programmeStageBar, programmeStageRange, RELATIVE_PROGRAMME_BASIS, type DisplayProgrammePlan } from "@/lib/relative-programme";
import ui from "./programme.module.css";

export default function ProgrammeOverview({ plan, isDark }: { plan: DisplayProgrammePlan; isDark: boolean }) {
    const facts = programmeFacts(plan, "short");
    const [first, last] = programmeAxisLabels(plan);
    // Keep the duration proportional; a separate start marker keeps tiny activities visible.
    const bars = plan.stages.map((_, index) => programmeStageBar(plan, index, 0));
    const hasShortActivity = bars.some(bar => bar.widthPct < 1);
    return (
        <div className={ui.overview} data-dark={isDark ? "true" : "false"} data-programme-timeline data-programme-overview>
            <dl className={ui.overviewFacts}>
                {facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
            </dl>
            {plan.basis !== RELATIVE_PROGRAMME_BASIS && (
                <p className={ui.overviewCalendarSpan} data-programme-calendar-span>
                    <strong>Calendar span: {plan.calendar_days} calendar {plan.calendar_days === 1 ? "day" : "days"}</strong>
                    {" · "}{plan.working_days} working {plan.working_days === 1 ? "day" : "days"}.
                    {" "}Calendar time stays continuous across weeks. Bars show start-to-finish spans, including any weekends within an activity; gaps can include weekends or unscheduled time.
                </p>
            )}
            <div className={ui.overviewAxis} aria-hidden="true">
                <span>Activity</span>
                <div><span>{first}</span><span>{last}</span></div>
            </div>
            <ol className={ui.overviewRows} aria-label="Programme activities" data-calendar-axis={plan.basis !== RELATIVE_PROGRAMME_BASIS ? "true" : undefined}>
                {plan.stages.map((stage, index) => {
                    const bar = bars[index];
                    return (
                        <li key={`${stage.name}-${index}`} className={ui.overviewRow} data-overview-stage={index}>
                            <div className={ui.overviewLabel}>
                                <strong>{stage.name}</strong>
                                <span>{programmeStageRange(plan, index)} · {formatWorkingDuration(stage.working_days)}</span>
                            </div>
                            <div className={ui.overviewTrack} aria-hidden="true" style={{ backgroundSize: `${100 / programmeAxisDays(plan)}% 100%` }}>
                                <div className={ui.overviewBar} style={{ insetInlineStart: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}>
                                    <span>{stage.name}</span>
                                </div>
                                {bar.widthPct < 1 && <span className={ui.overviewStartMarker} data-short-activity-marker
                                    style={{ insetInlineStart: `${bar.leftPct}%` }} />}
                            </div>
                        </li>
                    );
                })}
            </ol>
            {hasShortActivity && <p className={ui.overviewBasis}>Very short activities have a start marker. Read their dates and duration beside the timeline; the marker does not show their length.</p>}
            <p className={ui.overviewBasis}>{programmeBasisNote(plan)}</p>
        </div>
    );
}
