/**
 * Guards the Programme page's ordinary Save while a confirmed planning item may
 * be added. The save itself is bound to the stored programme the editor's draft
 * was opened from (see `ProgrammeState.opened`, sent by `saveProgramme`), so a
 * stage list worked out before another change cannot replace that change: the
 * server re-reads the job and refuses a save whose snapshot no longer matches.
 * This wrapper never substitutes a newer snapshot. It only refuses to send
 * while an add or another save is in flight, hands a successful save's
 * confirmed snapshot to the page, and reports a stale refusal honestly. No
 * database or network code lives here: the only write is the `send` it is
 * handed.
 */
import {
    PROGRAMME_SAVE_BUSY_ERROR,
    PROGRAMME_SAVE_STALE_ERROR,
    expectedProgrammeFor,
    type ProgrammeProjectFields,
    type SaveProgramme,
} from "./simple-programme";

export { expectedProgrammeFor };

export function bindProgrammeSave(options: {
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
            const result = await options.send(input);
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
