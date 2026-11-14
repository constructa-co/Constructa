import { beforeEach, describe, expect, it, vi } from "vitest";
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
      formDataFrom({ name: "", company: "", email: "bad", trade: "", teamSize: "" }),
    );
    expect(result.status).toBe("validation_error");
    if (result.status === "validation_error") {
      expect(result.fieldErrors.email).toBeDefined();
      expect(result.fieldErrors.teamSize).toBeDefined();
    }
    expect(adapter.submit).not.toHaveBeenCalled();
  });

  it("rejects valid input when storage is not wired", async () => {
    const result = await submitFoundingCohortApplicationAction(
      { status: "idle" },
      formDataFrom({
        name: "Alex",
        company: "Smith Ltd",
        email: "alex@example.co.uk",
        trade: "Groundworks",
        teamSize: "6-10",
        note: "Keen to try proposal flow.",
      }),
    );
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.message).toMatch(/contact page/i);
    }
    expect(adapter.submit).not.toHaveBeenCalled();
  });

  it("surfaces adapter failures without throwing", async () => {
    adapter.storageWired = true;
    adapter.submit.mockRejectedValueOnce(new Error("boom"));
    const result = await submitFoundingCohortApplicationAction(
      { status: "idle" },
      formDataFrom({
        name: "Alex",
        company: "Smith Ltd",
        email: "alex@example.co.uk",
        trade: "Groundworks",
        teamSize: "1",
      }),
    );
    expect(result.status).toBe("error");
  });
});
