import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_APPLY_FORM_DESTINATION_ENV,
  PUBLIC_FORM_COLLECTION_ENABLED_ENV,
} from "@/lib/marketing/public-form-collection";
import {
  hasFoundingCohortApplicationStorageAdapter,
  submitFoundingCohortApplication,
} from "./submission-adapter";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("founding cohort submission adapter", () => {
  it("reports that storage is not wired while collection stays off", () => {
    expect(hasFoundingCohortApplicationStorageAdapter()).toBe(false);
  });

  it("refuses submit while collection is off", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(
      submitFoundingCohortApplication({
        name: "Alex",
        company: "Smith Ltd",
        email: "alex@example.com",
        message: "Interested",
        consent: "on",
      }),
    ).rejects.toThrow(/not enabled/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses submit when enabled but destination routing is not implemented", async () => {
    vi.stubEnv(PUBLIC_FORM_COLLECTION_ENABLED_ENV, "1");
    vi.stubEnv(PUBLIC_APPLY_FORM_DESTINATION_ENV, "operator-supplied-later");
    await expect(
      submitFoundingCohortApplication({
        name: "Alex",
        email: "alex@example.com",
        message: "Interested",
        consent: "on",
      }),
    ).rejects.toThrow(/not implemented/i);
  });
});