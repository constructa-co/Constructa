import { describe, expect, it, vi } from "vitest";
import { bindProgrammeSave, expectedProgrammeFor } from "./programme-save-binding";
import { PROGRAMME_SAVE_BUSY_ERROR, PROGRAMME_SAVE_STALE_ERROR, type SimpleProgrammeInput } from "./simple-programme";

const input: SimpleProgrammeInput = { startDate: "2026-10-12", stages: [{ name: "Strip out", workingDays: 5, unit: "weeks", source: 0 }] };
const phases = [{ name: "Strip out", manualDays: 5, startOffset: 0 }];

function harness(send = vi.fn(), over: { busy?: boolean; current?: Record<string, unknown> } = {}) {
    const events = { adopted: [] as unknown[], saving: [] as boolean[], stale: 0 };
    const save = bindProgrammeSave({
        current: () => (over.current ?? { programme_phases: phases, start_date: "2026-10-12", updated_at: "t1" }) as never,
        send, adopt: c => events.adopted.push(c), isBusy: () => over.busy ?? false,
        setSaving: s => events.saving.push(s), onStale: () => { events.stale++; },
    });
    return { save, events };
}

describe("an ordinary programme save bound to the last confirmed snapshot", () => {
    it("sends the confirmed phases, start date and updated_at with the stages", async () => {
        const send = vi.fn().mockResolvedValue({ success: true });
        await harness(send).save(input);
        expect(send).toHaveBeenCalledWith({ ...input, expectedProgramme: { programme_phases: phases, start_date: "2026-10-12", updated_at: "t1" } });
    });

    it("leaves updated_at out when the job does not report one, and nulls absent fields", () => {
        expect(expectedProgrammeFor({})).toEqual({ programme_phases: null, start_date: null });
    });

    it("adopts the snapshot a successful save confirms, and marks itself in flight only while sending", async () => {
        const confirmed = { programme_phases: [...phases, { name: "Added" }], start_date: "2026-10-12", updated_at: "t2" };
        const { save, events } = harness(vi.fn().mockResolvedValue({ success: true, confirmedProject: confirmed }));
        expect(await save(input)).toMatchObject({ success: true });
        expect(events.adopted).toEqual([confirmed]);
        expect(events.saving).toEqual([true, false]);
    });

    it("is refused without sending while an add is being sent", async () => {
        const send = vi.fn();
        const { save, events } = harness(send, { busy: true });
        expect(await save(input)).toEqual({ success: false, error: PROGRAMME_SAVE_BUSY_ERROR });
        expect(send).not.toHaveBeenCalled();
        expect(events.saving).toEqual([]);
    });

    it("reports a stale refusal honestly: nothing saved, typing kept, a reload offered", async () => {
        const { save, events } = harness(vi.fn().mockResolvedValue({ success: false, error: "Reload the programme, then add the stage again.", stale: true }));
        expect(await save(input)).toEqual({ success: false, error: PROGRAMME_SAVE_STALE_ERROR, stale: true });
        expect(PROGRAMME_SAVE_STALE_ERROR).toMatch(/nothing was saved/);
        expect(PROGRAMME_SAVE_STALE_ERROR).not.toMatch(/nothing was added|add the stage/);
        expect(events.stale).toBe(1);
        expect(events.adopted).toEqual([]);
        expect(events.saving).toEqual([true, false]);
    });

    it("passes other failures through unchanged and clears its in-flight mark", async () => {
        const { save, events } = harness(vi.fn().mockRejectedValue(new Error("offline")));
        await expect(save(input)).rejects.toThrow("offline");
        expect(events.saving).toEqual([true, false]);
    });
});
