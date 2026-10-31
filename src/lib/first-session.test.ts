import { describe, expect, it } from "vitest";
import {
    FIRST_PROJECT_STEPS,
    PROPOSAL_READINESS_PATH,
    SETUP_LIMITS,
    SETUP_SAVE_FALLBACK_ERROR,
    SETUP_WORK_SUGGESTIONS,
    buildSetupPatch,
    getHomePresentation,
    hasWorkSuggestion,
    resolvePostSetupPath,
    resolveSetupSaveOutcome,
    resolveSetupStep,
    saveStateFromOutcome,
    shouldSendWelcomeEmail,
    toggleWorkSuggestion,
} from "./first-session";
import { isDashboardPathAllowed } from "./launch-profile";

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

    it("keeps the contractor's own words, on one line", () => {
        expect(buildSetupPatch({ step: "trade", businessType: "Kitchen fitting,\n  tiling   and small extensions" })).toEqual({
            ok: true,
            step: "trade",
            patch: { business_type: "Kitchen fitting, tiling and small extensions" },
        });
        expect(buildSetupPatch({ step: "trade", businessType: "Dry stone walling" })).toMatchObject({
            ok: true,
            patch: { business_type: "Dry stone walling" },
        });
    });

    it("accepts an answer at the limit and refuses one over it", () => {
        expect(buildSetupPatch({ step: "trade", businessType: "x".repeat(SETUP_LIMITS.businessType) }).ok).toBe(true);
        expect(buildSetupPatch({ step: "trade", businessType: "x".repeat(SETUP_LIMITS.businessType + 1) })).toEqual({
            ok: false,
            error: "That's a bit long. Please keep it under 200 characters.",
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
        expect(buildSetupPatch({ step: "trade", businessType: " \n " }).ok).toBe(false);
        expect(buildSetupPatch({ step: "trade", businessType: "" })).toEqual({
            ok: false,
            error: "Tell us what kind of work your business does.",
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

describe("work suggestions", () => {
    it("adds a suggestion to whatever the contractor typed", () => {
        expect(toggleWorkSuggestion("", "Roofing")).toBe("Roofing");
        expect(toggleWorkSuggestion("Lead work on listed buildings", "Roofing")).toBe("Lead work on listed buildings, Roofing");
        expect(toggleWorkSuggestion("Roofing", "Cladding")).toBe("Roofing, Cladding");
    });

    it("takes a suggestion back out and leaves the rest alone", () => {
        expect(toggleWorkSuggestion("Lead work, roofing, Cladding", "Roofing")).toBe("Lead work, Cladding");
        expect(toggleWorkSuggestion("Roofing", "Roofing")).toBe("");
    });

    it("knows a suggestion is in the answer only as a whole entry", () => {
        expect(hasWorkSuggestion("Plumbing & Heating, Roofing", "roofing")).toBe(true);
        expect(hasWorkSuggestion("Roofing repairs", "Roofing")).toBe(false);
        expect(hasWorkSuggestion("", "Roofing")).toBe(false);
    });

    it("does not add a suggestion that would take the answer past the limit", () => {
        const nearlyFull = "x".repeat(SETUP_LIMITS.businessType - 3);
        expect(toggleWorkSuggestion(nearlyFull, "Roofing")).toBe(nearlyFull);
    });

    it("offers suggestions that all fit and all save unchanged", () => {
        expect(SETUP_WORK_SUGGESTIONS.length).toBeGreaterThan(0);
        for (const suggestion of SETUP_WORK_SUGGESTIONS) {
            expect(buildSetupPatch({ step: "trade", businessType: suggestion })).toMatchObject({
                ok: true,
                patch: { business_type: suggestion },
            });
        }
    });
});

describe("resolvePostSetupPath", () => {
    it("sends a contractor with no projects to proposal readiness", () => {
        expect(resolvePostSetupPath(0, "/dashboard")).toBe(PROPOSAL_READINESS_PATH);
        expect(resolvePostSetupPath(0, "/dashboard/home")).toBe("/dashboard/settings/profile/readiness");
    });

    it("keeps the normal landing page for contractors with projects", () => {
        expect(resolvePostSetupPath(1, "/dashboard")).toBe("/dashboard");
        expect(resolvePostSetupPath(12, "/dashboard/home")).toBe("/dashboard/home");
    });

    it("lands on a page every launch profile can open", () => {
        expect(isDashboardPathAllowed(PROPOSAL_READINESS_PATH, "cohort")).toBe(true);
        expect(isDashboardPathAllowed(PROPOSAL_READINESS_PATH, "full")).toBe(true);
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
