import { describe, expect, it } from "vitest";
import {
    DEFAULT_RESPONSE_KIND,
    RESPONSE_KINDS,
    describeRecordedResponse,
    isProposalResponseKind,
    parseProposalResponseInput,
    responseKindOfSnapshot,
    responseNoticeOfSnapshot,
    responseWording,
} from "./proposal-response";

const valid = {
    token: "a".repeat(64),
    clientName: "Alex Client",
    clientEmail: "alex@example.com",
};

describe("public proposal response input", () => {
    it("normalizes valid public form fields", () => {
        const parsed = parseProposalResponseInput({
            ...valid,
            clientName: "  Alex Client  ",
            clientEmail: "  alex@example.com  ",
        });

        expect(parsed.success).toBe(true);
        if (parsed.success) {
            expect(parsed.data.clientName).toBe("Alex Client");
            expect(parsed.data.clientEmail).toBe("alex@example.com");
        }
    });

    it.each([
        { ...valid, token: "short" },
        { ...valid, clientName: "A" },
        { ...valid, clientName: "Alex\r\nBcc: attacker@example.com" },
        { ...valid, clientEmail: "not-an-email" },
        { ...valid, clientEmail: `a@${"b".repeat(320)}.com` },
    ])("rejects malformed or hostile input", (input) => {
        expect(parseProposalResponseInput(input).success).toBe(false);
    });

    it("allows a blank optional receipt email", () => {
        expect(parseProposalResponseInput({ ...valid, clientEmail: "" }).success).toBe(true);
    });
});

describe("response kinds", () => {
    it("defaults to acknowledgement of receipt", () => {
        expect(DEFAULT_RESPONSE_KIND).toBe("acknowledgement");
    });

    it("offers exactly two kinds for a new send, and binding acceptance is not one of them", () => {
        expect(RESPONSE_KINDS).toEqual(["acknowledgement", "non_binding_intent"]);
        expect(isProposalResponseKind("binding_acceptance")).toBe(false);
        expect(isProposalResponseKind("accepted")).toBe(false);
        expect(isProposalResponseKind(undefined)).toBe(false);
        for (const kind of RESPONSE_KINDS) {
            const wording = responseWording(kind);
            expect(wording.optionLabel).not.toBe("");
            expect(wording.actionLabel).not.toBe("");
            expect(`${wording.optionLabel} ${wording.actionLabel} ${wording.heading}`.toLowerCase()).not.toContain("accept");
        }
    });

    it("says on every surface that acknowledgement is not acceptance", () => {
        const wording = responseWording("acknowledgement");
        for (const text of [wording.optionHelp, wording.notice, wording.emailInvite, wording.receiptExplanation]) {
            expect(text).toMatch(/not acceptance/);
            expect(text).toMatch(/does not create a contract/);
        }
    });

    it("says on every surface that intention to proceed is not binding and is subject to a final contract and terms", () => {
        const wording = responseWording("non_binding_intent");
        for (const text of [wording.optionHelp, wording.notice, wording.emailInvite, wording.receiptExplanation]) {
            expect(text).toMatch(/not binding/);
            expect(text).toMatch(/subject to a final contract and terms/);
        }
        expect(wording.actionLabel).toBe("I intend to proceed (not binding)");
        expect(wording.pdfSignatureLabel).toContain("not binding");
        expect(wording.receiptLabel).toContain("not binding");
    });

    it("reads what a publication asked for, including those from before this change", () => {
        expect(responseKindOfSnapshot({ publication: { response_mode: "acknowledgement" }, response: { kind: "non_binding_intent" } })).toBe("non_binding_intent");
        expect(responseKindOfSnapshot({ publication: { response_mode: "acknowledgement" } })).toBe("acknowledgement");
        expect(responseKindOfSnapshot({ publication: { response_mode: "binding_acceptance" } })).toBe("binding_acceptance");
        // A snapshot cannot talk its way into acceptance through the newer field.
        expect(responseKindOfSnapshot({ publication: { response_mode: "acknowledgement" }, response: { kind: "binding_acceptance" } })).toBe("acknowledgement");
    });

    it("prefers the statement frozen in the publication", () => {
        expect(responseNoticeOfSnapshot({ publication: { response_mode: "acknowledgement" }, response: { kind: "acknowledgement", notice: "As sent." } })).toBe("As sent.");
        expect(responseNoticeOfSnapshot({ publication: { response_mode: "acknowledgement" } })).toBe(responseWording("acknowledgement").notice);
    });

    it("describes a recorded response by what was asked, and leaves historical acceptances as they were", () => {
        expect(describeRecordedResponse("acknowledged", "acknowledgement").label).toBe("Receipt confirmed");
        expect(describeRecordedResponse("acknowledged", "non_binding_intent").label).toBe("Intention to proceed (not binding)");
        expect(describeRecordedResponse("accepted", "binding_acceptance")).toEqual({
            label: "Proposal accepted",
            explanation: "This records the client's acceptance of the published proposal.",
        });
        expect(describeRecordedResponse("declined", "binding_acceptance").label).toBe("Proposal declined");
        // An acknowledgement is never upgraded to acceptance by the publication's kind.
        expect(describeRecordedResponse("acknowledged", "binding_acceptance").label).toBe("Receipt confirmed");
    });

    it("takes no response type from the public form", () => {
        const parsed = parseProposalResponseInput({ ...valid, response: "accepted" });
        expect(parsed.success).toBe(true);
        if (parsed.success) expect(parsed.data).not.toHaveProperty("response");
    });
});
