import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`NEXT_REDIRECT:${path}`); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./estimate-client", () => ({ default: () => null }));

import EstimatingPage from "./page";

const projects = [{ id: "job-a", name: "First job" }, { id: "job-b", name: "Empty job" }];
const saved = { id: "estimate-a", project_id: "job-a", estimate_lines: [{ id: "line-a", description: "First job only" }] };

async function editor(projectId?: string) {
    const page = await EstimatingPage({ searchParams: Promise.resolve({ projectId }) });
    return page.props.children[1];
}

describe("estimating project identity boundary", () => {
    beforeEach(() => {
        mocks.createClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: "local-user" } } }) },
            from: (table: string) => {
                const filters: Record<string, string> = {};
                const query = {
                    select: () => query,
                    eq: (key: string, value: string) => { filters[key] = value; return query; },
                    single: async () => ({ data: projects.find(p => p.id === filters.id) }),
                    order: async () => ({ data: table === "projects" ? projects : filters.project_id === "job-a" ? [saved] : [] }),
                };
                return query;
            },
        });
    });

    it("remounts the pricing state for each loaded job", async () => {
        const first = await editor("job-a");
        const second = await editor("job-b");
        expect(first.key).toBe("job-a");
        expect(second.key).toBe("job-b");
        expect(first.type).toBe(second.type);
    });

    it("passes only the selected job's saved estimates, including an empty list", async () => {
        expect((await editor("job-a")).props.estimates[0].id).toBe("estimate-a");
        expect((await editor("job-b")).props.estimates).toEqual([]);
    });

    it("defers the no-ID editor until browser project memory has been resolved", async () => {
        const entry = await EstimatingPage({ searchParams: Promise.resolve({}) });
        expect(entry.props.path).toBe("/dashboard/projects/costs");
        expect(entry.props.projects).toEqual(projects);
    });
});
