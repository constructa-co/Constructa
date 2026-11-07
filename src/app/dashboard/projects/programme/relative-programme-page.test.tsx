import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";

const mocks = vi.hoisted(() => ({ client: null as unknown, live: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => mocks.client }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("./programme-client", () => ({ default: () => { mocks.live(); return <div>Live dated controls</div>; } }));
import Page from "./page";

const id = "11111111-1111-4111-8111-111111111111";
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => mocks.live.mockClear());

it("renders relative activities read-only instead of feeding them to date tracking", async () => {
    const db = fakeSupabase({ projects: [{ id, user_id: user, name: "Kitchen", start_date: "2026-10-19", programme_phases: [
        { name: "Fit kitchen", timeBasis: "relative_working_days", workingDayOffset: 0, manualDays: 5 },
    ] }] });
    mocks.client = { ...db.client, auth: { getUser: async () => ({ data: { user: { id: user } } }) } };
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ projectId: id }) }));
    expect(html).toContain("data-relative-live-programme"); expect(html).toContain("Day 1 to Day 5");
    expect(html).toContain(`schedule?projectId=${id}`); expect(html).not.toContain("19 Oct");
    expect(mocks.live).not.toHaveBeenCalled(); expect(db.updates).toEqual([]);
});

it("keeps the existing live dated screen for ordinary dated programmes", async () => {
    const db = fakeSupabase({ projects: [{ id, user_id: user, name: "Kitchen", start_date: "2026-10-19", programme_phases: [
        { name: "Fit kitchen", startOffset: 0, manualDays: 5 },
    ] }] });
    mocks.client = { ...db.client, auth: { getUser: async () => ({ data: { user: { id: user } } }) } };
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ projectId: id }) }));
    expect(html).toContain("Live dated controls"); expect(mocks.live).toHaveBeenCalledOnce();
    expect(db.updates).toEqual([]);
});
