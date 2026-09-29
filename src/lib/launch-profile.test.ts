import { describe, expect, it } from "vitest";
import {
  getLaunchProfile,
  isCapabilityEnabled,
  isDashboardPathAllowed,
} from "./launch-profile";

describe("launch profile", () => {
  it("fails closed to the cohort profile", () => {
    expect(getLaunchProfile(undefined)).toBe("cohort");
    expect(getLaunchProfile("unexpected")).toBe("cohort");
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
  });
});
