import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_MEASUREMENT_COLLECTION_ENABLED,
  __setPublicMeasurementTestSink,
  dispatchPublicMeasurementEvent,
  filterPageviewEvent,
  hasSignedInSessionCookie,
  isPublicMeasurementRoute,
  isPublicPageviewMeasurementEnabled,
  trackContactFormSubmitAccepted,
  trackTryConstructaClick,
  trackWaitlistSubmitAttempt,
} from "./public-measurement";

afterEach(() => {
  __setPublicMeasurementTestSink(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("public measurement contract", () => {
  it("keeps collection disabled by default", () => {
    expect(PUBLIC_MEASUREMENT_COLLECTION_ENABLED).toBe(false);
  });

  it("allows only explicit public marketing routes", () => {
    expect(isPublicMeasurementRoute("/")).toBe(true);
    expect(isPublicMeasurementRoute("/landing")).toBe(true);
    expect(isPublicMeasurementRoute("/apply")).toBe(true);
    expect(isPublicMeasurementRoute("/guides/site-surveys")).toBe(true);
    expect(isPublicMeasurementRoute("/dashboard")).toBe(false);
    expect(isPublicMeasurementRoute("/admin")).toBe(false);
    expect(isPublicMeasurementRoute("/proposal/token")).toBe(false);
    expect(isPublicMeasurementRoute("/onboarding")).toBe(false);
  });

  it("dispatches to a test sink on allowed routes when collection is disabled", () => {
    const events: Array<{ event: string; props: Record<string, string> }> =
      [];
    __setPublicMeasurementTestSink((event, props) => {
      events.push({ event, props });
    });

    vi.stubGlobal("window", { location: { pathname: "/" } });
    trackContactFormSubmitAccepted();
    vi.stubGlobal("window", { location: { pathname: "/landing" } });
    trackWaitlistSubmitAttempt();
    vi.stubGlobal("window", { location: { pathname: "/" } });
    trackTryConstructaClick("solution");
    trackTryConstructaClick("not-allowed");

    expect(events).toEqual([
      { event: "ContactFormSubmit", props: {} },
      { event: "WaitlistSubmitAttempt", props: {} },
      { event: "TryConstructaClick", props: { location: "solution" } },
    ]);
  });

  it("fail-closes dispatch on non-public routes and ignores stale pathname overrides in the browser", () => {
    const events: string[] = [];
    __setPublicMeasurementTestSink((event) => {
      events.push(event);
    });

    dispatchPublicMeasurementEvent("ContactFormSubmit", {
      pathname: "/dashboard",
    });
    expect(events).toHaveLength(0);

    vi.stubGlobal("window", { location: { pathname: "/dashboard" } });
    trackContactFormSubmitAccepted("/");
    expect(events).toHaveLength(0);
  });

  it("does not forward to a collector while collection stays disabled", () => {
    const plausible = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/" },
      plausible,
    } as Window & { plausible: typeof plausible });
    __setPublicMeasurementTestSink(() => {
      /* sink present; still no collector */
    });

    trackContactFormSubmitAccepted();
    expect(plausible).not.toHaveBeenCalled();
  });
});

describe("adversarial public measurement inputs", () => {
  it("strips confidential extras and refuses unknown runtime events", () => {
    const sink = vi.fn();
    __setPublicMeasurementTestSink(sink);
    vi.stubGlobal("window", { location: { pathname: "/guides/synthetic?email=private#project" } });
    // Exercise runtime input beyond the compile-time contract without any provider.
    const dispatch = dispatchPublicMeasurementEvent as unknown as
      (event: string, options?: { props: Record<string, string> }) => void;
    dispatch("TryConstructaClick", { props: { location: "solution", email: "synthetic@example.invalid", project: "private synthetic brief" } });
    dispatch("ContactFormSubmit", { props: { email: "synthetic@example.invalid" } });
    dispatch("SubscriberConfirmed", { props: {} });
    expect(sink.mock.calls).toEqual([
      ["TryConstructaClick", { location: "solution" }],
      ["ContactFormSubmit", {}],
    ]);
  });

  it.each(["/guides-private", "/dashboard/guides", "/auth/callback", "/api/contact", "/proposal/synthetic", "/admin/guides"])(
    "rejects private and lookalike route %s", (pathname) => {
      const sink = vi.fn();
      __setPublicMeasurementTestSink(sink);
      vi.stubGlobal("window", { location: { pathname } });
      trackContactFormSubmitAccepted("/guides");
      expect(sink).not.toHaveBeenCalled();
    },
  );

  it("counts repeated attempts separately; it does not claim unique conversions", () => {
    const sink = vi.fn();
    __setPublicMeasurementTestSink(sink);
    vi.stubGlobal("window", { location: { pathname: "/landing" } });
    trackWaitlistSubmitAttempt();
    trackWaitlistSubmitAttempt();
    expect(sink.mock.calls).toEqual([["WaitlistSubmitAttempt", {}], ["WaitlistSubmitAttempt", {}]]);
  });
});


describe("A097 offline evidence boundaries", () => {
  it("has no outbound or persistence effect without a test sink", () => {
    const fetch = vi.fn();
    const sendBeacon = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("navigator", { sendBeacon });
    vi.stubGlobal("localStorage", { setItem });
    vi.stubGlobal("sessionStorage", { setItem });
    vi.stubGlobal("window", { location: { pathname: "/" } });
    trackTryConstructaClick("solution");
    trackContactFormSubmitAccepted();
    trackWaitlistSubmitAttempt();
    expect(fetch).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("does not leak attribution parameters or turn attempts into confirmed outcomes", () => {
    const sink = vi.fn();
    __setPublicMeasurementTestSink(sink);
    vi.stubGlobal("window", { location: {
      pathname: "/apply",
      search: "?utm_source=synthetic&email=synthetic@example.invalid",
      hash: "#private-fragment",
    } });
    trackTryConstructaClick("about");
    trackWaitlistSubmitAttempt();
    expect(sink.mock.calls).toEqual([
      ["TryConstructaClick", { location: "about" }],
      ["WaitlistSubmitAttempt", {}],
    ]);
  });

  it("rechecks the current route after public-to-private navigation", () => {
    const sink = vi.fn();
    __setPublicMeasurementTestSink(sink);
    const location = { pathname: "/apply" };
    vi.stubGlobal("window", { location });
    trackTryConstructaClick("solution");
    location.pathname = "/dashboard/projects/costs";
    trackTryConstructaClick("solution", "/");
    trackContactFormSubmitAccepted("/");
    expect(sink.mock.calls).toEqual([["TryConstructaClick", { location: "solution" }]]);
  });
});

describe("A097 D12 Vercel Web Analytics activation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is default-off unless NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS is exactly 1", () => {
    expect(isPublicPageviewMeasurementEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS", "true");
    expect(isPublicPageviewMeasurementEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS", "1");
    expect(isPublicPageviewMeasurementEnabled()).toBe(true);
  });
});

describe("A097 Vercel Web Analytics page-view filter", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_VERCEL_WEB_ANALYTICS", "1");
  });
  afterEach(() => vi.unstubAllEnvs());

  const view = (url: string) => ({ type: "pageview" as const, url });

  it("cancels every page view while activation is off", () => {
    vi.unstubAllEnvs();
    expect(
      filterPageviewEvent(view("https://www.constructa.co/pricing"), ""),
    ).toBeNull();
  });

  it("keeps only origin and path on public routes", () => {
    expect(
      filterPageviewEvent(
        view("https://www.constructa.co/guides/site-surveys?utm_source=x&email=a@b.invalid#frag"),
        "",
      ),
    ).toEqual(view("https://www.constructa.co/guides/site-surveys"));
    expect(filterPageviewEvent(view("https://www.constructa.co/"), "")).toEqual(
      view("https://www.constructa.co/"),
    );
  });

  it.each([
    "https://www.constructa.co/dashboard/projects/costs?project=abc",
    "https://www.constructa.co/admin",
    "https://www.constructa.co/proposal/0b6f7c1e-token",
    "https://www.constructa.co/onboarding",
    "https://www.constructa.co/login",
    "https://www.constructa.co/auth/reset-password?code=secret",
    "https://www.constructa.co/api/contact",
    "https://www.constructa.co/supervisor",
    "https://www.constructa.co/guides-private",
    "https://www.constructa.co/offline",
    "not a url",
    "javascript:alert(1)",
  ])("cancels %s", (url) => {
    expect(filterPageviewEvent(view(url), "")).toBeNull();
  });

  it("cancels every page view while a Supabase session cookie is present", () => {
    for (const cookies of [
      "sb-abcdefghij-auth-token=base64-xyz",
      "theme=dark; sb-abcdefghij-auth-token.0=part; sb-abcdefghij-auth-token.1=part",
    ]) {
      expect(hasSignedInSessionCookie(cookies)).toBe(true);
      expect(filterPageviewEvent(view("https://www.constructa.co/pricing"), cookies)).toBeNull();
    }
  });

  it("does not mistake unrelated cookies for a session", () => {
    for (const cookies of ["", "theme=dark", "sb-abcdefghij-auth-token-verifier=1", "x-sb-a-auth-token=1"]) {
      expect(hasSignedInSessionCookie(cookies)).toBe(false);
    }
  });
});
