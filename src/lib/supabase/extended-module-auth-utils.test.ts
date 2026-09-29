import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const base = vi.hoisted(() => ({
  getActiveOrganizationId: vi.fn(),
  requireAuth: vi.fn(),
  requireProjectAccess: vi.fn(),
}));

vi.mock("./auth-utils", () => base);

import {
  getActiveOrganizationId,
  requireAuth,
  requireProjectAccess,
} from "./extended-module-auth-utils";

describe("deferred module auth boundary", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects cohort calls before invoking auth or database helpers", async () => {
    await expect(requireAuth()).rejects.toThrow("not available");
    await expect(requireProjectAccess("project-1")).rejects.toThrow("not available");
    await expect(getActiveOrganizationId()).rejects.toThrow("not available");

    expect(base.requireAuth).not.toHaveBeenCalled();
    expect(base.requireProjectAccess).not.toHaveBeenCalled();
    expect(base.getActiveOrganizationId).not.toHaveBeenCalled();
  });

  it("delegates to the established guards in the full profile", async () => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
    base.requireAuth.mockResolvedValue({ user: { id: "user-1" } });
    base.requireProjectAccess.mockResolvedValue({ project: { id: "project-1" } });
    base.getActiveOrganizationId.mockResolvedValue("org-1");

    await expect(requireAuth()).resolves.toEqual({ user: { id: "user-1" } });
    await expect(requireProjectAccess("project-1")).resolves.toEqual({ project: { id: "project-1" } });
    await expect(getActiveOrganizationId()).resolves.toBe("org-1");
  });
});
