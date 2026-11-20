import { describe, expect, it } from "vitest";
import {
  PUBLIC_MARKETING_FORM_ACCESS_POLICY,
  PUBLIC_MARKETING_FORM_RETENTION_MONTHS,
  PUBLIC_MARKETING_INBOX_DESTINATION_ENV,
} from "./public-marketing-form-policy";

describe("public marketing form policy", () => {
  it("exposes the shared inbox env name without a destination value", () => {
    expect(PUBLIC_MARKETING_INBOX_DESTINATION_ENV).toBe(
      "CONSTRUCTA_PUBLIC_MARKETING_INBOX_DESTINATION",
    );
    expect(process.env[PUBLIC_MARKETING_INBOX_DESTINATION_ENV]).toBeUndefined();
  });

  it("states Rob-only access and a twelve-month retention window", () => {
    expect(PUBLIC_MARKETING_FORM_RETENTION_MONTHS).toBe(12);
    expect(PUBLIC_MARKETING_FORM_ACCESS_POLICY).toBe("rob-only");
  });
});