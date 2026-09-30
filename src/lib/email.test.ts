import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProposalResponseReceiptContent } from "./email";

const base = {
    recipientKind: "client" as const,
    clientName: "Alex Client",
    projectName: "Rear Extension",
    companyName: "Example Construction",
    respondedAt: "2026-09-30T10:30:00.000Z",
    refCode: "20000000-V2",
    publicationVersion: 2,
    snapshotReference: "abcdef1234567890",
};

describe("proposal response receipts", () => {
    it("states that acknowledgement is not contract acceptance", () => {
        const receipt = buildProposalResponseReceiptContent({
            ...base,
            response: "acknowledged",
        });

        expect(receipt.subject).toBe("Receipt acknowledged — Rear Extension");
        expect(receipt.html).toContain("It is not contract acceptance.");
        expect(receipt.html).toContain("Version 2");
        expect(receipt.html).toContain("abcdef123456");
    });

    it("uses explicit acceptance wording only for binding acceptance", () => {
        const receipt = buildProposalResponseReceiptContent({
            ...base,
            response: "accepted",
        });

        expect(receipt.subject).toBe("Proposal accepted — Rear Extension");
        expect(receipt.html).toContain("records the client's acceptance");
        expect(receipt.html).not.toContain("not contract acceptance");
    });

    it("escapes client-controlled HTML fields", () => {
        const receipt = buildProposalResponseReceiptContent({
            ...base,
            response: "declined",
            clientName: "<script>alert(1)</script>",
            projectName: "Kitchen & <b>Roof</b>",
        });

        expect(receipt.html).not.toContain("<script>");
        expect(receipt.html).not.toContain("<b>Roof</b>");
        expect(receipt.html).toContain("&lt;script&gt;");
        expect(receipt.html).toContain("Kitchen &amp; &lt;b&gt;Roof&lt;/b&gt;");
    });
});

describe("email environment boundary", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv("RESEND_API_KEY", "");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("loads without a Resend key and validates only when email is sent", async () => {
        const email = await import("./email");

        await expect(email.sendProposalEmail({
            clientEmail: "client@example.com",
            clientName: "Client",
            projectName: "Test Project",
            proposalUrl: "https://example.com/proposal/test",
            companyName: "Test Contractor",
        })).rejects.toThrow("RESEND_API_KEY is required to send email.");
    });

    it("keeps supervisor invites optional when email is not configured", async () => {
        const email = await import("./email");

        await expect(email.sendSupervisorInviteEmail({
            supervisorEmail: "supervisor@example.com",
            supervisorName: "Supervisor",
            projectName: "Test Project",
            companyName: "Test Contractor",
            portalUrl: "https://example.com/supervisor/test",
        })).resolves.toBeUndefined();
    });
});
