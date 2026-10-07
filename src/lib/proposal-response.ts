import { z } from "zod";

/**
 * How a client can respond to a published proposal.
 *
 * A new proposal asks for one of two things, chosen by the contractor each
 * time they send:
 *  - acknowledgement: the client confirms they have received it;
 *  - non-binding intent: the client says they intend to go ahead, subject to
 *    a final contract.
 *
 * Neither is acceptance and neither creates a contract. Binding acceptance
 * is not offered. It is recognised here only so that proposals published
 * before this change still read exactly as they were sent.
 *
 * Every surface that words the response (the send screen, the snapshot, the
 * public page, the emails and the PDF) takes its wording from this module.
 */

export type ProposalResponseKind = "acknowledgement" | "non_binding_intent";
/** What a publication may carry, including those published before this change. */
export type RecordedResponseKind = ProposalResponseKind | "binding_acceptance";

export const DEFAULT_RESPONSE_KIND: ProposalResponseKind = "acknowledgement";
export const RESPONSE_KINDS: readonly ProposalResponseKind[] = ["acknowledgement", "non_binding_intent"];

export function isProposalResponseKind(value: unknown): value is ProposalResponseKind {
    return value === "acknowledgement" || value === "non_binding_intent";
}

export interface ResponseWording {
    /** The choice as the contractor sees it on the send screen. */
    optionLabel: string;
    optionHelp: string;
    /** The response block on the public proposal and in the PDF. */
    heading: string;
    /** The statement of what responding does and does not mean. Frozen into the snapshot. */
    notice: string;
    actionLabel: string;
    /** After the client has responded. */
    recordedHeading: string;
    recordedNoun: string;
    /** In the email that delivers the proposal. */
    emailInvite: string;
    /** In the receipt emails and the contractor's history. */
    receiptLabel: string;
    receiptExplanation: string;
    /** The line the client signs against in the PDF. */
    pdfSignatureLabel: string;
}

const WORDING: Record<RecordedResponseKind, ResponseWording> = {
    acknowledgement: {
        optionLabel: "Ask the client to confirm they have received it",
        optionHelp: "The client confirms receipt only. It is not acceptance and does not create a contract.",
        heading: "Confirm you have received this proposal",
        notice: "Confirming receipt tells the contractor that this proposal has reached you. It is not acceptance of the proposal and does not create a contract.",
        actionLabel: "Confirm receipt",
        recordedHeading: "Receipt confirmed",
        recordedNoun: "confirmation of receipt",
        emailInvite: "and confirm that you have received it. Confirming receipt is not acceptance and does not create a contract",
        receiptLabel: "Receipt confirmed",
        receiptExplanation: "This records that the client received the proposal. It is not acceptance of the proposal and does not create a contract.",
        pdfSignatureLabel: "Client: receipt confirmed",
    },
    non_binding_intent: {
        optionLabel: "Ask the client whether they intend to go ahead",
        optionHelp: "The client can say they intend to proceed. It is not binding and is subject to a final contract and terms being agreed.",
        heading: "Tell us you intend to go ahead",
        notice: "Saying you intend to proceed is not binding on you or the contractor. It is not acceptance of the proposal and does not create a contract. Any work is subject to a final contract and terms being agreed between you.",
        actionLabel: "I intend to proceed (not binding)",
        recordedHeading: "Intention to proceed recorded",
        recordedNoun: "non-binding intention to proceed",
        emailInvite: "and tell us whether you intend to go ahead. Saying you intend to proceed is not binding and is subject to a final contract and terms being agreed",
        receiptLabel: "Intention to proceed (not binding)",
        receiptExplanation: "This records that the client intends to proceed. It is not binding, it is not acceptance of the proposal and it does not create a contract. Any work is subject to a final contract and terms being agreed.",
        pdfSignatureLabel: "Client: intention to proceed (not binding)",
    },
    // Proposals published before this change only. Never offered for a new send.
    binding_acceptance: {
        optionLabel: "",
        optionHelp: "",
        heading: "Acceptance",
        notice: "This proposal was published asking for acceptance of the scope of works, price and terms set out in it.",
        actionLabel: "",
        recordedHeading: "Proposal accepted",
        recordedNoun: "acceptance",
        emailInvite: "",
        receiptLabel: "Proposal accepted",
        receiptExplanation: "This records the client's acceptance of the published proposal.",
        pdfSignatureLabel: "For and on behalf of the client",
    },
};

export function responseWording(kind: RecordedResponseKind): ResponseWording {
    return WORDING[kind];
}

/**
 * What a publication asked the client for. Publications from before this
 * change carry only a response mode, which is read as it was written.
 */
export function responseKindOfSnapshot(snapshot: {
    publication: { response_mode?: string | null };
    response?: { kind?: string | null } | null;
}): RecordedResponseKind {
    if (isProposalResponseKind(snapshot.response?.kind)) return snapshot.response.kind;
    return snapshot.publication.response_mode === "binding_acceptance" ? "binding_acceptance" : "acknowledgement";
}

/** The statement shown to the client: the one frozen at publication when there is one. */
export function responseNoticeOfSnapshot(snapshot: Parameters<typeof responseKindOfSnapshot>[0] & {
    response?: { notice?: string | null } | null;
}): string {
    const frozen = snapshot.response?.notice;
    return typeof frozen === "string" && frozen.trim() ? frozen : WORDING[responseKindOfSnapshot(snapshot)].notice;
}

export type RecordedResponseStatus = "acknowledged" | "accepted" | "declined";

/**
 * What a recorded response means, for receipts and the contractor's history.
 * An accepted or declined response is historical and is reported as recorded.
 */
export function describeRecordedResponse(
    status: RecordedResponseStatus,
    kind: RecordedResponseKind,
): { label: string; explanation: string } {
    if (status === "accepted") {
        return { label: WORDING.binding_acceptance.receiptLabel, explanation: WORDING.binding_acceptance.receiptExplanation };
    }
    if (status === "declined") {
        return { label: "Proposal declined", explanation: "This records that the client declined the published proposal." };
    }
    const wording = WORDING[kind === "non_binding_intent" ? "non_binding_intent" : "acknowledgement"];
    return { label: wording.receiptLabel, explanation: wording.receiptExplanation };
}

// ── Public response form ─────────────────────────────────────────────────────

const ProposalResponseInput = z.object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    clientName: z.string().trim().min(2).max(200).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    clientEmail: z.union([
        z.literal(""),
        z.string().trim().email().max(320).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    ]),
});

export type ProposalResponseInput = z.infer<typeof ProposalResponseInput>;

/**
 * The public form sends a name and an optional email only. What the response
 * means is fixed by the publication, never chosen by the browser.
 */
export function parseProposalResponseInput(input: unknown) {
    return ProposalResponseInput.safeParse(input);
}
