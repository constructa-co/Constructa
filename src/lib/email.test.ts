import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
