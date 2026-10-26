import type { ProposalDraftPayload, SaveProposalDraft } from "./proposal-review";

/** Keep the mounted editor's payment baseline until a save is confirmed. */
export function proposalPaymentSave(initial: unknown[] | null,
    save: (payload: ProposalDraftPayload, expected: unknown[] | null) => ReturnType<SaveProposalDraft>,
): SaveProposalDraft {
    let expected = structuredClone(initial);
    return async payload => {
        const result = await save(payload, structuredClone(expected));
        if (result.success && payload.paymentSchedule !== null) expected = structuredClone(payload.paymentSchedule);
        return result;
    };
}
