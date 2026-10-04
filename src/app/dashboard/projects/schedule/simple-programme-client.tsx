"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import ProgrammeTimeline from "@/components/programme-timeline";
import SaveStatus from "@/components/save-status";
import { newClientId } from "@/lib/client-id";
import { isCapabilityEnabled } from "@/lib/launch-profile";
import { formatPlanDate, formatWorkingDuration, PROGRAMME_BASIS_NOTE } from "@/lib/programme-plan";
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
import { workspaceStyles, type WorkspaceStyles } from "@/lib/workspace-styles";
import { saveSimpleProgrammeAction } from "./simple-actions";

// The drag-and-drop planner is only downloaded when it is opened.
const DetailedPlanner = dynamic(() => import("./client-page"), {
    ssr: false,
    loading: () => <p className="p-4 text-sm text-slate-300">Loading the detailed planner…</p>,
});

interface ProgrammeProject {
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
    /** The active estimate with lines, used only by the detailed planner. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    estimate: any;
    /** Defaults to the real server action; replaced only by tests and evidence capture. */
    save?: SaveProgramme;
}

export default function SimpleProgrammeClient({ project, lockReason, estimate, save }: Props) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const s = workspaceStyles(isDark);
    const router = useRouter();
    const [refreshing, startRefresh] = useTransition();

    const [detailedOpen, setDetailedOpen] = useState(false);
    const [startedSimple, setStartedSimple] = useState(false);

    // Keys for saved stages are positional so the first render matches on the
    // server and in the browser.
    const view = useMemo(() => {
        let n = 0;
        return viewForProject(project, () => `saved-${n++}`);
    }, [project]);
    const showExtended = isCapabilityEnabled("extended-modules");

    // The detailed planner saves as it goes. Closing it reloads the project so
    // the simple view shows what the planner left behind.
    const toggleDetailed = () => {
        if (detailedOpen) startRefresh(() => router.refresh());
        setDetailedOpen((open) => !open);
    };

    const detailedSection = (
        <section className={s.card} aria-labelledby="detailed-planner-title">
            <button
                type="button"
                onClick={toggleDetailed}
                aria-expanded={detailedOpen}
                aria-controls="detailed-planner"
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

            {detailedOpen && (
                <div id="detailed-planner" className="px-3 sm:px-5 pb-5 space-y-4">
                    <p className={`text-sm ${s.muted}`}>
                        The simple programme is hidden while this is open. Changes here save as you make them. Close the planner to go back.
                        This workspace is laid out for a wide screen.
                    </p>
                    <p className={`text-sm ${s.muted}`}>
                        The planner lays stages out on a grid of whole weeks. The proposal states dates by working days, Monday to Friday,
                        so its finish date can be a few days earlier than the planner&apos;s summary. Close the planner to see the programme as the proposal shows it.
                    </p>
                    {view.kind === "simple" && !view.hasSaved && (
                        <p role="note" className={`text-sm ${s.noticeBox}`}>
                            This job has no programme yet. The planner starts one from the sections of your estimate, with a
                            placeholder length for any section it cannot work out, and saves it. Check every length before you send.
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
        <div className="space-y-5">
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
                    {lockReason ? (
                        <ReadOnlyProgramme project={project} view={view} note={lockReason} s={s} isDark={isDark} />
                    ) : view.kind === "simple" || startedSimple ? (
                        <ProgrammeEditor
                            project={project}
                            initial={view.kind === "simple" ? view : { kind: "simple", draft: emptyProgrammeDraft(view.startDate), hasSaved: false }}
                            save={save ?? ((input) => saveSimpleProgrammeAction(project.id, input))}
                            s={s}
                            isDark={isDark}
                        />
                    ) : (
                        <ReadOnlyProgramme
                            project={project}
                            view={view}
                            note={view.reason}
                            s={s}
                            isDark={isDark}
                            onStartSimple={view.canStartSimple ? () => setStartedSimple(true) : undefined}
                            onOpenDetailed={view.origin === "programme" ? toggleDetailed : undefined}
                        />
                    )}
                    {!lockReason && detailedSection}
                </>
            )}
        </div>
    );
}

function Heading({ project, s, children }: { project: ProgrammeProject; s: WorkspaceStyles; children?: React.ReactNode }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <h1 className={`text-2xl sm:text-3xl font-bold break-words ${s.heading}`}>Programme</h1>
                <p className={`mt-1 text-base break-words ${s.muted}`}>
                    {project.name}{project.client_name ? ` for ${project.client_name}` : ""}
                </p>
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
                        ? <ProgrammeTimeline plan={plan} tone={isDark ? "dark" : "light"} />
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
    project, initial, save, s, isDark,
}: {
    project: ProgrammeProject;
    initial: { kind: "simple"; draft: ProgrammeDraft; hasSaved: boolean };
    save: SaveProgramme;
    s: WorkspaceStyles;
    isDark: boolean;
}) {
    const router = useRouter();
    const [state, store] = useReducerStore(programmeReducer, () => initialProgrammeState(initial.draft, initial.hasSaved));
    const [leaving, setLeaving] = useState(false);
    const { draft, fieldErrors } = state;
    const status = programmeSaveStatus(state);
    const saving = state.save.status === "saving";
    const staged = draft.stages.length > 0;
    const plan = useMemo(() => draftPlan(draft), [draft]);
    const alertRef = useRef<HTMLDivElement>(null);

    useUnsavedGuard(
        !leaving && (status === "unsaved" || status === "failed" || status === "saving"),
        "Your programme has changes that are not saved yet.\n\nPress Cancel to stay here and save them, or OK to leave without saving.",
    );

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
                {/* Start and length */}
                <section className={`${s.card} p-4 sm:p-6 space-y-5`} aria-labelledby="programme-when-title">
                    <div>
                        <h2 id="programme-when-title" className={`text-lg font-bold ${s.heading}`}>When does the job run?</h2>
                        <p className={`mt-1 text-sm ${s.muted}`}>
                            A start date and how long it takes is enough. Every proposal shows this programme.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
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
                        </div>

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
                                <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
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
                            ? <>Finishes <strong className={s.heading}>{formatPlanDate(plan.end_date)}</strong> ({formatWorkingDuration(plan.working_days)}).</>
                            : <span className={s.muted}>The finish date appears here once there is a start date and a length.</span>}
                    </p>
                    <p className={`text-sm ${s.muted}`}>{PROGRAMME_BASIS_NOTE}</p>
                </section>

                {/* Stages */}
                <section className={`${s.card} p-4 sm:p-6 space-y-4`} aria-labelledby="programme-stages-title">
                    <div>
                        <h2 id="programme-stages-title" className={`text-lg font-bold ${s.heading}`}>Stages</h2>
                        <p className={`mt-1 text-sm ${s.muted}`}>
                            Optional. Break the job into {MIN_STAGES} to {MAX_STAGES} stages in your own words. They run one after another.
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
                                            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
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
                                                </div>
                                                <div>
                                                    <label htmlFor={`stage-${stage.key}-duration`} className={s.label}>How long</label>
                                                    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
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

                            {fieldErrors.stages && <p role="alert" className={`text-sm ${s.errorText}`}>{fieldErrors.stages}</p>}

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
                </section>

                {/* Preview */}
                <section className={`${s.card} p-4 sm:p-6`} aria-labelledby="programme-preview-title">
                    <h2 id="programme-preview-title" className={`text-lg font-bold ${s.heading}`}>How it looks on the proposal</h2>
                    <div className="mt-4">
                        {plan
                            ? <ProgrammeTimeline plan={plan} tone={isDark ? "dark" : "light"} />
                            : <p className={`text-base ${s.muted}`} data-programme-empty>
                                Add a weekday start date and how long the job takes to see the timeline.
                            </p>}
                    </div>
                    {status === "unsaved" && plan && (
                        <p role="status" className={`mt-4 text-sm ${s.noticeBox}`}>Not saved yet. The proposal uses the programme you last saved.</p>
                    )}
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
