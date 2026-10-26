import { describe, expect, it, vi } from "vitest";
import { proposalPaymentSave } from "./proposal-payment-save";
import { buildProposalPayload, draftFromProject } from "./proposal-review";

const stages = [{ id: "one", stage: "Agreed milestone", description: "As agreed", percentage: 40 }];
function payload() {
    const built = buildProposalPayload(draftFromProject({ id: "job", name: "Job", payment_schedule: stages }, () => "key"));
    if (!built.ok) throw Error("Invalid fixture");
    return built.payload;
}

describe("proposal editor payment compare-and-set baseline", () => {
    it("uses the original mounted source, then the acknowledged stages for the next save", async () => {
        const source = structuredClone(stages), action = vi.fn().mockResolvedValue({ success: true });
        const save = proposalPaymentSave(source, action), first = payload();
        source[0].percentage = 80;
        first.paymentSchedule![0].percentage = 55;
        await save(first);
        first.paymentSchedule![0].percentage = 90;
        await save(payload());
        expect(action.mock.calls[0][1]).toEqual(stages);
        expect(action.mock.calls[1][1]).toEqual([{ ...stages[0], percentage: 55 }]);
    });
    it.each(["refusal", "throw"])("does not advance the saved baseline after %s", async outcome => {
        const action = vi.fn();
        if (outcome === "throw") action.mockRejectedValueOnce(Error("Transport"));
        else action.mockResolvedValueOnce({ success: false, error: "Changed elsewhere" });
        action.mockResolvedValueOnce({ success: true });
        const save = proposalPaymentSave(null, action);
        try { await save(payload()); } catch { /* The existing controller handles transport failure. */ }
        await save(payload());
        expect(action.mock.calls.map(call => call[1])).toEqual([null, null]);
    });
    it("keeps legacy fixed amounts as the source when the proposal payload does not write payments", async () => {
        const fixed = [{ stage: "Existing fixed", amount: 250 }], action = vi.fn().mockResolvedValue({ success: true });
        const save = proposalPaymentSave(fixed, action);
        await save({ ...payload(), paymentSchedule: null });
        await save({ ...payload(), paymentSchedule: null });
        expect(action.mock.calls.map(call => call[1])).toEqual([fixed, fixed]);
    });
});
