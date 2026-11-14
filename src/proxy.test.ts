import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser, profileSingle, termsLookup } = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSingle: vi.fn(),
  termsLookup: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser },
    from: (table: string) =>
      table === "platform_terms_acceptances"
        ? {
            select: () => ({
              eq: () => ({ eq: () => ({ eq: () => ({ limit: termsLookup }) }) }),
            }),
          }
        : {
            select: () => ({
              eq: () => ({ single: profileSingle }),
            }),
            update: () => ({
              eq: () => ({ is: () => Promise.resolve({ error: null }) }),
            }),
          },
  }),
}));

import { proxy } from "./proxy";
import { REVIEW_ORIGIN, REVIEW_PROJECT, REVIEW_USER } from "./lib/deployment/review-policy";

describe("proxy authentication boundary", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    getUser.mockReset();
    profileSingle.mockReset();
    termsLookup.mockReset();
    termsLookup.mockResolvedValue({ data: [], error: null });
    getUser.mockResolvedValue({ data: { user: null } });
    profileSingle.mockResolvedValue({ data: { company_name: "Test Co" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects an unauthenticated dashboard request to login", async () => {
    const response = await proxy(
      new NextRequest("https://constructa.example/dashboard/home"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://constructa.example/login",
    );
  });

  it("allows an unauthenticated public route", async () => {
    const response = await proxy(
      new NextRequest("https://constructa.example/proposal/public-token"),
    );

    expect(response.status).toBe(200);
  });

  it("redirects an expired recovery link on the homepage to forgot-password", async () => {
    const response = await proxy(
      new NextRequest(
        "https://constructa.example/?error=access_denied&error_code=otp_expired",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://constructa.example/auth/forgot-password?notice=link-expired",
    );
  });

  it("does not redirect recovery failures already on reset-password", async () => {
    const response = await proxy(
      new NextRequest(
        "https://constructa.example/auth/reset-password?error=access_denied&error_code=otp_expired",
      ),
    );

    expect(response.status).toBe(200);
  });

  it("redirects an authenticated cohort user away from a hidden module", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const response = await proxy(
      new NextRequest("https://constructa.example/dashboard/projects/billing?projectId=project-1"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://constructa.example/dashboard?notice=module-unavailable",
    );
  });

  it("allows an authenticated cohort user to open an approved module", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const response = await proxy(
      new NextRequest("https://constructa.example/dashboard/projects/proposal?projectId=project-1"),
    );

    expect(response.status).toBe(200);
  });

  it("allows hidden modules when the internal full profile is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    const response = await proxy(
      new NextRequest("https://constructa.example/dashboard/projects/billing?projectId=project-1"),
    );

    expect(response.status).toBe(200);
  });

  describe("platform terms enforcement (A023 F1/F4)", () => {
    const TERMS = "https://constructa.example/auth/platform-terms";
    const signedIn = () => getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    it("does nothing by default, even for a user with no acceptance record", async () => {
      signedIn();
      for (const path of ["/dashboard", "/onboarding"]) {
        const response = await proxy(new NextRequest(`https://constructa.example${path}`));
        expect(response.status).toBe(200);
      }
      expect(termsLookup).not.toHaveBeenCalled();
    });

    it.each(["off", "true", "1", ""])("stays off for %j", async (value) => {
      vi.stubEnv("CONSTRUCTA_PLATFORM_TERMS_ENFORCEMENT", value);
      signedIn();
      const response = await proxy(new NextRequest("https://constructa.example/dashboard"));
      expect(response.status).toBe(200);
      expect(termsLookup).not.toHaveBeenCalled();
    });

    describe("when switched on", () => {
      beforeEach(() => {
        vi.stubEnv("CONSTRUCTA_PLATFORM_TERMS_ENFORCEMENT", "on");
      });

      it.each(["/dashboard", "/dashboard/projects/proposal?projectId=project-1", "/onboarding"])(
        "routes a signed-in user without a current record from %s to the acceptance page",
        async (path) => {
          signedIn();
          termsLookup.mockResolvedValue({ data: [], error: null });
          const response = await proxy(new NextRequest(`https://constructa.example${path}`));
          expect(response.status).toBe(303);
          expect(response.headers.get("location")).toBe(TERMS);
        },
      );

      it("turns a blocked POST into a GET with 303", async () => {
        signedIn();
        const response = await proxy(new NextRequest("https://constructa.example/dashboard/projects/costs", { method: "POST" }));
        expect(response.status).toBe(303);
        expect(response.headers.get("location")).toBe(TERMS);
      });

      it("lets a user with a current record through", async () => {
        signedIn();
        termsLookup.mockResolvedValue({ data: [{ id: "row-1" }], error: null });
        const response = await proxy(new NextRequest("https://constructa.example/dashboard/projects/proposal?projectId=project-1"));
        expect(response.status).toBe(200);
      });

      it("does not loop: the acceptance page and sign-in are never redirected and need no lookup", async () => {
        signedIn();
        for (const path of ["/auth/platform-terms", "/login", "/terms-of-service"]) {
          const response = await proxy(new NextRequest(`https://constructa.example${path}`));
          expect(response.status).toBe(200);
        }
        expect(termsLookup).not.toHaveBeenCalled();
      });

      it("fails open when the table is missing, the lookup errors, or it throws", async () => {
        signedIn();
        vi.spyOn(console, "error").mockImplementation(() => {});
        for (const outcome of [
          () => Promise.resolve({ data: null, error: { code: "PGRST205" } }),
          () => Promise.resolve({ data: null, error: { code: "XX000" } }),
          () => Promise.reject(new Error("connection reset")),
        ]) {
          termsLookup.mockReset();
          termsLookup.mockImplementation(outcome);
          const response = await proxy(new NextRequest("https://constructa.example/dashboard"));
          expect(response.status).toBe(200);
        }
        vi.restoreAllMocks();
      });

      it("keeps the unauthenticated gate first: no user means /login, not the acceptance page, and no lookup", async () => {
        const response = await proxy(new NextRequest("https://constructa.example/dashboard"));
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("https://constructa.example/login");
        expect(termsLookup).not.toHaveBeenCalled();
      });

      it("does not touch /admin, which keeps its own guard", async () => {
        signedIn();
        const response = await proxy(new NextRequest("https://constructa.example/admin"));
        expect(response.status).toBe(200);
        expect(termsLookup).not.toHaveBeenCalled();
      });

      it("still applies the onboarding redirect once terms are accepted", async () => {
        signedIn();
        termsLookup.mockResolvedValue({ data: [{ id: "row-1" }], error: null });
        profileSingle.mockResolvedValue({ data: { company_name: null } });
        const response = await proxy(new NextRequest("https://constructa.example/dashboard"));
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("https://constructa.example/onboarding");
      });
    });
  });

  describe("protected test-data review", () => {
    beforeEach(() => {
      vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "1");
      vi.stubEnv("VERCEL_ENV", "preview");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", REVIEW_ORIGIN);
      vi.stubEnv("CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF", REVIEW_PROJECT);
      getUser.mockResolvedValue({ data: { user: { id: REVIEW_USER } } });
    });

    it.each(["/dashboard/projects/costs", "/dashboard/settings/profile", "/dashboard/projects/proposal"])("blocks POST before authentication at %s", async pathname => {
      const response = await proxy(new NextRequest("https://review.example" + pathname, { method: "POST" }));
      expect(response.status).toBe(403);
      expect(getUser).not.toHaveBeenCalled();
    });
    it("blocks API GETs and public proposal publication paths", async () => {
      for (const pathname of ["/api/cron/contract-alerts", "/api/xero/callback", "/proposal/test-token"]) {
        expect((await proxy(new NextRequest("https://review.example" + pathname))).status).toBe(403);
      }
      expect(getUser).not.toHaveBeenCalled();
    });
    it("allows the labelled account view with restrictive browser headers", async () => {
      const response = await proxy(new NextRequest("https://review.example/dashboard/projects/costs"));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-security-policy")).toContain("connect-src 'self'");
      expect(response.headers.get("content-security-policy")).not.toContain("/rest/v1");
      expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow, noarchive");
    });
    it("does not open data for a different account", async () => {
      getUser.mockResolvedValue({ data: { user: { id: "someone-else" } } });
      expect((await proxy(new NextRequest("https://review.example/dashboard"))).status).toBe(403);
    });
  });
});
