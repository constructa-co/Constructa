import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`NEXT_REDIRECT:${path}`); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./simple-programme-client", () => ({ default: () => null }));

import { dashboardRouteShellBody } from "@/lib/__fixtures__/dashboard-route-shell-page";
import SchedulePage from "./page";

const projects = [
    { id: "job-a", name: "Saved job", start_date: "2026-10-19", programme_phases: [{ name: "Works on site", manualDays: 15 }] },
    { id: "job-b", name: "Empty job", start_date: "2026-10-19", programme_phases: [] },
];
const estimate = { id: "estimate-a", is_active: true, project_id: "job-a" };

async function editor(projectId?: string) {
    const page = await SchedulePage({ searchParams: Promise.resolve({ projectId }) });
    return dashboardRouteShellBody(page);
}

describe("programme project identity boundary", () => {
    beforeEach(() => {
        mocks.createClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: "local-user" } } }) },
            from: (table: string) => {
                const filters: Record<string, string> = {};
                const query = {
                    select: () => query,
                    eq: (key: string, value: string) => { filters[key] = value; return query; },
                    single: async () => ({ data: projects.find(p => p.id === filters.id) }),
                    order: async () => ({ data: table === "projects" ? projects : filters.project_id === "job-a" ? [estimate] : [] }),
                };
                return query;
            },
        });
    });

    it("remounts all programme workspace state for the loaded job", async () => {
        const first = await editor("job-a");
        const second = await editor("job-b");
        expect(first.key).toBe("job-a");
        expect(second.key).toBe("job-b");
        expect(first.type).toBe(second.type);
    });

    it("passes the selected job's own programme and detailed-planner estimate", async () => {
        expect((await editor("job-a")).props.project.programme_phases).toEqual(projects[0].programme_phases);
        expect((await editor("job-a")).props.estimate).toEqual(estimate);
        expect((await editor("job-b")).props.project.programme_phases).toEqual([]);
        expect((await editor("job-b")).props.estimate).toBeNull();
    });

    it("defers the no-ID editor until browser project memory has been resolved", async () => {
        const entry = await SchedulePage({ searchParams: Promise.resolve({}) });
        expect(entry.props.path).toBe("/dashboard/projects/schedule");
        expect(entry.props.projects).toEqual(projects);
    });
});
