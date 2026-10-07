/**
 * Simple programme.
 *
 * The default programme screen: a start date and how long the job takes,
 * with the option of three to six named stages that run one after another.
 * This module holds the rules and state for that screen as plain functions:
 *
 *  - every date comes from `computeProgrammePlan` in `programme-plan.ts`;
 *  - phases already saved on the project are mapped in when they fit this
 *    shape and are otherwise left alone for the detailed planner;
 *  - saving keeps the fields the detailed planner and live tracking use;
 *  - a failed save keeps what was typed and can be retried.
 */

import {
    WORKING_DAYS_PER_WEEK,
    addWorkingDays,
    computeProgrammePlan,
    isWorkingDay,
    nextWorkingDayAfter,
    parseIsoDate,
    phaseWorkingDays,
    resolveProgrammeSource,
    type ProgrammePlan,
} from "./programme-plan";

export const MIN_STAGES = 3;
export const MAX_STAGES = 6;
export const MAX_WORKING_DAYS = 2600; // ten years of working weeks
export const MAX_STAGE_NAME_LENGTH = 80;
/** The name given to the single bar of a programme with no stages. */
export const WHOLE_JOB_NAME = "Works on site";

export type DurationUnit = "days" | "weeks";

// ── Draft ────────────────────────────────────────────────────────────────────

export interface StageDraft {
    /** Stable within the page; never saved. */
    key: string;
    name: string;
    duration: string;
    unit: DurationUnit;
    /** Index of the saved phase this stage came from, so its other fields are kept. */
    source: number | null;
}

export interface ProgrammeDraft {
    startDate: string;
    /** Length of the whole job. Used only while there are no stages. */
    duration: string;
    unit: DurationUnit;
    stages: StageDraft[];
    /** The saved phase the whole-job bar came from, and its name. */
    wholeSource: number | null;
    wholeName: string | null;
}

export function emptyProgrammeDraft(startDate = ""): ProgrammeDraft {
    return { startDate, duration: "", unit: "weeks", stages: [], wholeSource: null, wholeName: null };
}

