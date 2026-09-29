import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireProjectAccess: vi.fn(),
}));

vi.mock("./auth-utils", () => auth);

import {
  requireEstimateAccess,
  requireEstimateComponentAccess,
  requireEstimateLineAccess,
} from "./project-resource-access";

function clientFor(tableRows: Record<string, unknown>) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: tableRows[table] ?? null,
            error: tableRows[table] ? null : { message: "not found" },
          }),
        })),
      })),
    })),
  };
}

describe("project resource access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves an estimate to an ownership-verified project", async () => {
    auth.requireAuth.mockResolvedValue({ supabase: clientFor({ estimates: { project_id: "project-1" } }) });
    auth.requireProjectAccess.mockResolvedValue({
      user: { id: "user-1" },
      supabase: { verified: true },
      project: { id: "project-1" },
    });

    await expect(requireEstimateAccess("estimate-1")).resolves.toMatchObject({
      estimateId: "estimate-1",
      projectId: "project-1",
      supabase: { verified: true },
    });
    expect(auth.requireProjectAccess).toHaveBeenCalledWith("project-1");
  });

  it("resolves a line through its estimate before verifying ownership", async () => {
    auth.requireAuth
      .mockResolvedValueOnce({ supabase: clientFor({ estimate_lines: { estimate_id: "estimate-1" } }) })
      .mockResolvedValueOnce({ supabase: clientFor({ estimates: { project_id: "project-1" } }) });
    auth.requireProjectAccess.mockResolvedValue({ supabase: { verified: true } });

    await expect(requireEstimateLineAccess("line-1")).resolves.toMatchObject({
      lineId: "line-1",
      estimateId: "estimate-1",
      projectId: "project-1",
    });
  });

  it("resolves a component through line and estimate ownership", async () => {
    auth.requireAuth
      .mockResolvedValueOnce({ supabase: clientFor({ estimate_line_components: { estimate_line_id: "line-1" } }) })
      .mockResolvedValueOnce({ supabase: clientFor({ estimate_lines: { estimate_id: "estimate-1" } }) })
      .mockResolvedValueOnce({ supabase: clientFor({ estimates: { project_id: "project-1" } }) });
    auth.requireProjectAccess.mockResolvedValue({ supabase: { verified: true } });

    await expect(requireEstimateComponentAccess("component-1")).resolves.toMatchObject({
      componentId: "component-1",
      lineId: "line-1",
      estimateId: "estimate-1",
      projectId: "project-1",
    });
  });

  it("fails closed before project verification when a parent row is missing", async () => {
    auth.requireAuth.mockResolvedValue({ supabase: clientFor({}) });

    await expect(requireEstimateLineAccess("unknown")).rejects.toThrow(
      "Unauthorized project resource access.",
    );
    expect(auth.requireProjectAccess).not.toHaveBeenCalled();
  });
});
