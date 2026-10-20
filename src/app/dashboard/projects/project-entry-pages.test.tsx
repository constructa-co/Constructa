import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const mock = vi.hoisted(() => ({ createClient: vi.fn(), reads: [] as { table: string; filters: Record<string, string> }[], signedIn: true, empty: false }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`REDIRECT:${path}`); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./brief/brief-client", () => ({ default: () => null }));
vi.mock("./costs/estimate-client", () => ({ default: () => null }));
vi.mock("./schedule/simple-programme-client", () => ({ default: () => null }));

import BriefPage from "./brief/page";
import EstimatingPage from "./costs/page";
import SchedulePage from "./schedule/page";

const projects = [
    { id: "newest-job", name: "Newest job", user_id: "owner", brief_scope: "Newest saved scope" },
    { id: "remembered-job", name: "Remembered job", user_id: "owner", brief_scope: "Remembered saved scope" },
];
type Element = ReactElement<{ children?: Element[]; projectId?: string; project?: { id: string }; projects?: typeof projects; path?: string }>;

beforeEach(() => {
    mock.reads = []; mock.signedIn = true; mock.empty = false;
    mock.createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: mock.signedIn ? { id: "owner" } : null } }) },
        from: (table: string) => {
            const filters: Record<string, string> = {};
            const record = () => { mock.reads.push({ table, filters: { ...filters } }); };
            const query = {
                select: () => query,
                eq: (column: string, value: string) => { filters[column] = value; return query; },
                order: async () => { record(); return { data: table === "projects" ? mock.empty ? [] : projects : [] }; },
                single: async () => { record(); return { data: mock.empty ? null : projects.find(p => p.id === filters.id) ?? null }; },
            };
            return query;
        },
    });
});

describe.each([
    ["brief", BriefPage], ["costs", EstimatingPage], ["schedule", SchedulePage],
] as const)("%s project entry", (route, Page) => {
    const render = async (projectId?: string) => await Page({ searchParams: Promise.resolve({ projectId }) }) as Element;

    it("resolves the no-ID URL before loading any project's editor or estimate", async () => {
        const page = await render();
        expect(page.props.path).toBe(`/dashboard/projects/${route}`);
        expect(page.props.projects).toEqual(projects);
        expect(mock.reads).toEqual([{ table: "projects", filters: { user_id: "owner" } }]);
    });

    it("keeps an explicit older job as the sole editor and navbar identity", async () => {
        const page = await render("remembered-job");
        const [nav, editor] = page.props.children!;
        expect(nav.props.projectId).toBe("remembered-job");
        expect(editor.key).toBe("remembered-job");
        expect(editor.props.project!.id).toBe("remembered-job");
        expect(mock.reads.filter(r => r.table === "projects" && r.filters.id)).toHaveLength(1);
    });

    it.each(["unknown-job", ""])("does not substitute another job for explicit ID %j", async projectId => {
        const page = await render(projectId);
        expect(page.props.projects).toBeUndefined();
        expect(page.props.path).toBeUndefined();
        expect(mock.reads.some(r => r.filters.id === "newest-job")).toBe(false);
        expect(mock.reads.some(r => r.table === "estimates")).toBe(false);
    });

    it("does not invent a project for an empty owner list", async () => {
        mock.empty = true;
        const page = await render();
        expect(page.props.projects).toBeUndefined();
        expect(mock.reads).toEqual([{ table: "projects", filters: { user_id: "owner" } }]);
    });

    it("authenticates before listing or resolving projects", async () => {
        mock.signedIn = false;
        await expect(render()).rejects.toThrow("REDIRECT:/login");
        expect(mock.reads).toEqual([]);
    });
});
