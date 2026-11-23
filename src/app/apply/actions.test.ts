import { beforeEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_MARKETING_INBOX_DESTINATION_ENV } from "@/lib/marketing/public-marketing-form-policy";
import { PUBLIC_FORM_COLLECTION_ENABLED_ENV } from "@/lib/marketing/public-form-collection";
import { submitFoundingCohortApplicationAction } from "./actions";

const adapter = vi.hoisted(() => ({
  submit: vi.fn(async () => undefined),
  storageWired: false,
}));

vi.mock("@/lib/founding-cohort/submission-adapter", () => ({
  submitFoundingCohortApplication: adapter.submit,
  hasFoundingCohortApplicationStorageAdapter: () => adapter.storageWired,
}));

function formDataFrom(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("submitFoundingCohortApplicationAction", () => {
  beforeEach(() => {
    adapter.submit.mockClear();
    adapter.storageWired = false;
  });

  it("returns validation errors for incomplete input", async () => {
    const result = await submitFoundingCohortApplicationAction(
      { status: "idle" },
      formDataFrom({ name: "", email: "bad", message: "" }),
    );
    expect(result.status).toBe("validation_error");
    if (result.status === "validation_error") {
      expect(result.fieldErrors.email).toBeDefined();
      expect("consent" in result.fieldErrors).toBe(false);
    }
    expect(adapter.submit).not.toHaveBeenCalled();
  });

  it("rejects valid input when collection is off", async () => {
    const result = await submitFoundingCohortApplicationAction(
      { status: "idle" },
      formDataFrom({
        name: "Alex",
        company: "Smith Ltd",
        email: "alex@example.co.uk",
        message: "Keen to try proposal flow.",
      }),
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/collection is turned off/i);
    }
    expect(adapter.submit).not.toHaveBeenCalled();
  });

  it("surfaces adapter failures without throwing", async () => {
    vi.stubEnv(PUBLIC_FORM_COLLECTION_ENABLED_ENV, "1");
    vi.stubEnv(PUBLIC_MARKETING_INBOX_DESTINATION_ENV, "operator-supplied-later");
    adapter.storageWired = true;
    adapter.submit.mockRejectedValueOnce(new Error("boom"));
    const result = await submitFoundingCohortApplicationAction(
      { status: "idle" },
      formDataFrom({
        name: "Alex",
        email: "alex@example.co.uk",
        message: "Hello",
      }),
    );
    expect(result.status).toBe("error");
  });
});