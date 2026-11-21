import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_APPLY_FORM_DESTINATION_ENV,
  PUBLIC_FORM_COLLECTION_ENABLED_ENV,
} from "./public-form-collection";
import { submitPublicMarketingForm } from "./public-marketing-form-submission";

afterEach(() => {
  vi.unstubAllEnvs();
});

const payload = {
  name: "Alex",
  email: "alex@example.co.uk",
  message: "Hello",
  consent: "on" as const,
};

describe("submitPublicMarketingForm", () => {
  it("refuses to collect while collection stays off", async () => {
    await expect(submitPublicMarketingForm("contact", payload)).rejects.toThrow(
      /not enabled/i,
    );
    await expect(submitPublicMarketingForm("apply", payload)).rejects.toThrow(
      /not enabled/i,
    );
  });

  it("still refuses when enabled without implemented routing", async () => {
    vi.stubEnv(PUBLIC_FORM_COLLECTION_ENABLED_ENV, "1");
    vi.stubEnv(PUBLIC_APPLY_FORM_DESTINATION_ENV, "operator-supplied-later");
    await expect(submitPublicMarketingForm("apply", payload)).rejects.toThrow(
      /not implemented/i,
    );
  });
});