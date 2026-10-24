import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`NEXT_REDIRECT:${path}`); } }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("@/components/project-picker", () => ({ default: () => null }));
vi.mock("./review-send-client", () => ({ default: () => null }));
vi.mock("@/lib/case-library/gate", () => ({ caseLibraryEnabled: () => false }));

import ProposalPage from "./page";

const projects = [
    { id: "job-a", name: "Saved job", proposal_introduction: "Opening for A", scope_text: "Saved scope for A" },
    { id: "job-b", name: "Brief-only job", brief_scope: "Brief for B" },
];
const estimate = { id: "estimate-a", project_id: "job-a", is_active: true };
const history = { id: "publication-a", version_number: 2 };

async function editor(projectId: string) {
    const page = await ProposalPage({ searchParams: Promise.resolve({ projectId }) });
    return page.props.children[1];
}

describe("proposal project identity boundary", () => {
    beforeEach(() => {
        mocks.createClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: "local-user" } } }) },
            from: (table: string) => {
                const filters: Record<string, string | boolean> = {};
                const result = () => ({ data: table === "estimates" ? filters.project_id === "job-a" ? [estimate] : [] : filters.project_id === "job-a" ? [history] : [] });
                const query = {
                    select: () => query,
                    eq: (key: string, value: string | boolean) => { filters[key] = value; return query; },
                    single: async () => ({ data: table === "profiles" ? { company_name: "Example company" } : projects.find(p => p.id === filters.id) }),
                    order: async () => result(),
                    then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
                };
                return query;
            },
        });
    });

    it("remounts draft, confirmation and local workspace state for the loaded job", async () => {
        const first = await editor("job-a");
        const second = await editor("job-b");
        expect(first.key).toBe("job-a");
        expect(second.key).toBe("job-b");
        expect(first.type).toBe(second.type);
    });

    it("passes each project's own saved content or brief prefill", async () => {
        expect((await editor("job-a")).props.context.project).toEqual(projects[0]);
        expect((await editor("job-b")).props.context.project).toEqual(projects[1]);
    });

    it("keeps the selected estimate and history scoped to the same job", async () => {
        const first = await editor("job-a");
        const second = await editor("job-b");
        expect(first.props.context.estimate).toEqual(estimate);
        expect(first.props.context.nextVersion).toBe(3);
        expect(second.props.context.estimate).toBeNull();
        expect(second.props.context.nextVersion).toBe(1);
        expect(second.props.publications).toEqual([]);
    });
});
