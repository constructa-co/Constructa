/**
 * Simple programme.
 *
 * The default programme screen: a start date and how long the job takes,
 * with the option of up to six named stages that run one after another.
 * This module holds the rules and state for that screen as plain functions:
 *
 *  - every date comes from `computeProgrammePlan` in `programme-plan.ts`;
 *  - phases already saved on the project are mapped in when they fit this
 *    shape and are otherwise left alone for the detailed planner;
 *  - saving keeps the fields the detailed planner and live tracking use;
 *  - a failed save keeps what was typed and can be retried.
 */

import {
    parseIsoDate,
    phaseWorkingDays,
    resolveProgrammeSource,
} from "./programme-plan";
import {
    addJobWorkingDays, isJobWorkingDay, nextJobWorkingDayAfter, programmeWeekUnitCount,
    resolveJobWorkingPattern, isDefaultJobWorkingPattern, explainWorkingPatternDraft, validateWorkingPatternForProgramme,
    isJobWorkingPatternV2, type JobWorkingPattern,
} from "./job-working-pattern";
import { canonicalWorkingPatternComparable, workingPatternsEquivalent } from "./working-pattern-canonical";
import { computeDisplayProgramme, computeRelativeProgramme, hasRelativeProgramme, RELATIVE_PROGRAMME_BASIS, type DisplayProgrammePlan } from "./relative-programme";

export const MIN_STAGES = 1;
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
    workingPattern?: JobWorkingPattern;
    /** Absent on existing dated drafts. Relative is always an explicit choice. */
    timeBasis?: "relative";
    startDate: string;
    /** Length of the whole job. Used only while there are no stages. */
    duration: string;
    unit: DurationUnit;
    stages: StageDraft[];
    /** The saved phase the whole-job bar came from, and its name. */
    wholeSource: number | null;
    wholeName: string | null;
}

export function emptyProgrammeDraft(startDate = "", workingPattern?: JobWorkingPattern): ProgrammeDraft {
    return { startDate, duration: "", unit: "weeks", stages: [], wholeSource: null, wholeName: null, ...(workingPattern ? { workingPattern } : {}) };
}

function durationFields(workingDays: number, savedUnit: unknown, pattern: JobWorkingPattern): { duration: string; unit: DurationUnit } {
    const weekUnits = programmeWeekUnitCount(pattern);
    const wholeWeeks = workingDays % weekUnits === 0;
    const wantsDays = typeof savedUnit === "string" && savedUnit.toLowerCase() === "days";
    return wholeWeeks && !wantsDays
        ? { duration: String(workingDays / weekUnits), unit: "weeks" }
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
    programme_working_pattern?: unknown;
    start_date?: string | null;
    programme_phases?: unknown[] | null;
    gantt_phases?: unknown[] | null;
}

