import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPublicApplyFormCollectionReady,
  isPublicContactFormCollectionReady,
  isPublicMarketingFormCollectionEnabled,
  PUBLIC_APPLY_FORM_DESTINATION_ENV,
  PUBLIC_CONTACT_FORM_DESTINATION_ENV,
  PUBLIC_FORM_COLLECTION_ENABLED_ENV,
} from "./public-form-collection";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public marketing form collection gates", () => {
  it("exposes stable env var names for enablement and destinations", () => {
    expect(PUBLIC_FORM_COLLECTION_ENABLED_ENV).toBe(
      "CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED",
    );
    expect(PUBLIC_CONTACT_FORM_DESTINATION_ENV).toBe(
      "CONSTRUCTA_PUBLIC_CONTACT_FORM_DESTINATION",
    );
    expect(PUBLIC_APPLY_FORM_DESTINATION_ENV).toBe(
      "CONSTRUCTA_PUBLIC_APPLY_FORM_DESTINATION",
    );
  });

  it("keeps collection disabled unless the enable flag is exactly 1", () => {
    expect(isPublicMarketingFormCollectionEnabled(undefined)).toBe(false);
    expect(isPublicMarketingFormCollectionEnabled("")).toBe(false);
    expect(isPublicMarketingFormCollectionEnabled("true")).toBe(false);
    expect(isPublicMarketingFormCollectionEnabled("0")).toBe(false);
    expect(isPublicMarketingFormCollectionEnabled("1")).toBe(true);
  });

  it("requires a non-empty destination before contact or apply collection is ready", () => {
    vi.stubEnv(PUBLIC_FORM_COLLECTION_ENABLED_ENV, "1");
    expect(isPublicContactFormCollectionReady()).toBe(false);
    expect(isPublicApplyFormCollectionReady()).toBe(false);

    vi.stubEnv(PUBLIC_CONTACT_FORM_DESTINATION_ENV, "   ");
    vi.stubEnv(PUBLIC_APPLY_FORM_DESTINATION_ENV, "configured-later");
    expect(isPublicContactFormCollectionReady()).toBe(false);
    expect(isPublicApplyFormCollectionReady()).toBe(true);

    vi.stubEnv(PUBLIC_CONTACT_FORM_DESTINATION_ENV, "configured-later");
    expect(isPublicContactFormCollectionReady()).toBe(true);
  });
});