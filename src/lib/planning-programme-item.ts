/**
 * A063: adds one planning item the contractor has confirmed to the programme.
 *
 * The conversation itself never writes. When the contractor chooses "Add to
 * programme" for a suggestion, they type the stage name and how long it takes;
 * nothing is read out of the model's reply or its free-text timing. The stage
 * is then added to the SAVED simple programme and saved through the same
 * reducer, validation and `SaveProgramme` the programme's Save button uses, so
 * the server's own checks (owner, pre-contract lock, working days, optimistic
 * match with the stored phases) apply unchanged. The save also carries the copy
 * of the programme (phases, start date, updated_at) the new stage list was built
 * from; the server re-reads the job and refuses a stale copy instead of
 * replacing a newer edit, and the page then asks for a reload. This module holds no database
 * or network code: the only write is the `save` it is handed.
 *
 * Stages in the simple programme run one after another, so an item added here
 * lengthens the programme by its duration. Overlapping items belong in the
 * detailed planner.
 */
import { readProgrammeInclusion } from "./programme-inclusion";
import {
    MAX_STAGES,
    PROGRAMME_STALE_ERROR,
    initialProgrammeState,
    programmeReducer,
    saveProgramme,
    stageDurationField,
    stageNameField,
    viewForProject,
    type DurationUnit,
    type ExpectedProgramme,
    type ProgrammeProjectFields,
    type ProgrammeState,
    type ProgrammeStore,
    type SaveProgramme,
} from "./simple-programme";

export interface PlanningProgrammeItem {
    /** The contractor's own stage name; the suggestion title is only where it starts. */
    name: string;
    /** A whole number typed by the contractor. Never taken from the reply. */
    duration: string;
    unit: DurationUnit;
}

/** `stale`: the stored programme changed after this page loaded. Nothing was written; the page should be reloaded. */
export type AddPlanningItemResult = { ok: true; name: string } | { ok: false; error: string; stale?: true };

export const PLANNING_ADD_OMITTED = "The programme is left out of the proposal, so nothing can be added to it. Include it first.";
export const PLANNING_ADD_UNREADABLE = "Check the saved programme before adding to it. Nothing has been changed.";
export const PLANNING_ADD_DETAILED = "This programme is changed in the detailed planner, so add this item there. Nothing has been changed.";
export const PLANNING_ADD_NO_PROGRAMME = "Save a programme first. Items are added to a saved programme. Nothing has been changed.";
export const PLANNING_ADD_FULL = `The programme already has ${MAX_STAGES} stages, the most this view holds. Nothing has been changed.`;
export const PLANNING_ADD_DUPLICATE = "A stage with that name is already in the programme. Choose a different name. Nothing has been changed.";
export const PLANNING_ADD_NAME = "Give the stage a name.";

const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();

type Eligible = { ok: true; state: ProgrammeState } | { ok: false; error: string };

/** The saved programme as the simple editor would open it, or why an item cannot be added. */
function openSavedProgramme(project: ProgrammeProjectFields, makeKey: () => string): Eligible {
    const inclusion = readProgrammeInclusion(project.programme_phases);
    if (inclusion.intent === "invalid") return { ok: false, error: PLANNING_ADD_UNREADABLE };
    if (inclusion.intent === "omit") return { ok: false, error: PLANNING_ADD_OMITTED };
    const view = viewForProject({ ...project, programme_phases: inclusion.phases }, makeKey);
    if (view.kind !== "simple") return { ok: false, error: PLANNING_ADD_DETAILED };
    if (!view.hasSaved) return { ok: false, error: PLANNING_ADD_NO_PROGRAMME };
    return { ok: true, state: initialProgrammeState(view.draft, true) };
}

/** Null when an item can be added to this job's saved programme; otherwise the reason, in the contractor's terms. */
export function planningAddBlockReason(project: ProgrammeProjectFields): string | null {
    const opened = openSavedProgramme(project, () => "check");
    if (!opened.ok) return opened.error;
    const stages = opened.state.draft.stages.length;
    // A one-bar programme becomes stage one when an item is added.
    return Math.max(stages, 1) >= MAX_STAGES ? PLANNING_ADD_FULL : null;
}

/**
 * Adds the confirmed item as the last stage of the saved programme and saves
 * it. Nothing is saved unless every check passes; a refused or failed save
 * leaves the stored programme exactly as it was.
 */
export async function addPlanningItemToProgramme(input: {
    project: ProgrammeProjectFields;
    item: PlanningProgrammeItem;
    save: SaveProgramme;
    makeKey: () => string;
}): Promise<AddPlanningItemResult> {
    const { project, item, save, makeKey } = input;
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (!name) return { ok: false, error: PLANNING_ADD_NAME };
    const opened = openSavedProgramme(project, makeKey);
    if (!opened.ok) return opened;
    let state = opened.state;
    const reduce = (action: Parameters<typeof programmeReducer>[1]) => { state = programmeReducer(state, action); };

    if (state.draft.stages.length === 0) reduce({ type: "stages/enable", keys: [makeKey()] });
    if (state.draft.stages.length >= MAX_STAGES) return { ok: false, error: PLANNING_ADD_FULL };
    if (state.draft.stages.some(stage => sameName(stage.name, name))) return { ok: false, error: PLANNING_ADD_DUPLICATE };

    const key = makeKey();
    reduce({ type: "stage/add", key });
    reduce({ type: "stage/change", key, patch: { name, duration: item.duration, unit: item.unit === "days" ? "days" : "weeks" } });

    // The new stage list was worked out from this copy of the saved programme.
    // The server re-reads the job and refuses it if the stored programme (or its
    // updated_at) is no longer the same, rather than replacing someone's edit.
    const expectedProgramme: ExpectedProgramme = {
        programme_phases: project.programme_phases ?? null,
        start_date: project.start_date ?? null,
        ...(project.updated_at !== undefined ? { updated_at: project.updated_at } : {}),
    };
    let stale = false;
    const guardedSave: SaveProgramme = async input => {
        const result = await save({ ...input, expectedProgramme });
        if (!result.success && result.stale) stale = true;
        return result;
    };

    const store: ProgrammeStore = { getState: () => state, dispatch: reduce };
    const outcome = await saveProgramme(store, guardedSave);
    if (outcome === "saved") return { ok: true, name };
    if (stale) return { ok: false, error: PROGRAMME_STALE_ERROR, stale: true };

    const errors = state.fieldErrors;
    const message = errors[stageNameField(key)] ?? errors[stageDurationField(key)]
        ?? (outcome === "invalid" ? Object.values(errors)[0] : undefined) ?? state.save.error
        ?? "The programme couldn't be saved. Nothing has been changed.";
    return { ok: false, error: message };
}
