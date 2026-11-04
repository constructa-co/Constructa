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

    trackContactFormSubmitAccepted("/");
    trackWaitlistSubmitAttempt("/landing");
    trackTryConstructaClick("solution", "/");
    trackTryConstructaClick("not-allowed", "/");

    expect(events).toEqual([
      { event: "ContactFormSubmit", props: {} },
      { event: "WaitlistSubmitAttempt", props: {} },
      { event: "TryConstructaClick", props: { location: "solution" } },
    ]);
  });

  it("fail-closes dispatch on non-public routes and review deployments", () => {
    const events: string[] = [];
    __setPublicMeasurementTestSink((event) => {
      events.push(event);
    });

    dispatchPublicMeasurementEvent("ContactFormSubmit", {
      pathname: "/dashboard",
    });
    expect(events).toHaveLength(0);

    vi.stubEnv("CONSTRUCTA_REVIEW_ONLY", "1");
    dispatchPublicMeasurementEvent("ContactFormSubmit", { pathname: "/" });
    expect(events).toHaveLength(0);
  });

  it("does not call window.plausible while collection stays disabled", () => {
    const plausible = vi.fn();
    vi.stubGlobal("window", {
      location: { pathname: "/" },
      plausible,
    } as Window & { plausible: typeof plausible });

    trackContactFormSubmitAccepted("/");
    expect(plausible).not.toHaveBeenCalled();
  });
});
