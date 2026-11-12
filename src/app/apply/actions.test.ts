import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitFoundingCohortApplicationAction } from "./actions";

const adapter = vi.hoisted(() => ({
  submit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/founding-cohort/submission-adapter", () => ({
  submitFoundingCohortApplication: adapter.submit,
}));

function formDataFrom(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("submitFoundingCohortApplicationAction", () => {
  beforeEach(() => {
    adapter.submit.mockClear();
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

  it("delegates valid input to the TODO adapter and succeeds", async () => {
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
    expect(result).toEqual({ status: "success" });
    expect(adapter.submit).toHaveBeenCalledOnce();
  });

  it("surfaces adapter failures without throwing", async () => {
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
