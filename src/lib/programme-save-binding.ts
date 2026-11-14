/**
 * Binds the Programme page's ordinary Save to the programme the page last
 * confirmed, so a stage list worked out before another change (such as a
 * confirmed planning item being added) cannot replace that change. The server
 * re-reads the job and refuses a save whose snapshot no longer matches; a
 * successful save hands back the snapshot it produced and the page adopts it,
 * so the next save is bound to what is stored now. No database or network code
 * lives here: the only write is the `send` it is handed.
 */
import {
    PROGRAMME_SAVE_BUSY_ERROR,
    PROGRAMME_SAVE_STALE_ERROR,
    type ExpectedProgramme,
    type ProgrammeProjectFields,
    type SaveProgramme,
} from "./simple-programme";

export function expectedProgrammeFor(project: ProgrammeProjectFields): ExpectedProgramme {
    return {
        programme_phases: project.programme_phases ?? null,
        start_date: project.start_date ?? null,
        ...(project.updated_at !== undefined ? { updated_at: project.updated_at } : {}),
    };
}

export function bindProgrammeSave(options: {
    /** The programme this page last confirmed, read when the save starts. */
    current: () => ProgrammeProjectFields;
    send: SaveProgramme;
    /** Called with the snapshot a successful save produced. */
    adopt: (confirmed: ProgrammeProjectFields) => void;
    /** True while an add or another save is being sent; read synchronously, from a ref, not from render state. */
    isBusy: () => boolean;
    /** Marks this save as in flight, synchronously, so an add can see it. */
    setSaving: (saving: boolean) => void;
    /** The stored programme moved on; nothing was written. */
    onStale: () => void;
}): SaveProgramme {
    return async input => {
        if (options.isBusy()) return { success: false, error: PROGRAMME_SAVE_BUSY_ERROR };
        options.setSaving(true);
        try {
            const result = await options.send({ ...input, expectedProgramme: expectedProgrammeFor(options.current()) });
            if (result.success) {
                if (result.confirmedProject) options.adopt(result.confirmedProject);
                return result;
            }
            if (result.stale) {
                options.onStale();
                return { success: false, error: PROGRAMME_SAVE_STALE_ERROR, stale: true };
            }
            return result;
        } finally {
            options.setSaving(false);
        }
    };
}
