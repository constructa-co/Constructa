import { describe, expect, it } from "vitest";
import {
    FIRST_PROJECT_STEPS,
    NEW_PROJECT_PATH,
    SETUP_SAVE_FALLBACK_ERROR,
    buildSetupPatch,
    getHomePresentation,
    resolvePostSetupPath,
    resolveSetupSaveOutcome,
    resolveSetupStep,
    saveStateFromOutcome,
    shouldSendWelcomeEmail,
} from "./first-session";

describe("resolveSetupStep", () => {
    it("starts a new contractor on the trade question", () => {
        expect(resolveSetupStep(null)).toBe("trade");
        expect(resolveSetupStep({ business_type: null })).toBe("trade");
        expect(resolveSetupStep({ business_type: "   " })).toBe("trade");
    });

    it("resumes on the business name once the trade is saved", () => {
        expect(resolveSetupStep({ business_type: "Plumbing & Heating" })).toBe("business");
    });
});

describe("buildSetupPatch", () => {
    it("writes only the trade for the trade step", () => {
        expect(buildSetupPatch({ step: "trade", businessType: "  Bricklaying " })).toEqual({
            ok: true,
            step: "trade",
            patch: { business_type: "Bricklaying" },
        });
    });

    it("writes only the business name and the user's name for the business step", () => {
        expect(buildSetupPatch({ step: "business", companyName: " Smith Plumbing ", fullName: " Sam Smith " })).toEqual({
            ok: true,
            step: "business",
            patch: { company_name: "Smith Plumbing", full_name: "Sam Smith" },
        });
    });

    it("leaves a saved name alone when the name is left blank", () => {
        const result = buildSetupPatch({ step: "business", companyName: "Smith Plumbing", fullName: "  " });
        expect(result).toEqual({ ok: true, step: "business", patch: { company_name: "Smith Plumbing" } });
    });

    it("never writes optional profile fields", () => {
        const result = buildSetupPatch({
            step: "business",
            companyName: "Smith Plumbing",
            logo_url: "x",
            capability_statement: "x",
            default_tc_overrides: [],
            insurance_schedule: [],
        });
        expect(result.ok && Object.keys(result.patch)).toEqual(["company_name"]);
    });

    it("asks for the missing answer in plain language", () => {
        expect(buildSetupPatch({ step: "trade", businessType: "" })).toEqual({
            ok: false,
            error: "Choose the trade that best describes your work.",
        });
        expect(buildSetupPatch({ step: "business", companyName: "  " })).toEqual({
            ok: false,
            error: "Enter your business or trading name.",
        });
    });

    it("rejects over-long answers and unknown steps", () => {
        expect(buildSetupPatch({ step: "trade", businessType: "x".repeat(201) }).ok).toBe(false);
        expect(buildSetupPatch({ step: "business", companyName: "x".repeat(201) }).ok).toBe(false);
        expect(buildSetupPatch({ step: "business", companyName: "ok", fullName: "x".repeat(201) }).ok).toBe(false);
        expect(buildSetupPatch({ step: "terms" }).ok).toBe(false);
        expect(buildSetupPatch(null).ok).toBe(false);
    });
});

describe("shouldSendWelcomeEmail", () => {
    it("sends only when the business name is saved for the first time", () => {
        expect(shouldSendWelcomeEmail({ step: "business", companyNameClaimedNow: true, hasEmail: true })).toBe(true);
        expect(shouldSendWelcomeEmail({ step: "business", companyNameClaimedNow: false, hasEmail: true })).toBe(false);
        expect(shouldSendWelcomeEmail({ step: "trade", companyNameClaimedNow: true, hasEmail: true })).toBe(false);
        expect(shouldSendWelcomeEmail({ step: "business", companyNameClaimedNow: true, hasEmail: false })).toBe(false);
    });
});

describe("resolvePostSetupPath", () => {
    it("sends a contractor with no projects straight to New Project", () => {
        expect(resolvePostSetupPath(0, "/dashboard")).toBe(NEW_PROJECT_PATH);
        expect(resolvePostSetupPath(0, "/dashboard/home")).toBe("/dashboard/projects/new");
    });

    it("keeps the normal landing page for contractors with projects", () => {
        expect(resolvePostSetupPath(1, "/dashboard")).toBe("/dashboard");
        expect(resolvePostSetupPath(12, "/dashboard/home")).toBe("/dashboard/home");
    });
});

describe("setup save state", () => {
    it("treats an explicit ok and a never-returned redirect as saved", () => {
        expect(resolveSetupSaveOutcome({ ok: true })).toEqual({ ok: true });
        expect(resolveSetupSaveOutcome(undefined)).toEqual({ ok: true });
        expect(saveStateFromOutcome({ ok: true })).toEqual({ status: "saved" });
    });

    it("surfaces the server's message as a failed state that can be retried", () => {
        const outcome = resolveSetupSaveOutcome({ error: "Enter your business or trading name." });
        expect(outcome).toEqual({ ok: false, error: "Enter your business or trading name." });
        expect(saveStateFromOutcome(outcome)).toEqual({
            status: "failed",
            error: "Enter your business or trading name.",
        });
    });

    it("falls back to a recoverable message when the error is empty or not text", () => {
        for (const error of ["", "   ", undefined, 42]) {
            expect(resolveSetupSaveOutcome({ error })).toEqual({ ok: false, error: SETUP_SAVE_FALLBACK_ERROR });
        }
    });
});

describe("home presentation", () => {
    it("shows the first-project state only when there are no projects", () => {
        expect(getHomePresentation(0)).toBe("first-project");
        expect(getHomePresentation(1)).toBe("portfolio");
        expect(getHomePresentation(40)).toBe("portfolio");
    });

    it("explains the journey in four plain steps", () => {
        expect(FIRST_PROJECT_STEPS.map((step) => step.title)).toEqual([
            "Add the job",
            "Confirm the brief",
            "Build the price",
            "Review the proposal",
        ]);
    });
});
