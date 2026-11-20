import { describe, expect, it, vi } from "vitest";
import { submitContactMarketingFormAction } from "./actions";

function formDataFrom(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("submitContactMarketingFormAction", () => {
  it("returns validation errors for incomplete input", async () => {
    const result = await submitContactMarketingFormAction(
      { status: "idle" },
      formDataFrom({ name: "", email: "bad", message: "", consent: "" }),
    );
    expect(result.status).toBe("validation_error");
    if (result.status === "validation_error") {
      expect(result.fieldErrors.email).toBeDefined();
      expect(result.fieldErrors.consent).toBeDefined();
    }
  });

  it("rejects valid input while collection is off", async () => {
    const result = await submitContactMarketingFormAction(
      { status: "idle" },
      formDataFrom({
        name: "Alex",
        email: "alex@example.co.uk",
        message: "Hello",
        consent: "on",
      }),
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/collection is turned off/i);
    }
  });
});