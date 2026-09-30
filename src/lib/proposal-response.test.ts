import { describe, expect, it } from "vitest";
import { parseProposalResponseInput } from "./proposal-response";

const valid = {
    token: "a".repeat(64),
    response: "acknowledged",
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
        { ...valid, response: "won" },
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
