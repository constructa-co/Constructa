import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLaunchProfile,
  getLaunchLandingPath,
  isCapabilityEnabled,
  isDashboardPathAllowed,
  requireLaunchCapability,
} from "./launch-profile";

describe("launch profile", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when an unsupported profile is supplied", () => {
    expect(getLaunchProfile("unexpected")).toBe("cohort");
  });

  it("reads the supported internal full profile from the environment", () => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
    expect(getLaunchProfile()).toBe("full");
  });

  it("selects the correct landing page for each profile", () => {
    expect(getLaunchLandingPath("cohort")).toBe("/dashboard");
    expect(getLaunchLandingPath("full")).toBe("/dashboard/home");
  });

  it("allows the Phase 1 cohort journey", () => {
    expect(isDashboardPathAllowed("/dashboard", "cohort")).toBe(true);
    expect(isDashboardPathAllowed("/dashboard/projects/brief", "cohort")).toBe(true);
    expect(isDashboardPathAllowed("/dashboard/projects/costs", "cohort")).toBe(true);
    expect(isDashboardPathAllowed("/dashboard/projects/schedule", "cohort")).toBe(true);
    expect(isDashboardPathAllowed("/dashboard/projects/proposal", "cohort")).toBe(true);
  });

  it("blocks later modules from the cohort", () => {
    expect(isDashboardPathAllowed("/dashboard/home", "cohort")).toBe(false);
    expect(isDashboardPathAllowed("/dashboard/projects/billing", "cohort")).toBe(false);
    expect(isDashboardPathAllowed("/dashboard/projects/contracts", "cohort")).toBe(false);
    expect(isDashboardPathAllowed("/dashboard/reporting", "cohort")).toBe(false);
  });

  it("allows all dashboard modules in the internal full profile", () => {
    expect(isDashboardPathAllowed("/dashboard/projects/billing", "full")).toBe(true);
    expect(isCapabilityEnabled("extended-modules", "full")).toBe(true);
  });

  it("keeps later capabilities disabled for cohort navigation", () => {
    expect(isCapabilityEnabled("proposal", "cohort")).toBe(true);
    expect(isCapabilityEnabled("home", "cohort")).toBe(false);
    expect(isCapabilityEnabled("extended-modules", "cohort")).toBe(false);
    expect(isCapabilityEnabled("client-boq-import", "cohort")).toBe(false);
    expect(isCapabilityEnabled("drawing-takeoff", "cohort")).toBe(false);
    expect(isCapabilityEnabled("video-walkthrough", "cohort")).toBe(false);
    expect(isCapabilityEnabled("contract-shield", "cohort")).toBe(false);
    expect(isCapabilityEnabled("benchmark-api", "cohort")).toBe(false);
  });

  it("rejects disabled capabilities before protected work begins", () => {
    expect(() => requireLaunchCapability("client-boq-import", "cohort")).toThrow(
      "This feature is not available in the current launch profile.",
    );
    expect(() => requireLaunchCapability("contract-shield", "full")).not.toThrow();
  });
});
