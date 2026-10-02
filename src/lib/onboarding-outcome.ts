// E2E-01 — the onboarding server action either returns an error object,
// returns nothing (the success path issues a server-side redirect, which the
// client await observes as the promise never settling), or throws. This
// reducer maps whatever the client received onto a UI outcome so the
// Finish button always settles: either navigate, or restore the control
// with a recoverable message.

export type OnboardingSaveOutcome =
    | { ok: true }
    | { ok: false; error: string };

export const ONBOARDING_SAVE_FALLBACK_ERROR =
    "We couldn't save your profile. Please check your connection and try again.";

export function resolveOnboardingOutcome(result: unknown): OnboardingSaveOutcome {
    if (result && typeof result === "object" && "error" in result) {
        const message = (result as { error?: unknown }).error;
        return {
            ok: false,
            error:
                typeof message === "string" && message.trim()
                    ? message
                    : ONBOARDING_SAVE_FALLBACK_ERROR,
        };
    }
    return { ok: true };
}
