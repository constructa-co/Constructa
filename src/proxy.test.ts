import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser, profileSingle } = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSingle: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ single: profileSingle }),
      }),
      update: () => ({
        eq: () => ({ is: () => Promise.resolve({ error: null }) }),
      }),
    }),
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
