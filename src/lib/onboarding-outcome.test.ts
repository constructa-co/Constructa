import { describe, expect, it } from "vitest";
import {
    ONBOARDING_SAVE_FALLBACK_ERROR,
    resolveOnboardingOutcome,
} from "./onboarding-outcome";

describe("resolveOnboardingOutcome", () => {
    it("treats an explicit success object as ok", () => {
        expect(resolveOnboardingOutcome({ success: true })).toEqual({ ok: true });
    });

    it("treats undefined as ok (server-side redirect never resolves the client await)", () => {
        expect(resolveOnboardingOutcome(undefined)).toEqual({ ok: true });
    });

    it("treats null as ok", () => {
        expect(resolveOnboardingOutcome(null)).toEqual({ ok: true });
    });

    it("surfaces a server-provided error message", () => {
        expect(resolveOnboardingOutcome({ error: "row level security" })).toEqual({
            ok: false,
            error: "row level security",
        });
    });

    it("falls back to a recoverable message when the error is empty", () => {
        expect(resolveOnboardingOutcome({ error: "" })).toEqual({
            ok: false,
            error: ONBOARDING_SAVE_FALLBACK_ERROR,
        });
        expect(resolveOnboardingOutcome({ error: "   " })).toEqual({
            ok: false,
            error: ONBOARDING_SAVE_FALLBACK_ERROR,
        });
    });

    it("falls back when the error field is not a string", () => {
        expect(resolveOnboardingOutcome({ error: undefined })).toEqual({
            ok: false,
            error: ONBOARDING_SAVE_FALLBACK_ERROR,
        });
        expect(resolveOnboardingOutcome({ error: 42 })).toEqual({
            ok: false,
            error: ONBOARDING_SAVE_FALLBACK_ERROR,
        });
    });

    it("does not treat unrelated shapes as failures", () => {
        expect(resolveOnboardingOutcome({ success: false })).toEqual({ ok: true });
        expect(resolveOnboardingOutcome("unexpected string")).toEqual({ ok: true });
    });
});
