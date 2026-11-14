import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ pathname: "/" as string | null, signedOut: true }));

vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: () => [state.signedOut, () => {}],
    useEffect: () => {},
  };
});
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("@vercel/analytics/next", () => ({ Analytics: "vercel-analytics-stub" }));

import PublicAnalytics from "./public-analytics";

function render(pathname: string | null, signedOut = true) {
  state.pathname = pathname;
  state.signedOut = signedOut;
  return PublicAnalytics() as { type: unknown; props: { beforeSend: (e: { type: string; url: string }) => unknown } } | null;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("PublicAnalytics mount gating", () => {
  it("renders nothing when page-view activation is default-off", () => {
    expect(render("/pricing")).toBeNull();
  });

  describe("with NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS=1", () => {
    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS", "1");
    });

  it.each(["/", "/landing", "/pricing", "/guides/site-surveys", "/apply"])(
    "mounts Vercel Web Analytics on public route %s", (pathname) => {
      expect(render(pathname)?.type).toBe("vercel-analytics-stub");
    },
  );

  it.each([
    "/dashboard", "/dashboard/projects/costs", "/admin", "/onboarding", "/login",
    "/auth/callback", "/proposal/synthetic-token", "/supervisor", "/api/contact",
    "/guides-private", "/offline", "/storage",
  ])("renders nothing on %s", (pathname) => {
    expect(render(pathname)).toBeNull();
  });

  it("renders nothing without a pathname or while a session is present or unknown", () => {
    expect(render(null)).toBeNull();
    expect(render("/pricing", false)).toBeNull();
  });

  it("re-checks the cookie and URL when an event is about to be sent", () => {
    const element = render("/pricing");
    const send = element!.props.beforeSend;

    vi.stubGlobal("document", { cookie: "theme=dark" });
    expect(send({ type: "pageview", url: "https://www.constructa.co/pricing?utm_source=x#y" })).toEqual({
      type: "pageview",
      url: "https://www.constructa.co/pricing",
    });
    expect(send({ type: "pageview", url: "https://www.constructa.co/dashboard" })).toBeNull();

    vi.stubGlobal("document", { cookie: "sb-abcdefghij-auth-token=value" });
    expect(send({ type: "pageview", url: "https://www.constructa.co/pricing" })).toBeNull();
  });
  });
});
