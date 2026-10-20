import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`NEXT_REDIRECT:${path}`); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./brief-client", () => ({ default: () => null }));

import BriefPage from "./page";

const projects = {
    "project-a": { id: "project-a", name: "First job", brief_scope: "First saved description", start_date: "2026-10-20", potential_value: 1000 },
    "project-b": { id: "project-b", name: "Second job", brief_scope: "Second saved description", start_date: "2026-11-02", potential_value: 2000 },
};

async function editor(projectId?: keyof typeof projects) {
    const page = await BriefPage({ searchParams: Promise.resolve({ projectId }) });
    return page.props.children[1];
}

describe("brief project identity boundary", () => {
    beforeEach(() => {
        mocks.createClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: "local-user" } } }) },
            from: () => ({ select: () => ({ eq: (_column: string, value: keyof typeof projects) => ({
                order: async () => ({ data: Object.values(projects) }),
                single: async () => ({ data: projects[value] }),
            }) }) }),
        });
    });

    it("keys the editor to the loaded project, not the shared brief route", async () => {
        const first = await editor("project-a");
        const second = await editor("project-b");
        expect(first.type).toBe(second.type);
        expect(first.key).toBe("project-a");
        expect(second.key).toBe("project-b");
        expect(second.key).not.toBe(first.key);
    });

    it("passes each project's saved prefill through without duplicating or clearing it", async () => {
        for (const id of ["project-a", "project-b"] as const) {
            const rendered = await editor(id);
            expect(rendered.props.project).toMatchObject({
                id,
                name: projects[id].name,
                brief_scope: projects[id].brief_scope,
                start_date: projects[id].start_date,
                potential_value: projects[id].potential_value,
            });
        }
    });

    it("defers the no-ID editor until browser project memory has been resolved", async () => {
        const entry = await BriefPage({ searchParams: Promise.resolve({}) });
        expect(entry.props.path).toBe("/dashboard/projects/brief");
        expect(entry.props.projects).toEqual(Object.values(projects));
    });
});
