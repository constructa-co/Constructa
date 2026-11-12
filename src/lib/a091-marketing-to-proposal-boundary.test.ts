import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LandingPage from "@/app/landing/page";

const auth = vi.hoisted(() => ({ exchange: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: auth.createClient }));

import { GET } from "@/app/auth/callback/route";
import { PROPOSAL_READINESS_PATH, resolvePostSetupPath } from "@/lib/first-session";
import { getLaunchLandingPath, isDashboardPathAllowed } from "@/lib/launch-profile";
import {
    PLATFORM_TERMS_COMPLETION_PATH,
    PLATFORM_TERMS_COMPLETION_SIGN_IN,
    platformTermsCompletionReturn,
    platformTermsConfirmationRedirect,
} from "@/lib/platform-terms-completion";

const ORIGIN = "https://constructa.example.invalid";

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    auth.createClient.mockResolvedValue({ auth: { exchangeCodeForSession: auth.exchange } });
    auth.exchange.mockResolvedValue({ error: null });
});

afterEach(() => vi.unstubAllEnvs());

/**
 * A091 — meaningful integration boundaries for website → sign-up → proposal.
 * Source-only: no Auth provider, DB, or browser. Wires constants and the
 * auth callback redirect handler that carry the marketing sign-up journey.
 */
describe("A091 marketing-to-proposal boundary", () => {
    it("carries the exact platform-terms next param from signup email through callback", async () => {
        const redirect = platformTermsConfirmationRedirect(ORIGIN);
        expect(redirect).toBe(`${ORIGIN}/auth/callback?next=${encodeURIComponent(PLATFORM_TERMS_COMPLETION_PATH)}`);

        const callbackUrl = new URL(redirect);
        const query = callbackUrl.search.slice(1);
        const response = await GET(new Request(`${ORIGIN}/auth/callback?${query}&code=synthetic`));
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(`${ORIGIN}${PLATFORM_TERMS_COMPLETION_PATH}`);
    });

    it("honours only the exact completion next param on deliberate sign-in", () => {
        expect(platformTermsCompletionReturn(`?next=${encodeURIComponent(PLATFORM_TERMS_COMPLETION_PATH)}`)).toBe(
            PLATFORM_TERMS_COMPLETION_PATH,
        );
        expect(platformTermsCompletionReturn("?next=%2Fdashboard%2Fprojects%2Fproposal")).toBeNull();
        expect(platformTermsCompletionReturn("?next=https%3A%2F%2Fevil.example")).toBeNull();
    });

    it("lands a first company introduction on proposal readiness before the editor", () => {
        expect(resolvePostSetupPath(null, getLaunchLandingPath(), true)).toBe(PROPOSAL_READINESS_PATH);
        expect(existsSync(path.join(process.cwd(), "src/app", PROPOSAL_READINESS_PATH, "page.tsx"))).toBe(true);
    });

    it("keeps the cohort proposal editor on the allowed dashboard path after welcome", () => {
        const proposalPath = "/dashboard/projects/proposal";
        expect(isDashboardPathAllowed(proposalPath, "cohort")).toBe(true);
        expect(isDashboardPathAllowed(`${proposalPath}/`, "cohort")).toBe(true);
        expect(existsSync(path.join(process.cwd(), "src/app/dashboard/projects/proposal", "page.tsx"))).toBe(true);
    });

    it("exposes the cohort marketing landing and account entry the Edge loopback journey uses", () => {
        const landing = renderToStaticMarkup(createElement(LandingPage));
        expect(landing).toMatch(/<h1[\s>]/);
        expect(landing).toContain('href="/login"');
        expect(platformTermsCompletionReturn("")).toBeNull();
        expect(PLATFORM_TERMS_COMPLETION_SIGN_IN).toBe("/login?next=%2Fauth%2Fplatform-terms");
    });
});
