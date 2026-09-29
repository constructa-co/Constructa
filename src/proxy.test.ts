import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getUser } = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser },
  }),
}));

import { proxy } from "./proxy";

describe("proxy authentication boundary", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    getUser.mockReset();
    getUser.mockResolvedValue({ data: { user: null } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("redirects an unauthenticated dashboard request to login", async () => {
    const response = await proxy(
      new NextRequest("https://constructa.example/dashboard/home"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://constructa.example/login",
    );
  });

  it("allows an unauthenticated public route", async () => {
    const response = await proxy(
      new NextRequest("https://constructa.example/proposal/public-token"),
    );

    expect(response.status).toBe(200);
  });
});
