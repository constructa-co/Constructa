import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("./server", () => server);

import { requireAdmin } from "./admin-auth";

function clientWithUser(
  user: { id: string; email?: string } | null,
  error: { message: string } | null = null,
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
    },
  };
}

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_EMAIL", "owner@constructa.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed before session lookup when ADMIN_EMAIL is absent", async () => {
    vi.stubEnv("ADMIN_EMAIL", "");

    await expect(requireAdmin()).rejects.toThrow("Unauthorized admin access.");
    expect(server.createClient).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    server.createClient.mockResolvedValue(clientWithUser(null));

    await expect(requireAdmin()).rejects.toThrow("Unauthorized admin access.");
  });

  it("rejects an authenticated non-admin", async () => {
    server.createClient.mockResolvedValue(
      clientWithUser({ id: "user-2", email: "other@constructa.test" }),
    );

    await expect(requireAdmin()).rejects.toThrow("Unauthorized admin access.");
  });

  it("returns the configured admin identity", async () => {
    const client = clientWithUser({
      id: "user-1",
      email: "Owner@Constructa.Test",
    });
    server.createClient.mockResolvedValue(client);

    await expect(requireAdmin()).resolves.toMatchObject({
      user: { id: "user-1", email: "Owner@Constructa.Test" },
      supabase: client,
    });
  });
});
