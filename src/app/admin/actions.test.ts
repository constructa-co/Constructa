import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: dependencies.createAdminClient,
}));
vi.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: dependencies.requireAdmin,
}));
vi.mock("next/cache", () => ({
  revalidatePath: dependencies.revalidatePath,
}));

import { saveCostEntryAction, sendReportEmailAction } from "./actions";

function costForm() {
  const form = new FormData();
  form.set("month", "2026-09");
  form.set("category", "Tools");
  form.set("description", "Test cost");
  form.set("amount_gbp", "12.50");
  return form;
}

function reportForm() {
  const form = new FormData();
  form.set("to", "recipient@example.test");
  form.set("subject", "Constructa report");
  form.set("body", "Report body");
  return form;
}

describe("privileged admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  for (const identity of ["unauthenticated", "non-admin"] as const) {
    it(`blocks ${identity} cost writes before creating an admin client`, async () => {
      dependencies.requireAdmin.mockRejectedValue(
        new Error("Unauthorized admin access."),
      );

      await expect(saveCostEntryAction(costForm())).resolves.toEqual({
        success: false,
        error: "An unexpected error occurred",
      });
      expect(dependencies.createAdminClient).not.toHaveBeenCalled();
    });

    it(`blocks ${identity} report sends before calling the provider`, async () => {
      dependencies.requireAdmin.mockRejectedValue(
        new Error("Unauthorized admin access."),
      );
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await expect(sendReportEmailAction(reportForm())).resolves.toEqual({
        success: false,
        error: "An unexpected error occurred",
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  }

  it("allows the configured admin to write a validated cost", async () => {
    dependencies.requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    const insert = vi.fn().mockResolvedValue({ error: null });
    dependencies.createAdminClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    });

    await expect(saveCostEntryAction(costForm())).resolves.toEqual({
      success: true,
    });
    expect(insert).toHaveBeenCalledWith({
      month: "2026-09-01",
      category: "Tools",
      description: "Test cost",
      amount_gbp: 12.5,
    });
  });

  it("allows the configured admin to send a validated report", async () => {
    dependencies.requireAdmin.mockResolvedValue({ user: { id: "admin-1" } });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 202 }),
    );

    await expect(sendReportEmailAction(reportForm())).resolves.toEqual({
      success: true,
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });
});