export type SimpleProgrammeView =
    | { kind: "simple"; draft: ProgrammeDraft; hasSaved: boolean }
    | {
        kind: "detailed";
        /** The saved programme as the proposal would show it. */
        plan: DisplayProgrammePlan | null;
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

/** Where the plan draws a saved phase: its calendar offset, rolled on to a working day. */
function placedStart(startDate: string, offset: number, pattern: JobWorkingPattern): string | null {
    const start = parseIsoDate(startDate);
    if (start === null || !Number.isInteger(offset) || offset < 0) return null;
    const placed = new Date(start + offset * 86_400_000);
    return Number.isFinite(placed.getTime()) ? addJobWorkingDays(placed.toISOString().slice(0, 10), 1, pattern) : null;
}

/**
 * True when saved phases are a start date and stages that run back to back.
 * A weekend start, such as one the Brief has since moved to, is read as the
 * plan reads it, from the next working day. The date itself is not changed;
 * it still has to be corrected to a weekday before the programme is saved.
 */
function fitsSimpleShape(startDate: string, phases: unknown[], pattern: JobWorkingPattern): boolean {
    const firstDay = addJobWorkingDays(startDate, 1, pattern);
    if (!firstDay) return false;
    const weekendStart = firstDay !== startDate;
    if (phases.length !== 1 && (phases.length < MIN_STAGES || phases.length > MAX_STAGES)) return false;

    let cursor: string | null = firstDay;
    for (const entry of phases) {
        const phase = asRecord(entry);
        const workingDays = phaseWorkingDays(phase);
        if (typeof phase.name !== "string" || !phase.name.trim() || workingDays < 1 || hasLiveOrLinkedData(phase)) return false;
        if (cursor === null) return false;
        const offset = Number(phase.startOffset ?? 0);
        if (weekendStart ? placedStart(startDate, offset, pattern) !== cursor : offset !== calendarOffset(startDate, cursor)) return false;
        const end = addJobWorkingDays(cursor, workingDays, pattern);
        cursor = end ? nextJobWorkingDayAfter(end, pattern) : null;
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
    const pattern = resolveJobWorkingPattern(project.programme_working_pattern);
    if (!pattern) return { kind: "detailed", plan: null, origin: "programme", reason: "Check this job's saved working days before editing its programme.", canStartSimple: false, startDate };
    const blank = emptyProgrammeDraft(startDate, project.programme_working_pattern == null ? undefined : pattern);

    if (source.origin === "none") {
        return { kind: "simple", draft: blank, hasSaved: false };
    }
    if (source.origin === "legacy_timeline") {
        return {
            kind: "detailed",
            plan: computeDisplayProgramme(project.start_date, source.phases, pattern),
            origin: "legacy_timeline",
            reason: LEGACY_TIMELINE_REASON,
            canStartSimple: true,
            startDate,
        };
    }
    const relative = hasRelativeProgramme(source.phases);
    const fits = relative
        ? source.phases.length <= MAX_STAGES && computeRelativeProgramme(source.phases, pattern) !== null
        : fitsSimpleShape(startDate, source.phases, pattern);
    if (!fits) {
        return {
            kind: "detailed",
            plan: computeDisplayProgramme(project.start_date, source.phases, pattern),
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
                ...blank,
                ...(relative ? { timeBasis: "relative" as const } : {}),
                ...durationFields(phaseWorkingDays(phases[0]), phases[0].duration_unit, pattern),
                wholeSource: 0,
                wholeName: String(phases[0].name).trim(),
            },
        };
    }
    return {
        kind: "simple",
        hasSaved: true,
        draft: {
            ...blank,
            ...(relative ? { timeBasis: "relative" as const } : {}),
            stages: phases.map((phase, index) => ({
                key: makeKey(),
                name: String(phase.name).trim(),
                ...durationFields(phaseWorkingDays(phase), phase.duration_unit, pattern),
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
    workingPattern?: JobWorkingPattern;
    /** Bound to the last confirmed job pattern, not an inferred current browser setting. */
    expectedWorkingPattern?: JobWorkingPattern | null;
    timeBasis?: "relative";
    startDate: string;
    stages: SimpleProgrammeStageInput[];
}

export type ProgrammeFieldErrors = Record<string, string>;

export const stageNameField = (key: string) => `stage:${key}:name`;
export const stageDurationField = (key: string) => `stage:${key}:duration`;

function parseDuration(raw: string, unit: DurationUnit, pattern: JobWorkingPattern): { days: number } | { error: string } {
    const cleaned = raw.trim();
    if (!/^\d{1,4}$/.test(cleaned)) return { error: "Enter a whole number, for example 3." };
    const value = Number(cleaned);
    if (value < 1) return { error: "Enter 1 or more." };
    const days = unit === "weeks" ? value * programmeWeekUnitCount(pattern) : value;
    if (days > MAX_WORKING_DAYS) return { error: "That is too long. Keep it under 10 years." };
    return { days };
}

export type BuildProgrammeResult =
    | { ok: true; input: SimpleProgrammeInput }
    | { ok: false; fieldErrors: ProgrammeFieldErrors };

export function validateStartDate(startDate: string, workingPattern?: unknown): string | null {
    const pattern = resolveJobWorkingPattern(workingPattern);
    if (!pattern) return "Choose valid working days for this job.";
    if (!startDate.trim()) return "Choose the date you start on site.";
    if (parseIsoDate(startDate) === null) return "Enter a real date.";
    if (!isJobWorkingDay(startDate, pattern)) return isDefaultJobWorkingPattern(pattern)
        ? "Choose a weekday. The programme counts Monday to Friday." : "Choose one of this job's working days.";
    return null;
}

function programmeDaysUpperBound(draft: ProgrammeDraft): number {
    if (draft.stages.length === 0) {
        const parsed = /^\d{1,4}$/.test(draft.duration.trim()) ? Number(draft.duration.trim()) : 60;
        return draft.unit === "weeks" ? parsed * 7 : parsed;
    }
    let total = 0;
    for (const stage of draft.stages) {
        const cleaned = stage.duration.trim();
        if (/^\d{1,4}$/.test(cleaned)) total += stage.unit === "weeks" ? Number(cleaned) * 7 : Number(cleaned);
    }
    return total || 60;
}

export function buildSimpleProgramme(draft: ProgrammeDraft): BuildProgrammeResult {
    const fieldErrors: ProgrammeFieldErrors = {};
    const pattern = resolveJobWorkingPattern(draft.workingPattern);
    if (!pattern) {
        const message = explainWorkingPatternDraft(draft.workingPattern, draft.startDate.trim() || "2026-01-05")
            ?? "Choose valid working days for this job.";
        return { ok: false, fieldErrors: { workingPattern: message } };
    }
    if (isJobWorkingPatternV2(pattern) && draft.timeBasis !== "relative") {
        const scheduleStart = draft.startDate.trim() || "2026-01-05";
        Object.assign(fieldErrors, validateWorkingPatternForProgramme(pattern, scheduleStart, programmeDaysUpperBound(draft)));
    }
    const startError = draft.timeBasis === "relative" ? null : validateStartDate(draft.startDate, pattern);
    if (startError) fieldErrors.startDate = startError;

    const stages: SimpleProgrammeStageInput[] = [];
    if (draft.stages.length === 0) {
        // A preserved dated name can exceed the relative renderer's limit.
        if (draft.timeBasis === "relative" && (draft.wholeName || WHOLE_JOB_NAME).trim().length > MAX_STAGE_NAME_LENGTH) {
            fieldErrors.stages = `To use an undated programme, break the job into stages and shorten this name to ${MAX_STAGE_NAME_LENGTH} characters.`;
        }
        const parsed = parseDuration(draft.duration, draft.unit, pattern);
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
            const parsed = parseDuration(stage.duration, stage.unit, pattern);
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
    return { ok: true, input: draft.timeBasis === "relative"
        ? { timeBasis: "relative", startDate: "", stages, ...(draft.workingPattern ? { workingPattern: pattern } : {}) }
        : { startDate: draft.startDate.trim(), stages, ...(draft.workingPattern ? { workingPattern: pattern } : {}) } };
}

/**
 * The phases to store for a simple programme. Stages run one after another
 * from the start date. Fields the detailed planner and live tracking keep on
 * a phase (colour, man-hours, progress) are carried over from the phase a
 * stage came from; everything else about that phase is replaced.
 */
export function buildProgrammePhases(input: SimpleProgrammeInput, existingPhases: unknown[] | null | undefined): Record<string, unknown>[] {
    const pattern = resolveJobWorkingPattern(input.workingPattern);
    if (!pattern) throw new Error("Choose valid working days for this job.");
    const existing = Array.isArray(existingPhases) ? existingPhases : [];
    let cursor: string | null = input.startDate;
    let workingOffset = 0;

    return input.stages.map((stage) => {
        const base = { ...(stage.source !== null ? asRecord(existing[stage.source]) : {}) };
        // A stage in a simple programme is placed by its order alone.
        delete base.start_date;
        delete base.duration_days;
        delete base.dependsOn;
        delete base.timeBasis;
        delete base.workingDayOffset;
        delete base.startOffset;

        const start = cursor ?? input.startDate;
        const calculated = Number(base.calculatedDays);
        const phase = {
            ...base,
            name: stage.name,
            calculatedDays: Number.isInteger(calculated) && calculated > 0 ? calculated : stage.workingDays,
            manualDays: stage.workingDays,
            manhours: Number.isFinite(Number(base.manhours)) && Number(base.manhours) > 0 ? Number(base.manhours) : 0,
            ...(input.timeBasis === "relative"
                ? { timeBasis: RELATIVE_PROGRAMME_BASIS, workingDayOffset: workingOffset }
                : { startOffset: calendarOffset(input.startDate, start) }),
            duration_unit: stage.unit === "weeks" ? "Weeks" : "Days",
        };
        const end = addJobWorkingDays(start, stage.workingDays, pattern);
        cursor = end ? nextJobWorkingDayAfter(end, pattern) : null;
        workingOffset += stage.workingDays;
        return phase;
    });
}

/**
 * The programme the draft describes, for the live preview. Null until there
 * is a weekday start and at least one usable duration. Unnamed stages are
 * shown by position so the bars appear while names are still being typed.
 */
export function draftPlan(draft: ProgrammeDraft): DisplayProgrammePlan | null {
    const pattern = resolveJobWorkingPattern(draft.workingPattern);
    if (!pattern || (draft.timeBasis !== "relative" && validateStartDate(draft.startDate, pattern))) return null;
    const rows = draft.stages.length === 0
        ? [{ name: draft.wholeName || WHOLE_JOB_NAME, duration: draft.duration, unit: draft.unit }]
        : draft.stages.map((stage, index) => ({ name: stage.name.trim() || `Stage ${index + 1}`, duration: stage.duration, unit: stage.unit }));

    const stages: SimpleProgrammeStageInput[] = [];
    for (const row of rows) {
        const parsed = parseDuration(row.duration, row.unit, pattern);
        if ("error" in parsed) return null;
        stages.push({ name: row.name, workingDays: parsed.days, unit: row.unit, source: null });
    }
    if (stages.reduce((sum, stage) => sum + stage.workingDays, 0) > MAX_WORKING_DAYS) return null;
    return computeDisplayProgramme(draft.startDate, buildProgrammePhases({ timeBasis: draft.timeBasis, startDate: draft.startDate, stages, workingPattern: pattern }, []), pattern);
}

// ── State ────────────────────────────────────────────────────────────────────

export const PROGRAMME_SAVE_ERROR =
    "The programme couldn't be saved. Nothing you typed has been lost. Check your connection and try again.";

export const PROGRAMME_NAVIGATION_ERROR =
    "The proposal couldn't be opened. Your last save is still on record. If you have made newer edits, they are not saved yet. Try Next: Proposal again.";

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
    | { type: "field/change"; patch: Partial<Pick<ProgrammeDraft, "workingPattern" | "timeBasis" | "startDate" | "duration" | "unit">> }
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

        case "stages/enable": {
            if (draft.stages.length > 0) return state;
            const stages = action.keys.slice(0, MIN_STAGES).map(blankStage);
            if (draft.wholeSource !== null && stages[0]) {
                stages[0] = { ...stages[0], name: draft.wholeName || WHOLE_JOB_NAME, duration: draft.duration, unit: draft.unit, source: draft.wholeSource };
            }
            return edited(state, { ...draft, stages });
        }

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

const comparable = (draft: ProgrammeDraft) => JSON.stringify([canonicalWorkingPatternComparable(draft.workingPattern ?? null), draft.stages.length === 0
    ? [draft.timeBasis ?? "dated", draft.timeBasis === "relative" ? "" : draft.startDate.trim(), draft.duration.trim(), draft.unit]
    : [draft.timeBasis ?? "dated", draft.timeBasis === "relative" ? "" : draft.startDate.trim(), draft.stages.map((stage) => [stage.name.trim(), stage.duration.trim(), stage.unit])]]);

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

export type ProgrammeSaveResult = { success: true; confirmedProject?: ProgrammeProjectFields } | { success: false; error: string };
export type SaveProgramme = (input: SimpleProgrammeInput) => Promise<ProgrammeSaveResult>;
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
        const result = await save(built.input.workingPattern ? {
            ...built.input, expectedWorkingPattern: state.saved.workingPattern ?? null,
        } : built.input);
        if (result.success) {
            if (built.input.workingPattern && (result.confirmedProject?.programme_working_pattern == null
                || !workingPatternsEquivalent(result.confirmedProject.programme_working_pattern, built.input.workingPattern))) {
                store.dispatch({ type: "save/failed", error: "The working-day save wasn't confirmed. Reload Programme before retrying." });
                return "failed";
            }
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
    navigate: () => void | Promise<void>,
): Promise<"navigated" | "navigation-failed" | ProgrammeSaveOutcome> {
    if (!isProgrammeSaved(store.getState())) {
        const outcome = await saveProgramme(store, save);
        if (outcome !== "saved") return outcome;
        if (!isProgrammeSaved(store.getState())) return "busy";
    }
    try {
        await navigate();
    } catch {
        return "navigation-failed";
    }
    return "navigated";
}

export function proposalPathForProject(projectId: string): string {
    return `/dashboard/projects/proposal?projectId=${encodeURIComponent(projectId)}`;
}
