/**
 * First-session model: short setup, where setup lands, and what Home shows
 * before a contractor has a project.
 *
 * Everything here is pure so the onboarding screens, the server action and
 * the Home/Pipeline pages agree on one set of rules.
 */

export const NEW_PROJECT_PATH = "/dashboard/projects/new";
export const PROFILE_PATH = "/dashboard/settings/profile";
export const CASE_STUDIES_PATH = "/dashboard/settings/case-studies";
/** Under the profile route, so every launch profile that has Profile has this. */
export const PROPOSAL_READINESS_PATH = "/dashboard/settings/profile/readiness";

// ── Short setup ──────────────────────────────────────────────────────────────

/**
 * The kind of work is asked first and the business name last. Access to the
 * dashboard opens once a business name is saved, so saving it last means a
 * contractor who stops halfway comes back to the question they had reached.
 *
 * The first step keeps the key "trade" and still saves to
 * `profiles.business_type`, but the answer is the contractor's own words.
 */
export type SetupStep = "trade" | "business";

export const SETUP_STEPS: readonly SetupStep[] = ["trade", "business"];

/**
 * Optional shortcuts beside the free-text answer. Tapping one adds it to the
 * answer; none of them has to be used.
 */
export const SETUP_WORK_SUGGESTIONS: readonly string[] = [
    "General Builder / Extensions",
    "Plumbing & Heating",
    "Electrical",
    "Bricklaying",
    "Groundworks & Civils",
    "Roofing",
    "Cladding",
    "Joinery & Carpentry",
    "Plastering",
    "Painting & Decorating",
    "Bathroom & Kitchen Fitting",
    "Landscaping & Fencing",
];

export const SETUP_LIMITS = {
    businessType: 200,
    companyName: 200,
    fullName: 200,
} as const;

export interface SetupProfileSnapshot {
    company_name?: string | null;
    full_name?: string | null;
    business_type?: string | null;
}

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** One line of text: line breaks and runs of spaces become single spaces. */
const singleLine = (value: unknown): string => clean(value).replace(/\s+/g, " ");

const workParts = (answer: string): string[] =>
    answer.split(",").map((part) => part.trim()).filter(Boolean);

export function hasWorkSuggestion(answer: string, suggestion: string): boolean {
    return workParts(answer).some((part) => part.toLowerCase() === suggestion.toLowerCase());
}

/**
 * Adds a suggestion to the answer, or takes it back out if it is already
 * there. Whatever else the contractor typed is kept. A suggestion that would
 * take the answer past the limit is not added.
 */
export function toggleWorkSuggestion(answer: string, suggestion: string): string {
    const parts = workParts(answer);
    if (hasWorkSuggestion(answer, suggestion)) {
        return parts.filter((part) => part.toLowerCase() !== suggestion.toLowerCase()).join(", ");
    }
    const next = [...parts, suggestion].join(", ");
    return next.length > SETUP_LIMITS.businessType ? answer : next;
}

/** First question the contractor has not answered yet. */
export function resolveSetupStep(profile: SetupProfileSnapshot | null | undefined): SetupStep {
    return clean(profile?.business_type) ? "business" : "trade";
}

export type SetupStepInput =
    | { step: "trade"; businessType: string }
    | { step: "business"; companyName: string; fullName?: string };

/** Only the columns a step owns. Nothing else on the profile is touched. */
export type SetupProfilePatch =
    | { business_type: string }
    | { company_name: string; full_name?: string };

export type SetupPatchResult =
    | { ok: true; step: SetupStep; patch: SetupProfilePatch }
    | { ok: false; error: string };

export function buildSetupPatch(input: unknown): SetupPatchResult {
    const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

    if (raw.step === "trade") {
        const businessType = singleLine(raw.businessType);
        if (!businessType) return { ok: false, error: "Tell us what kind of work your business does." };
        if (businessType.length > SETUP_LIMITS.businessType) {
            return { ok: false, error: `That's a bit long. Please keep it under ${SETUP_LIMITS.businessType} characters.` };
        }
        return { ok: true, step: "trade", patch: { business_type: businessType } };
    }

    if (raw.step === "business") {
        const companyName = clean(raw.companyName);
        const fullName = clean(raw.fullName);
        if (!companyName) return { ok: false, error: "Enter your business or trading name." };
        if (companyName.length > SETUP_LIMITS.companyName) {
            return { ok: false, error: "That business name is too long. Please shorten it." };
        }
        if (fullName.length > SETUP_LIMITS.fullName) {
            return { ok: false, error: "That name is too long. Please shorten it." };
        }
        // A blank name leaves any saved name alone rather than erasing it.
        return {
            ok: true,
            step: "business",
            patch: fullName ? { company_name: companyName, full_name: fullName } : { company_name: companyName },
        };
    }

    return { ok: false, error: "We couldn't tell which setup question this was. Please try again." };
}

/** The welcome email goes out once: the first time a business name is saved. */
export function shouldSendWelcomeEmail(args: {
    step: SetupStep;
    companyNameClaimedNow: boolean;
    hasEmail: boolean;
}): boolean {
    return args.step === "business" && args.companyNameClaimedNow && args.hasEmail;
}

/**
 * A contractor with no projects lands on proposal readiness, where the first
 * project is one tap away and the rest of the company profile is optional.
 */
export function resolvePostSetupPath(projectCount: number, landingPath: string): string {
    return projectCount > 0 ? landingPath : PROPOSAL_READINESS_PATH;
}

// ── Save state shown beside a setup step ─────────────────────────────────────

export type SetupSaveState =
    | { status: "idle" }
    | { status: "saving" }
    | { status: "saved" }
    | { status: "failed"; error: string };

export const SETUP_SAVE_FALLBACK_ERROR =
    "We couldn't save that. Check your connection and try again.";

export type SetupSaveOutcome =
    | { ok: true }
    | { ok: false; error: string };

/**
 * Maps whatever the save action handed back onto an outcome. `undefined`
 * counts as success because the final step redirects on the server, which
 * the client sees as a call that never returns a value.
 */
export function resolveSetupSaveOutcome(result: unknown): SetupSaveOutcome {
    if (result && typeof result === "object" && "error" in result) {
        const message = (result as { error?: unknown }).error;
        return {
            ok: false,
            error: typeof message === "string" && message.trim() ? message : SETUP_SAVE_FALLBACK_ERROR,
        };
    }
    return { ok: true };
}

export function saveStateFromOutcome(outcome: SetupSaveOutcome): SetupSaveState {
    return outcome.ok ? { status: "saved" } : { status: "failed", error: outcome.error };
}

// ── Home before and after the first project ──────────────────────────────────

export type HomePresentation = "first-project" | "portfolio";

export function getHomePresentation(projectCount: number): HomePresentation {
    return projectCount > 0 ? "portfolio" : "first-project";
}

export interface FirstProjectStep {
    title: string;
    detail: string;
}

export const FIRST_PROJECT_STEPS: readonly FirstProjectStep[] = [
    { title: "Add the job", detail: "Give it a name and tell us who it's for." },
    { title: "Confirm the brief", detail: "Describe the work in your own words." },
    { title: "Build the price", detail: "Start with a rough figure or break it down." },
    { title: "Review the proposal", detail: "Check it over before it goes to your client." },
];
