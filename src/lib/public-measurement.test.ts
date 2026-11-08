import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_MEASUREMENT_COLLECTION_ENABLED,
  __setPublicMeasurementTestSink,
  dispatchPublicMeasurementEvent,
  isPublicMeasurementRoute,
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
      pathname: "/guides/example/",
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
    const location = { pathname: "/" };
    vi.stubGlobal("window", { location });
    trackTryConstructaClick("solution");
    location.pathname = "/dashboard/projects/costs";
    trackTryConstructaClick("solution", "/");
    trackContactFormSubmitAccepted("/");
    expect(sink.mock.calls).toEqual([["TryConstructaClick", { location: "solution" }]]);
  });
});
