import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryOutcome = { data: unknown; error: { message?: string } | null };

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  outcomes: new Map<string, QueryOutcome>(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  unstable_rethrow: (error: unknown) => {
    if (error instanceof Error && error.message.startsWith("NEXT_")) throw error;
  },
}));
vi.mock("next/link", () => ({
  default: (props: { href: string; children?: ReactNode }) =>
    createElement("a", { href: props.href }, props.children),
}));
vi.mock("./portfolio-client", () => ({
  default: (props: { projects: unknown[] }) =>
    createElement("div", {
      "data-portfolio-client": "stub",
      "data-project-count": String(props.projects.length),
    }),
}));

import ResourcePortfolioPage from "./page";

const TABLES = ["projects", "staff_resources", "resource_allocations", "staff_absence", "estimates"] as const;

function makeChain(outcome: QueryOutcome) {
  const chain: Record<string, unknown> = {};
  const next = () => chain;
  chain.select = next;
  chain.eq = next;
  chain.not = next;
  chain.gte = next;
  chain.order = () => Promise.resolve(outcome);
  return chain;
}

function wireSupabase(options?: { user?: { id: string } | null }) {
  const user = options && "user" in options ? options.user : { id: "user-1" };
  mocks.outcomes.clear();
  for (const table of TABLES) {
    mocks.outcomes.set(table, { data: [], error: null });
  }
  mocks.createClient.mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: (table: string) => makeChain(mocks.outcomes.get(table) ?? { data: [], error: null }),
  });
}

function setOutcome(table: (typeof TABLES)[number], outcome: QueryOutcome) {
  mocks.outcomes.set(table, outcome);
}

async function renderPage(configure?: () => void) {
  wireSupabase();
  configure?.();
  return renderToStaticMarkup(await ResourcePortfolioPage());
}

describe("Resource portfolio page read outcomes (A020)", () => {
  beforeEach(() => {
    mocks.createClient.mockReset();
    mocks.redirect.mockClear();
  });

  it("redirects when there is no signed-in user", async () => {
    wireSupabase({ user: null });
    await expect(ResourcePortfolioPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("shows unavailable instead of a zero-looking dashboard when a required read returns an error", async () => {
    const markup = await renderPage(() => {
      setOutcome("projects", { data: null, error: { message: "connection failure" } });
    });
    expect(markup).toMatch(/role="alert"/);
    expect(markup).toMatch(/resource portfolio could not be loaded/i);
    expect(markup).toMatch(/href="\/dashboard\/resources\/portfolio"/);
    expect(markup).not.toMatch(/data-portfolio-client="stub"/);
    expect(markup).not.toMatch(/connection failure/i);
  });

  it("fails closed when any one of the five reads errors, without surfacing database details", async () => {
    const markup = await renderPage(() => {
      setOutcome("staff_absence", { data: [], error: { message: "permission denied" } });
    });
    expect(markup).toMatch(/resource portfolio could not be loaded/i);
    expect(markup).not.toMatch(/data-portfolio-client="stub"/);
    expect(markup).not.toMatch(/permission denied/i);
  });

  it("renders the portfolio client with legitimate empty data when all reads succeed", async () => {
    const markup = await renderPage();
    expect(markup).toMatch(/data-portfolio-client="stub"/);
    expect(markup).toMatch(/data-project-count="0"/);
    expect(markup).not.toMatch(/resource portfolio could not be loaded/i);
  });

  it("passes successful project rows to the client when reads succeed", async () => {
    const markup = await renderPage(() => {
      setOutcome("projects", {
        data: [{ id: "p1", name: "Kitchen", client_name: "A", status: "active", start_date: "2026-01-01", programme_phases: null }],
        error: null,
      });
    });
    expect(markup).toMatch(/data-project-count="1"/);
    expect(markup).not.toMatch(/resource portfolio could not be loaded/i);
  });
});