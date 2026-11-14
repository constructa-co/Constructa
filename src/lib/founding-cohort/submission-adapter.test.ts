import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hasFoundingCohortApplicationStorageAdapter,
  submitFoundingCohortApplication,
} from "./submission-adapter";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("founding cohort submission adapter", () => {
  it("reports that storage is not wired", () => {
    expect(hasFoundingCohortApplicationStorageAdapter()).toBe(false);
  });

  it("refuses submit while storage is not wired", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(
      submitFoundingCohortApplication({
        name: "Alex",
        company: "Smith Ltd",
        email: "alex@example.com",
        trade: "Roofing",
        teamSize: "2-5",
        note: undefined,
      }),
    ).rejects.toThrow(/not wired/i);
    expect(spy).not.toHaveBeenCalled();
  });
});
