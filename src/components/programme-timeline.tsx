import {
    PROGRAMME_BASIS_NOTE,
    formatDateRange,
    formatPlanDate,
    formatWorkingDuration,
    stageBar,
    type ProgrammePlan,
} from "@/lib/programme-plan";

type Tone = "light" | "dark" | "document";

const TONES: Record<Tone, { label: string; value: string; muted: string; track: string; bar: string; rule: string }> = {
    light: { label: "text-gray-600", value: "text-gray-900", muted: "text-gray-600", track: "bg-gray-200", bar: "bg-blue-600", rule: "border-gray-200" },
    dark: { label: "text-slate-400", value: "text-white", muted: "text-slate-400", track: "bg-[#2a2a2a]", bar: "bg-blue-500", rule: "border-[#2a2a2a]" },
    // The document sets its own accent through --doc-accent.
    document: { label: "text-stone-500", value: "text-stone-900", muted: "text-stone-600", track: "bg-stone-200", bar: "bg-[var(--doc-accent)]", rule: "border-stone-200" },
};

/**
 * The mini Gantt: start, finish and length, then one bar per stage on a
 * shared time axis. Each stage states its dates in words as well, so the
 * programme never depends on reading the bars. The bars sit inside the
 * component's own width, so nothing scrolls sideways on a phone.
 */
export default function ProgrammeTimeline({ plan, tone }: { plan: ProgrammePlan; tone: Tone }) {
    const t = TONES[tone];
    const facts = [
        { label: "Start on site", value: formatPlanDate(plan.start_date) },
        { label: "Finish", value: formatPlanDate(plan.end_date) },
        { label: "Duration", value: plan.duration_label },
    ];

    return (
        <div data-programme-timeline>
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                {facts.map((fact) => (
                    <div key={fact.label} className="min-w-0">
                        <dt className={`text-xs font-semibold uppercase tracking-wide ${t.label}`}>{fact.label}</dt>
                        <dd className={`mt-0.5 text-base font-semibold break-words ${t.value}`}>{fact.value}</dd>
                    </div>
                ))}
            </dl>

            <ol className={`mt-5 space-y-3 border-t pt-4 ${t.rule}`} aria-label="Programme stages">
                {plan.stages.map((stage, index) => {
                    const bar = stageBar(plan, stage);
                    return (
                        <li key={`${stage.name}-${index}`} className="min-w-0">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <span className={`text-sm font-semibold break-words min-w-0 ${t.value}`}>{stage.name}</span>
                                <span className={`text-sm ${t.muted}`}>
                                    {formatDateRange(stage.start_date, stage.end_date)} · {formatWorkingDuration(stage.working_days)}
                                </span>
                            </div>
                            <div className={`mt-1.5 h-3 w-full rounded-full overflow-hidden ${t.track}`} aria-hidden="true">
                                <div
                                    className={`h-full rounded-full ${t.bar}`}
                                    style={{ marginLeft: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
                                />
                            </div>
                        </li>
                    );
                })}
            </ol>

            <div className={`mt-2 flex justify-between gap-3 text-xs ${t.muted}`} aria-hidden="true">
                <span>{formatPlanDate(plan.start_date, "short")}</span>
                <span>{formatPlanDate(plan.end_date, "short")}</span>
            </div>
            <p className={`mt-3 text-xs ${t.muted}`}>{PROGRAMME_BASIS_NOTE}</p>
        </div>
    );
}
