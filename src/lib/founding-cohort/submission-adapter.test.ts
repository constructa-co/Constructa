import { afterEach, describe, expect, it, vi } from "vitest";
import { submitFoundingCohortApplication } from "./submission-adapter";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("founding cohort submission adapter", () => {
  it("no-ops in test without logging", async () => {
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
    ).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });
});
