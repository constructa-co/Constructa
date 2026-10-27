"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import ProgrammeOverview from "@/components/programme-overview";
import ProgrammeStageFocus from "@/components/programme-stage-focus";
import ProgrammeInclusionChoice from "@/components/programme-inclusion-choice";
import ProgrammeEstimateActivity from "@/components/programme-estimate-activity";
import { copyProgrammeActivityName, programmeEstimateActivities } from "@/lib/programme-estimate-activities";
import { readProgrammeInclusion } from "@/lib/programme-inclusion";
import SaveStatus from "@/components/save-status";
import ui from "@/components/programme.module.css";
import { newClientId } from "@/lib/client-id";
import { isCapabilityEnabled } from "@/lib/launch-profile";
import { formatPlanDate, formatWorkingDuration, PROGRAMME_BASIS_NOTE } from "@/lib/programme-plan";
import { hasRelativeProgramme, programmeBasisNote, RELATIVE_PROGRAMME_BASIS, RELATIVE_PROGRAMME_NOTE } from "@/lib/relative-programme";
import { resolveJobWorkingPattern } from "@/lib/job-working-pattern";
import {
    MAX_STAGES,
    MIN_STAGES,
    PROGRAMME_STATUS_LABEL,
    continueToProposal,
    draftPlan,
    emptyProgrammeDraft,
    initialProgrammeState,
    programmeReducer,
    programmeSaveStatus,
    proposalPathForProject,
    saveProgramme,
    stageDurationField,
    stageNameField,
    viewForProject,
    type DurationUnit,
    type ProgrammeDraft,
    type SaveProgramme,
    type SimpleProgrammeView,
} from "@/lib/simple-programme";
import { useTheme } from "@/lib/theme-context";
import { useReducerStore } from "@/lib/use-reducer-store";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { BEFORE_PROJECT_NAVIGATION } from "@/lib/project-navigation";
import { workspaceStyles, type WorkspaceStyles } from "@/lib/workspace-styles";
import { saveSimpleProgrammeAction } from "./simple-actions";
import { saveProgrammeInclusionAction, type SaveProgrammeInclusion } from "./inclusion-actions";

const PROGRAMME_LEAVE_WARNING =
    "Your programme has changes that are not saved yet.\n\nPress Cancel to stay here and save them, or OK to leave without saving.";

// The drag-and-drop planner is only downloaded when it is opened.
const DetailedPlanner = dynamic(() => import("./client-page"), {
    ssr: false,
    loading: () => <p className="p-4 text-sm text-slate-300">Loading the detailed planner…</p>,
});

interface ProgrammeProject {
    programme_working_pattern?: unknown;
    id: string;
    name: string;
    client_name?: string | null;
    start_date?: string | null;
    programme_phases?: unknown[] | null;
    gantt_phases?: unknown[] | null;
}

interface Props {
    project: ProgrammeProject;
    /** Why pre-contract information can no longer be changed, if it cannot. */
    lockReason: string | null;
    /** The selected estimate with saved lines; simple entry reuses names only. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    estimate: any;
    /** Defaults to the real server action; replaced only by tests and evidence capture. */
    save?: SaveProgramme;
    saveInclusion?: SaveProgrammeInclusion;
}

