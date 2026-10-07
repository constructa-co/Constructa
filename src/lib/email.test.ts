import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { responseWording } from "./proposal-response";
import {
    buildProposalEmailContent,
    buildProposalResponseReceiptContent,
    escapeEmailHtml,
    normalizeEmailSubjectPart,
    requireTrustedAppUrl,
} from "./email";

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

        expect(receipt.subject).toBe("Receipt confirmed — Rear Extension");
        expect(receipt.html).toContain(responseWording("acknowledgement").receiptExplanation);
        expect(receipt.html).toContain("It is not acceptance of the proposal and does not create a contract.");
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
        expect(receipt.html).not.toContain("not acceptance");
    });

    it("states that an intention to proceed is not binding, to the client and to the contractor", () => {
        for (const recipientKind of ["client", "owner"] as const) {
            const receipt = buildProposalResponseReceiptContent({
                ...base,
                recipientKind,
                response: "acknowledged",
                responseKind: "non_binding_intent",
            });
            expect(receipt.subject).toBe("Intention to proceed (not binding) — Rear Extension");
            expect(receipt.html).toContain(responseWording("non_binding_intent").receiptExplanation);
            expect(receipt.html).toContain("subject to a final contract and terms being agreed");
            expect(receipt.html).not.toContain("Proposal accepted");
        }
    });

    it("never describes an acknowledgement as acceptance, whatever the publication asked for", () => {
        const receipt = buildProposalResponseReceiptContent({ ...base, response: "acknowledged", responseKind: "binding_acceptance" });
        expect(receipt.subject).toBe("Receipt confirmed — Rear Extension");
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

describe("proposal delivery email", () => {
    const args = {
        clientName: "Alex Client",
        projectName: "Rear Extension",
        proposalUrl: "https://constructa-nu.vercel.app/proposal/test",
        companyName: "Example Construction",
    };

    it("asks for confirmation of receipt by default and says it is not acceptance", () => {
        const email = buildProposalEmailContent(args);
        expect(email.html).toContain(responseWording("acknowledgement").emailInvite);
        expect(email.html).toContain("is not acceptance and does not create a contract");
    });

    it("asks for a non-binding intention with the same wording as the proposal", () => {
        const email = buildProposalEmailContent({ ...args, responseKind: "non_binding_intent" });
        expect(email.html).toContain(responseWording("non_binding_intent").emailInvite);
        expect(email.html).toContain("not binding");
    });

    it("never invites the client to accept, and makes no claim on the contractor's behalf", () => {
        for (const responseKind of ["acknowledgement", "non_binding_intent"] as const) {
            const html = buildProposalEmailContent({ ...args, responseKind }).html.toLowerCase();
            expect(html).not.toContain("confirm your acceptance");
            expect(html).not.toContain("accept the proposal");
            expect(html).not.toContain("thank you for the opportunity");
        }
    });

    it("escapes the project and client names", () => {
        const email = buildProposalEmailContent({ ...args, clientName: "<b>Alex</b>", projectName: "Kitchen & <i>Roof</i>" });
        expect(email.html).not.toContain("<b>Alex</b>");
        expect(email.html).toContain("Kitchen &amp; &lt;i&gt;Roof&lt;/i&gt;");
    });
});

describe("email environment boundary", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv("RESEND_API_KEY", "");
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
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

describe("transactional email safety helpers", () => {
    it("escapes tags, quotes and ampersands", () => {
        expect(escapeEmailHtml(`<a href="x">Tom & O'Brien</a>`)).toBe(
            "&lt;a href=&quot;x&quot;&gt;Tom &amp; O&#039;Brien&lt;/a&gt;",
        );
    });

    it("removes subject control characters and caps length", () => {
        expect(normalizeEmailSubjectPart("Project\r\nBcc: attacker@example.com", 20)).toBe(
            "Project Bcc: attacke",
        );
    });

    it("accepts only links on the configured application origin", () => {
        vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.constructa.test");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://workspace.constructa.test");

        expect(requireTrustedAppUrl("https://app.constructa.test/proposal/token")).toBe(
            "https://app.constructa.test/proposal/token",
        );
        expect(requireTrustedAppUrl("https://workspace.constructa.test/dashboard")).toBe(
            "https://workspace.constructa.test/dashboard",
        );
        expect(() => requireTrustedAppUrl("https://attacker.test/proposal/token")).toThrow(
            "configured Constructa origin",
        );
        expect(() => requireTrustedAppUrl("javascript:alert(1)")).toThrow();
    });
});