function durationFields(workingDays: number, savedUnit: unknown): { duration: string; unit: DurationUnit } {
    const wholeWeeks = workingDays % WORKING_DAYS_PER_WEEK === 0;
    const wantsDays = typeof savedUnit === "string" && savedUnit.toLowerCase() === "days";
    return wholeWeeks && !wantsDays
        ? { duration: String(workingDays / WORKING_DAYS_PER_WEEK), unit: "weeks" }
        : { duration: String(workingDays), unit: "days" };
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function calendarOffset(fromIso: string, toIso: string): number {
    return Math.round(((parseIsoDate(toIso) ?? 0) - (parseIsoDate(fromIso) ?? 0)) / 86_400_000);
}

// ── Mapping saved phases into the simple view ────────────────────────────────

export interface ProgrammeProjectFields {
    start_date?: string | null;
    programme_phases?: unknown[] | null;
    gantt_phases?: unknown[] | null;
}

export type SimpleProgrammeView =
    | { kind: "simple"; draft: ProgrammeDraft; hasSaved: boolean }
    | {
        kind: "detailed";
        /** The saved programme as the proposal would show it. */
        plan: ProgrammePlan | null;
        origin: "programme" | "legacy_timeline";
        reason: string;
        /** A simple programme can be started without touching the saved phases. */
        canStartSimple: boolean;
        startDate: string;
    };

export const DETAILED_REASON =
    "This programme was built in the detailed planner. It has overlapping stages, gaps, dependencies or progress recorded against it, so it is changed there.";
export const LEGACY_TIMELINE_REASON =
    "This timeline was set up in the earlier proposal editor. You can keep it, or start a simple programme here.";

function hasLiveOrLinkedData(phase: Record<string, unknown>): boolean {
    return Number(phase.pct_complete) > 0
        || (typeof phase.actual_start_date === "string" && phase.actual_start_date !== "")
        || (typeof phase.actual_finish_date === "string" && phase.actual_finish_date !== "")
        || (Array.isArray(phase.dependsOn) && phase.dependsOn.length > 0)
        || (typeof phase.start_date === "string" && phase.start_date !== "");
}

/** True when saved phases are a start date and stages that run back to back. */
function fitsSimpleShape(startDate: string, phases: unknown[]): boolean {
    if (!isWorkingDay(startDate)) return false;
    if (phases.length !== 1 && (phases.length < MIN_STAGES || phases.length > MAX_STAGES)) return false;

    let cursor: string | null = startDate;
    for (const entry of phases) {
        const phase = asRecord(entry);
        const workingDays = phaseWorkingDays(phase);
        if (typeof phase.name !== "string" || !phase.name.trim() || workingDays < 1 || hasLiveOrLinkedData(phase)) return false;
        if (cursor === null || Number(phase.startOffset ?? 0) !== calendarOffset(startDate, cursor)) return false;
        const end = addWorkingDays(cursor, workingDays);
        cursor = end ? nextWorkingDayAfter(end) : null;
    }
    return true;
}

/**
 * Opens a project's programme in the simple view when it fits, and as a
 * read-only summary pointing at the detailed planner when it does not.
 */
export function viewForProject(project: ProgrammeProjectFields, makeKey: () => string): SimpleProgrammeView {
    const startDate = parseIsoDate(project.start_date) !== null ? String(project.start_date).slice(0, 10) : "";
    const source = resolveProgrammeSource(project);

    if (source.origin === "none") {
        return { kind: "simple", draft: emptyProgrammeDraft(startDate), hasSaved: false };
    }
    if (source.origin === "legacy_timeline") {
        return {
            kind: "detailed",
            plan: computeProgrammePlan(project.start_date, source.phases),
            origin: "legacy_timeline",
            reason: LEGACY_TIMELINE_REASON,
            canStartSimple: true,
            startDate,
        };
    }
    if (!fitsSimpleShape(startDate, source.phases)) {
        return {
            kind: "detailed",
            plan: computeProgrammePlan(project.start_date, source.phases),
            origin: "programme",
            reason: DETAILED_REASON,
            canStartSimple: false,
            startDate,
        };
    }

    const phases = source.phases.map(asRecord);
    if (phases.length === 1) {
        return {
            kind: "simple",
            hasSaved: true,
            draft: {
                ...emptyProgrammeDraft(startDate),
                ...durationFields(phaseWorkingDays(phases[0]), phases[0].duration_unit),
                wholeSource: 0,
                wholeName: String(phases[0].name).trim(),
            },
        };
    }
    return {
        kind: "simple",
        hasSaved: true,
        draft: {
            ...emptyProgrammeDraft(startDate),
            stages: phases.map((phase, index) => ({
                key: makeKey(),
                name: String(phase.name).trim(),
                ...durationFields(phaseWorkingDays(phase), phase.duration_unit),
                source: index,
            })),
        },
    };
}

// ── Validation and the save payload ──────────────────────────────────────────

export interface SimpleProgrammeStageInput {
    name: string;
    workingDays: number;
    unit: DurationUnit;
    source: number | null;
}

/** What is sent to the server. One stage means one bar for the whole job. */
export interface SimpleProgrammeInput {
    startDate: string;
    stages: SimpleProgrammeStageInput[];
}

export type ProgrammeFieldErrors = Record<string, string>;

export const stageNameField = (key: string) => `stage:${key}:name`;
export const stageDurationField = (key: string) => `stage:${key}:duration`;

function parseDuration(raw: string, unit: DurationUnit): { days: number } | { error: string } {
    const cleaned = raw.trim();
    if (!/^\d{1,4}$/.test(cleaned)) return { error: "Enter a whole number, for example 3." };
    const value = Number(cleaned);
    if (value < 1) return { error: "Enter 1 or more." };
    const days = unit === "weeks" ? value * WORKING_DAYS_PER_WEEK : value;
    if (days > MAX_WORKING_DAYS) return { error: "That is too long. Keep it under 10 years." };
    return { days };
}

export type BuildProgrammeResult =
    | { ok: true; input: SimpleProgrammeInput }
    | { ok: false; fieldErrors: ProgrammeFieldErrors };

export function validateStartDate(startDate: string): string | null {
    if (!startDate.trim()) return "Choose the date you start on site.";
    if (parseIsoDate(startDate) === null) return "Enter a real date.";
    if (!isWorkingDay(startDate)) return "Choose a weekday. The programme counts Monday to Friday.";
    return null;
}

export function buildSimpleProgramme(draft: ProgrammeDraft): BuildProgrammeResult {
    const fieldErrors: ProgrammeFieldErrors = {};
    const startError = validateStartDate(draft.startDate);
    if (startError) fieldErrors.startDate = startError;

    const stages: SimpleProgrammeStageInput[] = [];
    if (draft.stages.length === 0) {
        const parsed = parseDuration(draft.duration, draft.unit);
        if ("error" in parsed) fieldErrors.duration = draft.duration.trim() ? parsed.error : "Say how long the job takes.";
        else stages.push({ name: draft.wholeName || WHOLE_JOB_NAME, workingDays: parsed.days, unit: draft.unit, source: draft.wholeSource });
    } else {
        if (draft.stages.length < MIN_STAGES || draft.stages.length > MAX_STAGES) {
            fieldErrors.stages = `Use between ${MIN_STAGES} and ${MAX_STAGES} stages, or remove them all to show the job as one bar.`;
        }
        let total = 0;
        for (const stage of draft.stages) {
            const name = stage.name.trim();
            if (!name) fieldErrors[stageNameField(stage.key)] = "Give this stage a name.";
            else if (name.length > MAX_STAGE_NAME_LENGTH) fieldErrors[stageNameField(stage.key)] = `Keep the name under ${MAX_STAGE_NAME_LENGTH} characters.`;
            const parsed = parseDuration(stage.duration, stage.unit);
            if ("error" in parsed) {
                fieldErrors[stageDurationField(stage.key)] = stage.duration.trim() ? parsed.error : "Say how long this stage takes.";
                continue;
            }
            total += parsed.days;
            stages.push({ name, workingDays: parsed.days, unit: stage.unit, source: stage.source });
        }
        if (total > MAX_WORKING_DAYS) fieldErrors.stages = "The stages add up to more than 10 years.";
    }

    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    return { ok: true, input: { startDate: draft.startDate.trim(), stages } };
}

/**
 * The phases to store for a simple programme. Stages run one after another
 * from the start date. Fields the detailed planner and live tracking keep on
 * a phase (colour, man-hours, progress) are carried over from the phase a
 * stage came from; everything else about that phase is replaced.
 */
export function buildProgrammePhases(input: SimpleProgrammeInput, existingPhases: unknown[] | null | undefined): Record<string, unknown>[] {
    const existing = Array.isArray(existingPhases) ? existingPhases : [];
    let cursor: string | null = input.startDate;

    return input.stages.map((stage) => {
        const base = { ...(stage.source !== null ? asRecord(existing[stage.source]) : {}) };
        // A stage in a simple programme is placed by its order alone.
        delete base.start_date;
        delete base.duration_days;
        delete base.dependsOn;

        const start = cursor ?? input.startDate;
        const calculated = Number(base.calculatedDays);
        const phase = {
            ...base,
            name: stage.name,
            calculatedDays: Number.isInteger(calculated) && calculated > 0 ? calculated : stage.workingDays,
            manualDays: stage.workingDays,
            manhours: Number.isFinite(Number(base.manhours)) && Number(base.manhours) > 0 ? Number(base.manhours) : 0,
            startOffset: calendarOffset(input.startDate, start),
            duration_unit: stage.unit === "weeks" ? "Weeks" : "Days",
        };
        const end = addWorkingDays(start, stage.workingDays);
        cursor = end ? nextWorkingDayAfter(end) : null;
        return phase;
    });
}

/**
 * The programme the draft describes, for the live preview. Null until there
 * is a weekday start and at least one usable duration. Unnamed stages are
 * shown by position so the bars appear while names are still being typed.
 */
export function draftPlan(draft: ProgrammeDraft): ProgrammePlan | null {
    if (validateStartDate(draft.startDate)) return null;
    const rows = draft.stages.length === 0
        ? [{ name: draft.wholeName || WHOLE_JOB_NAME, duration: draft.duration, unit: draft.unit }]
        : draft.stages.map((stage, index) => ({ name: stage.name.trim() || `Stage ${index + 1}`, duration: stage.duration, unit: stage.unit }));

    const stages: SimpleProgrammeStageInput[] = [];
    for (const row of rows) {
        const parsed = parseDuration(row.duration, row.unit);
        if ("error" in parsed) return null;
        stages.push({ name: row.name, workingDays: parsed.days, unit: row.unit, source: null });
    }
    if (stages.reduce((sum, stage) => sum + stage.workingDays, 0) > MAX_WORKING_DAYS) return null;
    return computeProgrammePlan(draft.startDate, buildProgrammePhases({ startDate: draft.startDate, stages }, []));
}

// ── State ────────────────────────────────────────────────────────────────────

export const PROGRAMME_SAVE_ERROR =
    "The programme couldn't be saved. Nothing you typed has been lost. Check your connection and try again.";

export interface ProgrammeState {
    draft: ProgrammeDraft;
    /** The draft as the server last confirmed it. */
    saved: ProgrammeDraft;
    hasSaved: boolean;
    save: { status: "idle" | "saving" | "failed"; error: string | null };
    fieldErrors: ProgrammeFieldErrors;
}

export function initialProgrammeState(draft: ProgrammeDraft, hasSaved: boolean): ProgrammeState {
    return { draft, saved: draft, hasSaved, save: { status: "idle", error: null }, fieldErrors: {} };
}

export type ProgrammeAction =
    | { type: "field/change"; patch: Partial<Pick<ProgrammeDraft, "startDate" | "duration" | "unit">> }
    | { type: "stages/enable"; keys: string[] }
    | { type: "stages/disable" }
    | { type: "stage/add"; key: string }
    | { type: "stage/remove"; key: string }
    | { type: "stage/change"; key: string; patch: Partial<Pick<StageDraft, "name" | "duration" | "unit">> }
    | { type: "stage/move"; key: string; direction: 1 | -1 }
    | { type: "save/started" }
    | { type: "save/succeeded"; snapshot: ProgrammeDraft }
    | { type: "save/failed"; error: string; fieldErrors?: ProgrammeFieldErrors };

const blankStage = (key: string): StageDraft => ({ key, name: "", duration: "", unit: "weeks", source: null });

/** Editing clears the failure message; the next save reports afresh. */
function edited(state: ProgrammeState, draft: ProgrammeDraft): ProgrammeState {
    return { ...state, draft, fieldErrors: {}, save: state.save.status === "failed" ? { status: "idle", error: null } : state.save };
}

export function programmeReducer(state: ProgrammeState, action: ProgrammeAction): ProgrammeState {
    const { draft } = state;
    switch (action.type) {
        case "field/change":
            return edited(state, { ...draft, ...action.patch });

        case "stages/enable":
            if (draft.stages.length > 0) return state;
            return edited(state, { ...draft, stages: action.keys.slice(0, MIN_STAGES).map(blankStage) });

        case "stages/disable":
            return edited(state, { ...draft, stages: [] });

        case "stage/add":
            if (draft.stages.length >= MAX_STAGES) return state;
            return edited(state, { ...draft, stages: [...draft.stages, blankStage(action.key)] });

        case "stage/remove":
            return edited(state, { ...draft, stages: draft.stages.filter((stage) => stage.key !== action.key) });

        case "stage/change":
            return edited(state, {
                ...draft,
                stages: draft.stages.map((stage) => (stage.key === action.key ? { ...stage, ...action.patch } : stage)),
            });

        case "stage/move": {
            const from = draft.stages.findIndex((stage) => stage.key === action.key);
            const to = from + action.direction;
            if (from < 0 || to < 0 || to >= draft.stages.length) return state;
            const stages = [...draft.stages];
            [stages[from], stages[to]] = [stages[to], stages[from]];
            return edited(state, { ...draft, stages });
        }

        case "save/started":
            if (state.save.status === "saving") return state;
            return { ...state, save: { status: "saving", error: null }, fieldErrors: {} };

        case "save/succeeded": {
            // What was saved now sits on the project in this order, so each
            // stage that was part of the save points at its own saved phase.
            const savedIndex = new Map(action.snapshot.stages.map((stage, index) => [stage.key, index]));
            const relink = (d: ProgrammeDraft): ProgrammeDraft => ({
                ...d,
                wholeSource: d.stages.length === 0 && action.snapshot.stages.length === 0 ? 0 : null,
                wholeName: action.snapshot.stages.length === 0 ? d.wholeName : null,
                stages: d.stages.map((stage) => ({ ...stage, source: savedIndex.get(stage.key) ?? null })),
            });
            return {
                ...state,
                draft: relink(draft),
                saved: relink(action.snapshot),
                hasSaved: true,
                save: { status: "idle", error: null },
            };
        }

        case "save/failed":
            return { ...state, save: { status: "failed", error: action.error }, fieldErrors: action.fieldErrors ?? {} };
    }
}

// ── Derived save status ──────────────────────────────────────────────────────

const comparable = (draft: ProgrammeDraft) => JSON.stringify(draft.stages.length === 0
    ? [draft.startDate.trim(), draft.duration.trim(), draft.unit]
    : [draft.startDate.trim(), draft.stages.map((stage) => [stage.name.trim(), stage.duration.trim(), stage.unit])]);

export function isProgrammeDirty(state: ProgrammeState): boolean {
    return comparable(state.draft) !== comparable(state.saved);
}

export type ProgrammeSaveStatus = "empty" | "unsaved" | "saving" | "saved" | "failed";

export function programmeSaveStatus(state: ProgrammeState): ProgrammeSaveStatus {
    if (state.save.status === "saving") return "saving";
    if (state.save.status === "failed") return "failed";
    if (isProgrammeDirty(state)) return "unsaved";
    return state.hasSaved ? "saved" : "empty";
}

export const PROGRAMME_STATUS_LABEL: Record<ProgrammeSaveStatus, string> = {
    empty: "Nothing to save yet",
    unsaved: "Unsaved",
    saving: "Saving",
    saved: "Saved",
    failed: "Failed - try again",
};

/** True only when the server holds exactly the programme on screen. */
export function isProgrammeSaved(state: ProgrammeState): boolean {
    return state.save.status === "idle" && state.hasSaved && !isProgrammeDirty(state);
}

// ── Controllers ──────────────────────────────────────────────────────────────

export interface ProgrammeStore {
    getState: () => ProgrammeState;
    dispatch: (action: ProgrammeAction) => void;
}

export type SaveProgramme = (input: SimpleProgrammeInput) => Promise<{ success: true } | { success: false; error: string }>;
export type ProgrammeSaveOutcome = "saved" | "failed" | "invalid" | "busy";

/** Saves the programme as it stands. A failed save never clears the draft. */
export async function saveProgramme(store: ProgrammeStore, save: SaveProgramme): Promise<ProgrammeSaveOutcome> {
    const state = store.getState();
    if (state.save.status === "saving") return "busy";

    const built = buildSimpleProgramme(state.draft);
    if (!built.ok) {
        store.dispatch({ type: "save/failed", error: "Fix the highlighted details, then save.", fieldErrors: built.fieldErrors });
        return "invalid";
    }

    const snapshot = state.draft;
    store.dispatch({ type: "save/started" });
    try {
        const result = await save(built.input);
        if (result.success) {
            store.dispatch({ type: "save/succeeded", snapshot });
            return "saved";
        }
        store.dispatch({ type: "save/failed", error: result.error || PROGRAMME_SAVE_ERROR });
        return "failed";
    } catch {
        store.dispatch({ type: "save/failed", error: PROGRAMME_SAVE_ERROR });
        return "failed";
    }
}

/**
 * "Next: Proposal". The proposal is opened only when the server holds the
 * programme on screen. Anything unsaved is saved first; if that does not
 * succeed the contractor stays here with what they typed.
 */
export async function continueToProposal(
    store: ProgrammeStore,
    save: SaveProgramme,
    navigate: () => void,
): Promise<"navigated" | ProgrammeSaveOutcome> {
    if (!isProgrammeSaved(store.getState())) {
        const outcome = await saveProgramme(store, save);
        if (outcome !== "saved") return outcome;
        if (!isProgrammeSaved(store.getState())) return "busy";
    }
    navigate();
    return "navigated";
}

export function proposalPathForProject(projectId: string): string {
    return `/dashboard/projects/proposal?projectId=${encodeURIComponent(projectId)}`;
}