export default function SimpleProgrammeClient({ project: incomingProject, lockReason, estimate, save, saveInclusion }: Props) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const s = workspaceStyles(isDark);
    const router = useRouter();
    const [refreshing, startRefresh] = useTransition();

    const [detailedOpen, setDetailedOpen] = useState(false);
    const [startedSimple, setStartedSimple] = useState(false);
    // The planner replaces the simple editor on screen, which would drop
    // anything typed there and not yet saved. It is not opened over that.
    const [unsavedSimple, setUnsavedSimple] = useState(false);
    const [plannerRefused, setPlannerRefused] = useState(false);
    const [relativeSimple, setRelativeSimple] = useState(hasRelativeProgramme(incomingProject.programme_phases));
    const [override, setOverride] = useState<{ base: ProgrammeProject; value: ProgrammeProject } | null>(null);
    const [inclusionBusy, setInclusionBusy] = useState(false);
    const unsavedCheckRef = useRef<(() => boolean) | null>(null);
    const project = override?.base === incomingProject ? override.value : incomingProject;
    const inclusion = readProgrammeInclusion(project.programme_phases);
    const relativePlannerBlocked = relativeSimple || hasRelativeProgramme(inclusion.phases);
    const jobPattern = resolveJobWorkingPattern(project.programme_working_pattern);
    const calendarPlannerBlocked = jobPattern === null;

    // Keys for saved stages are positional so the first render matches on the
    // server and in the browser.
    const view = useMemo(() => {
        let n = 0;
        return viewForProject({ ...project, programme_phases: readProgrammeInclusion(project.programme_phases).phases }, () => `saved-${n++}`);
    }, [project]);
    const showExtended = isCapabilityEnabled("extended-modules");

    // The detailed planner saves as it goes. Closing it reloads the project so
    // the simple view shows what the planner left behind.
    const toggleDetailed = () => {
        if (inclusionBusy) return;
        if (!detailedOpen && (relativePlannerBlocked || calendarPlannerBlocked)) return;
        if (!detailedOpen && unsavedSimple) {
            setPlannerRefused(true);
            return;
        }
        setPlannerRefused(false);
        if (detailedOpen) startRefresh(() => router.refresh());
        setDetailedOpen((open) => !open);
    };

    const detailedSection = relativePlannerBlocked ? (
        <section className={`${s.card} p-4 sm:p-5`} role="note" data-relative-planner-note>
            <p className={`text-sm ${s.muted}`}>The detailed planner needs a known start date. To use it, choose a target start date, save the dated programme and reopen Programme. Your relative activities stay here until you explicitly save a change.</p>
        </section>
    ) : calendarPlannerBlocked ? (
        <section className={`${s.card} p-4 sm:p-5`} role="note" data-calendar-planner-note>
            <p role="alert" className={`text-sm ${s.muted}`}>Check this job&apos;s saved working days before editing its programme. The detailed planner cannot replace an invalid saved pattern.</p>
        </section>
    ) : (
        <section className={s.card} aria-labelledby="detailed-planner-title">
            <button
                type="button"
                disabled={inclusionBusy}
                onClick={toggleDetailed}
                aria-expanded={detailedOpen}
                aria-controls="detailed-planner"
                aria-describedby={plannerRefused && unsavedSimple ? "detailed-planner-refused" : undefined}
                className={`w-full min-h-14 px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left ${s.body}`}
            >
                <span>
                    <span id="detailed-planner-title" className={`block text-base font-bold ${s.heading}`}>Detailed programme planner</span>
                    <span className={`block text-sm ${s.muted}`}>
                        Optional. Overlapping stages, dependencies, working week and progress tracking.
                    </span>
                </span>
                <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${detailedOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>

            {plannerRefused && unsavedSimple && !detailedOpen && (
                <p id="detailed-planner-refused" role="alert" className={`mx-4 sm:mx-5 mb-4 text-sm ${s.noticeBox}`} data-planner-refused>
                    Save your programme first. Opening the planner now would lose the changes above that are not saved yet.
                </p>
            )}

            {detailedOpen && (
                <div id="detailed-planner" className="px-3 sm:px-5 pb-5 space-y-4">
                    <p className={`text-sm ${s.muted}`}>
                        The simple programme is hidden while this is open. Changes here save as you make them. Close the planner to go back.
                        This workspace is laid out for a wide screen.
                    </p>
                    <p className={`text-sm ${s.muted}`}>
                        Stages are positioned on a grid of whole weeks. For a complete five-day programme, dates use the proposal&apos;s Monday-to-Friday calculation.
                        Other working-week choices remain planner-only; the proposal&apos;s calendar does not change.
                    </p>
                    {view.kind === "simple" && !view.hasSaved && (
                        <p role="note" className={`text-sm ${s.noticeBox}`}>
                            This job has no programme yet. The planner offers a starting point from your estimate, with a
                            placeholder length for anything it cannot work out. Nothing is saved, and your proposal has no
                            programme, until you change it or press Save to Proposal.
                        </p>
                    )}
                    <div data-wide-workspace className="rounded-xl bg-[#0d0d0d] p-3 sm:p-4 overflow-x-auto">
                        <div className="min-w-[760px]">
                            <DetailedPlanner project={project as never} estimate={estimate} projectId={project.id} />
                        </div>
                    </div>
                    {showExtended && (
                        <div>
                            <p className={`text-sm ${s.muted}`}>Once the job is running, record what actually happened against this programme.</p>
                            <Link href={`/dashboard/projects/programme?projectId=${encodeURIComponent(project.id)}`} className={`${s.quietButton} -ml-3`}>
                                Open the live programme
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </section>
    );

    return (
        <div className={`${ui.root} space-y-5`} data-dark={isDark ? "true" : "false"}>
            {detailedOpen ? (
                <>
                    <Heading project={project} s={s} />
                    {detailedSection}
                </>
            ) : refreshing ? (
                <>
                    <Heading project={project} s={s} />
                    <p role="status" className={`text-sm flex items-center gap-2 ${s.body}`}>
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading the programme…
                    </p>
                </>
            ) : (
                <>
                    {inclusion.intent === "invalid" ? (
                        <p role="alert" className={s.errorBox}>Check the saved programme inclusion choice before editing it.</p>
                    ) : inclusion.intent === "omit" ? (
                        <>
                            <Heading project={project} s={s} />
                            <p role="status" className={s.noticeBox}>Programme deliberately omitted from the proposal. Your saved activities have not been deleted.</p>
                            {lockReason && <p className={s.noticeBox}>{lockReason}</p>}
                            <Link href={proposalPathForProject(project.id)} className={s.primaryButton}>Next: Proposal</Link>
                        </>
                    ) : lockReason ? (
                        <ReadOnlyProgramme project={project} view={view} note={lockReason} s={s} isDark={isDark} />
                    ) : view.kind === "simple" || startedSimple ? (
                        <fieldset disabled={inclusionBusy} className="min-w-0 space-y-5 border-0 m-0 p-0">
                        <ProgrammeEditor
                            key={project.id}
                            project={project}
                            estimate={estimate}
                            initial={view.kind === "simple" ? view : { kind: "simple", draft: emptyProgrammeDraft(view.startDate, project.programme_working_pattern == null ? undefined : jobPattern ?? undefined), hasSaved: false }}
                            save={async input => {
                                const result = await (save ? save(input) : saveSimpleProgrammeAction(project.id, input));
                                if (result.success && result.confirmedProject) {
                                    setOverride({ base: incomingProject, value: { ...project, ...result.confirmedProject } });
                                }
                                return result;
                            }}
                            onUnsavedChange={setUnsavedSimple}
                            onRelativeChange={setRelativeSimple}
                            unsavedCheckRef={unsavedCheckRef}
                            s={s}
                            isDark={isDark}
                        />
                        </fieldset>
                    ) : (
                        <ReadOnlyProgramme
                            project={project}
                            view={view}
                            note={view.reason}
                            s={s}
                            isDark={isDark}
                            onStartSimple={view.canStartSimple ? () => { if (!inclusionBusy) setStartedSimple(true); } : undefined}
                            onOpenDetailed={view.origin === "programme" ? toggleDetailed : undefined}
                        />
                    )}
                    {!lockReason && inclusion.intent !== "invalid" && <ProgrammeInclusionChoice
                        included={inclusion.intent !== "omit"} disabled={inclusionBusy}
                        canChange={() => !unsavedCheckRef.current?.()}
                        save={saveInclusion ?? (include => saveProgrammeInclusionAction(project.id, include))}
                        onPending={setInclusionBusy}
                        onConfirmed={phases => {
                            setOverride({ base: incomingProject, value: { ...project, programme_phases: phases } });
                            setRelativeSimple(hasRelativeProgramme(readProgrammeInclusion(phases).phases));
                            setStartedSimple(false); setUnsavedSimple(false); unsavedCheckRef.current = null;
                        }} s={s}
                    />}
                    {!lockReason && inclusion.intent === "include" && detailedSection}
                </>
            )}
        </div>
    );
}

function Heading({ project, s, children }: { project: ProgrammeProject; s: WorkspaceStyles; children?: React.ReactNode }) {
    return (
        <div className={`${ui.header} flex flex-wrap items-start justify-between gap-3`}>
            <div className="min-w-0">
                <p className={ui.eyebrow}>From your activities to a clear plan</p>
                <h1 className={`${ui.title} text-2xl sm:text-3xl font-bold break-words ${s.heading}`}>Programme</h1>
                <p className={`mt-1 text-base break-words ${s.muted}`}>
                    {project.name}{project.client_name ? ` for ${project.client_name}` : ""}
                </p>
                <p className={ui.guide}>Use a target start date or relative working days, then add optional stages. Check the preview before saving or moving to the proposal.</p>
            </div>
            {children}
        </div>
    );
}

// ─── Read-only: locked, or built in the detailed planner ─────────────────────

function ReadOnlyProgramme({
    project, view, note, s, isDark, onStartSimple, onOpenDetailed,
}: {
    project: ProgrammeProject;
    view: SimpleProgrammeView;
    note: string;
    s: WorkspaceStyles;
    isDark: boolean;
    onStartSimple?: () => void;
    onOpenDetailed?: () => void;
}) {
    const plan = view.kind === "detailed" ? view.plan : draftPlan(view.draft);
    return (
        <>
            <Heading project={project} s={s} />
            <div role="status" className={`${s.noticeBox} text-sm space-y-3`} data-programme-readonly>
                <p>{note}</p>
                {(onStartSimple || onOpenDetailed) && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        {onOpenDetailed && (
                            <button type="button" onClick={onOpenDetailed} className={`${s.secondaryButton} min-h-11 text-sm`}>Open the detailed planner</button>
                        )}
                        {onStartSimple && (
                            <button type="button" onClick={onStartSimple} className={`${s.secondaryButton} min-h-11 text-sm`}>Start a simple programme</button>
                        )}
                    </div>
                )}
            </div>
            <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="programme-summary-title">
                <h2 id="programme-summary-title" className={`text-lg font-bold ${s.heading}`}>Programme on the proposal</h2>
                <div className="mt-4">
                    {plan
                        ? <ProgrammeOverview plan={plan} isDark={isDark} />
                        : <p className={`text-base ${s.muted}`}>No dated programme has been saved for this project.</p>}
                </div>
            </section>
            <div className="flex justify-end">
                <Link href={proposalPathForProject(project.id)} className={`${s.primaryButton} w-full sm:w-auto`}>
                    Next: Proposal <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
            </div>
        </>
    );
}

// ─── The simple editor ───────────────────────────────────────────────────────

function ProgrammeEditor({
    project, estimate, initial, save, onUnsavedChange, onRelativeChange, unsavedCheckRef, s, isDark,
}: {
    project: ProgrammeProject;
    estimate: unknown;
    initial: { kind: "simple"; draft: ProgrammeDraft; hasSaved: boolean };
    save: SaveProgramme;
    /** Told whenever there is, or is no longer, anything typed here that the server does not hold. */
    onUnsavedChange?: (unsaved: boolean) => void;
    onRelativeChange?: (relative: boolean) => void;
    unsavedCheckRef?: React.RefObject<(() => boolean) | null>;
    s: WorkspaceStyles;
    isDark: boolean;
}) {
    const router = useRouter();
    const [state, store] = useReducerStore(programmeReducer, () => initialProgrammeState(initial.draft, initial.hasSaved));
    const [leaving, setLeaving] = useState(false);
    const { draft, fieldErrors } = state;
    const estimateActivities = programmeEstimateActivities(project.id, estimate);
    const status = programmeSaveStatus(state);
    useEffect(() => {
        if (!unsavedCheckRef) return;
        const check = () => ["unsaved", "failed", "saving"].includes(programmeSaveStatus(store.getState()));
        unsavedCheckRef.current = check;
        return () => { if (unsavedCheckRef.current === check) unsavedCheckRef.current = null; };
    }, [store, unsavedCheckRef]);
    const saving = state.save.status === "saving";
    const staged = draft.stages.length > 0;
    const relative = draft.timeBasis === "relative";
    const plan = useMemo(() => draftPlan(draft), [draft]);
    const alertRef = useRef<HTMLDivElement>(null);

    const unsaved = status === "unsaved" || status === "failed" || status === "saving";
    useUnsavedGuard(!leaving && unsaved, PROGRAMME_LEAVE_WARNING);
    useEffect(() => {
        if (leaving || !unsaved) return;
        const confirmProjectChange = (event: Event) => {
            if (!window.confirm(PROGRAMME_LEAVE_WARNING)) event.preventDefault();
        };
        window.addEventListener(BEFORE_PROJECT_NAVIGATION, confirmProjectChange);
        return () => window.removeEventListener(BEFORE_PROJECT_NAVIGATION, confirmProjectChange);
    }, [leaving, unsaved]);
    useEffect(() => {
        onUnsavedChange?.(unsaved);
        return () => onUnsavedChange?.(false);
    }, [unsaved, onUnsavedChange]);

    // A save can be started from the bottom of the page. Bring a failure and
    // its retry into view rather than leaving them off screen. The alert keeps
    // a margin above it so it clears the phone's fixed top bar.
    const failed = state.save.status === "failed";
    useEffect(() => {
        if (failed) alertRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [failed]);

    const handleSave = () => void saveProgramme(store, save);
    const handleNext = () => void continueToProposal(store, save, () => {
        setLeaving(true);
        router.push(proposalPathForProject(project.id));
        router.refresh();
    });

    const unitSelect = (id: string, value: DurationUnit, onChange: (unit: DurationUnit) => void, label: string) => (
        <select
            id={id}
            aria-label={label}
            value={value}
            disabled={saving}
            onChange={(e) => onChange(e.target.value as DurationUnit)}
            className={`${s.input} px-2`}
        >
            <option value="weeks">weeks</option>
            <option value="days">working days</option>
        </select>
    );
    const errorText = (id: string, message: string | undefined) =>
        message ? <p id={id} className={`mt-1.5 text-sm ${s.errorText}`}>{message}</p> : null;

    const iconButton = `min-h-11 min-w-11 rounded-lg inline-flex items-center justify-center transition-colors disabled:opacity-40 ${
        isDark ? "text-slate-300 hover:bg-white/10" : "text-gray-700 hover:bg-gray-100"
    }`;

    return (
        <>
            <ProgrammeStageFocus revision={state} />
            <Heading project={project} s={s}>
                <SaveStatus status={status} label={PROGRAMME_STATUS_LABEL[status]} isDark={isDark} />
            </Heading>

            {state.save.status === "failed" && (
                <div ref={alertRef} role="alert" className={`${s.errorBox} flex flex-wrap items-center gap-3 text-sm scroll-mt-20`} data-programme-save-error>
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    <p className="flex-1 min-w-[12rem]">{state.save.error}</p>
                    <button type="button" onClick={handleSave} className={`${s.secondaryButton} min-h-11 text-sm`}>Try again</button>
                </div>
            )}

            <form noValidate onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5">
                <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="programme-preview-title" data-programme-preview>
                    <div className={ui.overviewHeader}>
                        <div>
                            <h2 id="programme-preview-title" className={`text-lg font-bold ${s.heading}`}>Programme at a glance</h2>
                            <p className={`mt-1 text-sm ${s.muted}`}>Your activities, dates and duration. Edit the details below, then save.</p>
                        </div>
                        <button type="submit" disabled={saving} className={s.secondaryButton}>
                            {saving ? "Saving…" : state.save.status === "failed" ? "Try again" : "Save programme"}
                        </button>
                    </div>
                    <div className="mt-4">
                        {plan
                            ? <ProgrammeOverview plan={plan} isDark={isDark} />
                            : <p className={`text-base ${s.muted}`} data-programme-empty>
                                {relative ? "Add how long the job takes to see a Day 1 onwards timeline." : "Add a weekday start date and how long the job takes to see the timeline."}
                            </p>}
                    </div>
                    {status === "unsaved" && plan && (
                        <p role="status" className={`mt-4 text-sm ${s.noticeBox}`}>Not saved yet. The proposal uses the programme you last saved.</p>
                    )}
                </section>

                {/* Start and length */}
                <section className={`${s.card} p-4 sm:p-6 space-y-5`} aria-labelledby="programme-when-title">
                    <div>
                        <h2 id="programme-when-title" className={`text-lg font-bold ${s.heading}`}>When does the job run?</h2>
                        <p className={`mt-1 text-sm ${s.muted}`}>
                            Use a target date when known, or show working days from Day 1 without agreeing a start date.
                        </p>
                    </div>

                    <div>
                        <label htmlFor="programme-time-basis" className={s.label}>Programme timing</label>
                        <select id="programme-time-basis" value={relative ? "relative" : "dated"} disabled={saving}
                            onChange={event => {
                                const chosenRelative = event.target.value === "relative";
                                store.dispatch({ type: "field/change", patch: { timeBasis: chosenRelative ? "relative" : undefined } });
                                onRelativeChange?.(chosenRelative);
                            }}
                            className={`${s.input} mt-1.5`}>
                            <option value="dated">Target start date known</option>
                            <option value="relative">Start date not known - Day 1 onwards</option>
                        </select>
                    </div>

                    <fieldset disabled={saving} className="min-w-0 border-0 m-0 p-0 space-y-2" aria-describedby="programme-working-days-note">
                        <legend className={s.label}>Working days for this job</legend>
                        <p id="programme-working-days-note" className={`text-sm ${s.muted}`}>Monday to Friday is the default. Include weekends only when this job works them. A week uses the selected working days. Review the dates, then save the programme; these choices are not saved just in this browser.</p>
                        {([6, 0] as const).map(day => (
                            <label key={day} className={`flex items-center gap-3 min-h-11 text-sm ${s.body}`}>
                                <input type="checkbox" id={`programme-weekend-${day}`}
                                    checked={resolveJobWorkingPattern(draft.workingPattern)?.weekdays.includes(day) ?? false}
                                    onChange={event => {
                                        const current = resolveJobWorkingPattern(draft.workingPattern);
                                        if (!current) return;
                                        const weekdays = event.target.checked ? [...new Set([...current.weekdays, day])].sort()
                                            : current.weekdays.filter(value => value !== day);
                                        store.dispatch({ type: "field/change", patch: { workingPattern: { version: 1, weekdays } } });
                                    }} />
                                {day === 6 ? "Work on Saturdays" : "Work on Sundays"}
                            </label>
                        ))}
                        {errorText("programme-working-days-error", fieldErrors.workingPattern)}
                    </fieldset>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-programme-timing>
                        {!relative && <div>
                            <label htmlFor="programme-start" className={s.label}>Start on site</label>
                            <input
                                id="programme-start"
                                type="date"
                                value={draft.startDate}
                                disabled={saving}
                                aria-invalid={fieldErrors.startDate ? true : undefined}
                                aria-describedby={fieldErrors.startDate ? "programme-start-error" : undefined}
                                onChange={(e) => store.dispatch({ type: "field/change", patch: { startDate: e.target.value } })}
                                className={`${s.input} mt-1.5`}
                            />
                            {errorText("programme-start-error", fieldErrors.startDate)}
                        </div>}

                        {staged ? (
                            <div>
                                <p className={s.label}>How long it takes</p>
                                <p className={`mt-1.5 min-h-12 flex items-center text-base ${s.body}`} data-programme-total>
                                    {plan ? `${plan.duration_label}, from your stages` : "Worked out from your stages"}
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="programme-duration" className={s.label}>How long it takes</label>
                                <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2" data-programme-duration>
                                    <input
                                        id="programme-duration"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        value={draft.duration}
                                        disabled={saving}
                                        aria-invalid={fieldErrors.duration ? true : undefined}
                                        aria-describedby={fieldErrors.duration ? "programme-duration-error" : undefined}
                                        onChange={(e) => store.dispatch({ type: "field/change", patch: { duration: e.target.value } })}
                                        placeholder="e.g. 3"
                                        className={s.input}
                                    />
                                    {unitSelect("programme-unit", draft.unit, (unit) => store.dispatch({ type: "field/change", patch: { unit } }), "Days or weeks")}
                                </div>
                                {errorText("programme-duration-error", fieldErrors.duration)}
                            </div>
                        )}
                    </div>

                    <p className={`text-base ${s.body}`} aria-live="polite" data-programme-finish>
                        {plan
                            ? <>Finishes <strong className={s.heading}>{plan.basis === RELATIVE_PROGRAMME_BASIS ? `Day ${plan.working_days}` : formatPlanDate(plan.end_date)}</strong> ({formatWorkingDuration(plan.working_days, draft.workingPattern)}).</>
                            : <span className={s.muted}>{relative ? "The finish day appears here once there is a valid length." : "The finish date appears here once there is a start date and a length."}</span>}
                    </p>
                    <p className={`text-sm ${s.muted}`}>{plan ? programmeBasisNote(plan) : relative ? RELATIVE_PROGRAMME_NOTE : PROGRAMME_BASIS_NOTE}</p>
                </section>

                {/* Stages */}
                <section className={`${s.card} p-4 sm:p-6 space-y-4`} aria-labelledby="programme-stages-title">
                    <div>
                        <h2 id="programme-stages-title" className={`text-lg font-bold ${s.heading}`}>Stages</h2>
                        <p className={`mt-1 text-sm ${s.muted}`}>
                            Optional. Add only the stages this job needs, up to {MAX_STAGES}, in your own words. They run one after another.
                        </p>
                    </div>

                    {!staged ? (
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => store.dispatch({ type: "stages/enable", keys: Array.from({ length: MIN_STAGES }, newClientId) })}
                            className={`${s.secondaryButton} w-full sm:w-auto`}
                        >
                            <Plus className="w-5 h-5" aria-hidden="true" /> Break the job into stages
                        </button>
                    ) : (
                        <>
                            <ol className="space-y-3">
                                {draft.stages.map((stage, index) => {
                                    const nameError = fieldErrors[stageNameField(stage.key)];
                                    const durationError = fieldErrors[stageDurationField(stage.key)];
                                    const label = stage.name.trim() || `stage ${index + 1}`;
                                    return (
                                        <li key={stage.key} className={`${s.inset} p-3 sm:p-4`} data-programme-stage>
                                            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3" data-programme-stage-fields>
                                                <div>
                                                    <label htmlFor={`stage-${stage.key}-name`} className={s.label}>Stage {index + 1}</label>
                                                    <input
                                                        id={`stage-${stage.key}-name`}
                                                        value={stage.name}
                                                        disabled={saving}
                                                        maxLength={80}
                                                        autoComplete="off"
                                                        aria-invalid={nameError ? true : undefined}
                                                        aria-describedby={nameError ? `stage-${stage.key}-name-error` : undefined}
                                                        onChange={(e) => store.dispatch({ type: "stage/change", key: stage.key, patch: { name: e.target.value } })}
                                                        placeholder="e.g. Strip out"
                                                        className={`${s.input} mt-1.5`}
                                                    />
                                                    {errorText(`stage-${stage.key}-name-error`, nameError)}
                                                    {stage.name === "" && estimateActivities.names.length > 0 && <ProgrammeEstimateActivity
                                                        key={estimateActivities.revision}
                                                        id={`stage-${stage.key}`}
                                                        names={estimateActivities.names}
                                                        disabled={state.save.status !== "idle"}
                                                        copy={name => copyProgrammeActivityName(store, state, stage.key, name, estimateActivities.names)}
                                                        s={s}
                                                    />}
                                                </div>
                                                <div>
                                                    <label htmlFor={`stage-${stage.key}-duration`} className={s.label}>How long</label>
                                                    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2" data-programme-duration>
                                                        <input
                                                            id={`stage-${stage.key}-duration`}
                                                            inputMode="numeric"
                                                            autoComplete="off"
                                                            value={stage.duration}
                                                            disabled={saving}
                                                            aria-invalid={durationError ? true : undefined}
                                                            aria-describedby={durationError ? `stage-${stage.key}-duration-error` : undefined}
                                                            onChange={(e) => store.dispatch({ type: "stage/change", key: stage.key, patch: { duration: e.target.value } })}
                                                            className={s.input}
                                                        />
                                                        {unitSelect(
                                                            `stage-${stage.key}-unit`,
                                                            stage.unit,
                                                            (unit) => store.dispatch({ type: "stage/change", key: stage.key, patch: { unit } }),
                                                            `Days or weeks for ${label}`,
                                                        )}
                                                    </div>
                                                    {errorText(`stage-${stage.key}-duration-error`, durationError)}
                                                </div>
                                            </div>
                                            <div className="mt-1 -ml-2 flex flex-wrap gap-1">
                                                <button
                                                    type="button"
                                                    disabled={saving || index === 0}
                                                    onClick={() => store.dispatch({ type: "stage/move", key: stage.key, direction: -1 })}
                                                    aria-label={`Move ${label} earlier`}
                                                    className={iconButton}
                                                >
                                                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={saving || index === draft.stages.length - 1}
                                                    onClick={() => store.dispatch({ type: "stage/move", key: stage.key, direction: 1 })}
                                                    aria-label={`Move ${label} later`}
                                                    className={iconButton}
                                                >
                                                    <ArrowDown className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    onClick={() => store.dispatch({ type: "stage/remove", key: stage.key })}
                                                    aria-label={`Remove ${label}`}
                                                    className={`${iconButton} px-2 gap-1.5 text-sm font-semibold`}
                                                >
                                                    <Trash2 className="w-4 h-4" aria-hidden="true" /> Remove
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>

                            <div className="flex flex-col sm:flex-row gap-2">
                                {draft.stages.length < MAX_STAGES && (
                                    <button
                                        type="button"
                                        disabled={saving}
                                        onClick={() => store.dispatch({ type: "stage/add", key: newClientId() })}
                                        className={`${s.secondaryButton} min-h-11 text-sm`}
                                    >
                                        <Plus className="w-4 h-4" aria-hidden="true" /> Add a stage
                                    </button>
                                )}
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => store.dispatch({ type: "stages/disable" })}
                                    className={s.quietButton}
                                >
                                    Show the job as one bar instead
                                </button>
                            </div>
                        </>
                    )}
                    {fieldErrors.stages && <p role="alert" className={`text-sm ${s.errorText}`}>{fieldErrors.stages}</p>}
                </section>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                    <button type="submit" disabled={saving} className={s.secondaryButton}>
                        {saving
                            ? <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Saving…</>
                            : state.save.status === "failed" ? "Try again" : "Save programme"}
                    </button>
                    <button type="button" onClick={handleNext} disabled={saving} className={s.primaryButton}>
                        Next: Proposal <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            </form>
        </>
    );
}
