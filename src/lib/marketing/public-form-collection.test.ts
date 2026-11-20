import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_MARKETING_INBOX_DESTINATION_ENV } from "./public-marketing-form-policy";
import {
  isPublicApplyFormCollectionReady,
  isPublicContactFormCollectionReady,
  isPublicMarketingFormCollectionReady,
  isPublicMarketingInboxDestinationConfigured,
  PUBLIC_APPLY_FORM_DESTINATION_ENV,
  PUBLIC_CONTACT_FORM_DESTINATION_ENV,
  PUBLIC_FORM_COLLECTION_ENABLED_ENV,
} from "./public-form-collection";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("public marketing form collection gates", () => {
  it("exposes one shared inbox env for contact and apply", () => {
    expect(PUBLIC_FORM_COLLECTION_ENABLED_ENV).toBe(
      "CONSTRUCTA_PUBLIC_FORM_COLLECTION_ENABLED",
    );
    expect(PUBLIC_MARKETING_INBOX_DESTINATION_ENV).toBe(
      "CONSTRUCTA_PUBLIC_MARKETING_INBOX_DESTINATION",
    );
    expect(PUBLIC_CONTACT_FORM_DESTINATION_ENV).toBe(
      PUBLIC_MARKETING_INBOX_DESTINATION_ENV,
    );
    expect(PUBLIC_APPLY_FORM_DESTINATION_ENV).toBe(
      PUBLIC_MARKETING_INBOX_DESTINATION_ENV,
    );
  });

  it("keeps collection disabled unless the enable flag is exactly 1", () => {
    expect(isPublicMarketingFormCollectionReady(undefined, "inbox")).toBe(false);
    vi.stubEnv(PUBLIC_FORM_COLLECTION_ENABLED_ENV, "true");
    expect(isPublicMarketingFormCollectionReady()).toBe(false);
    vi.stubEnv(PUBLIC_FORM_COLLECTION_ENABLED_ENV, "1");
    expect(isPublicMarketingFormCollectionReady()).toBe(false);
    vi.stubEnv(PUBLIC_MARKETING_INBOX_DESTINATION_ENV, "operator-value-later");
    expect(isPublicMarketingFormCollectionReady()).toBe(true);
  });

  it("requires a non-empty inbox destination before contact or apply is ready", () => {
    vi.stubEnv(PUBLIC_FORM_COLLECTION_ENABLED_ENV, "1");
    expect(isPublicContactFormCollectionReady()).toBe(false);
    expect(isPublicApplyFormCollectionReady()).toBe(false);
    expect(isPublicMarketingInboxDestinationConfigured("  ")).toBe(false);

    vi.stubEnv(PUBLIC_MARKETING_INBOX_DESTINATION_ENV, "operator-value-later");
    expect(isPublicContactFormCollectionReady()).toBe(true);
    expect(isPublicApplyFormCollectionReady()).toBe(true);
  });
});