import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_MARKETING_INBOX_DESTINATION_ENV } from "./public-marketing-form-policy";
import { PUBLIC_FORM_COLLECTION_ENABLED_ENV } from "./public-form-collection";
import { submitPublicMarketingForm } from "./public-marketing-form-submission";

afterEach(() => {
  vi.unstubAllEnvs();
});

const payload = {
  name: "Alex",
  email: "alex@example.co.uk",
  message: "Hello",
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
    vi.stubEnv(PUBLIC_MARKETING_INBOX_DESTINATION_ENV, "operator-supplied-later");
    await expect(submitPublicMarketingForm("apply", payload)).rejects.toThrow(
      /not implemented/i,
    );
  });
});