import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./client-page", () => ({ default: () => null }));

import ProjectSettingsPage from "./page";
import ProjectEntry from "@/components/project-entry";

const first = { id: "project-a", name: "First job", project_type: "Other" };
const second = { id: "project-b", name: "Second job", project_type: "Domestic Renovation" };

describe("settings project identity", () => {
    let filters: Record<string, string>;
    let from: ReturnType<typeof vi.fn>;
    let listed: typeof first[] | null;

    beforeEach(() => {
        filters = {};
        listed = [first, second];
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((column: string, value: string) => { filters[column] = value; return query; }),
            order: vi.fn(async () => ({ data: listed?.map(({ id, name }) => ({ id, name })) ?? null })),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: Object.hasOwn(filters, "id") ? [first, second].find(p => p.id === filters.id) : first })),
        };
        from = vi.fn(() => query);
        mocks.createClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: "local-user" } } }) },
            from,
        });
    });

    it("loads the selected job within the existing owner-scoped query", async () => {
        const page = await ProjectSettingsPage({ searchParams: Promise.resolve({ projectId: second.id }) });
        expect(filters).toEqual({ user_id: "local-user", id: second.id });
        expect(from).toHaveBeenCalledTimes(1);
        expect(page.props.project).toBe(second);
        expect(page.key).toBe(second.id);
    });

    it("resolves the existing owner list before mounting details when no ID is supplied", async () => {
        const page = await ProjectSettingsPage({ searchParams: Promise.resolve({}) });
        expect(filters).toEqual({ user_id: "local-user" });
        expect(page.type).toBe(ProjectEntry);
        expect(page.props.projects).toEqual([first, second].map(({ id, name }) => ({ id, name })));
        expect(page.props.path).toBe("/dashboard/projects/settings");
        expect(page.props.project).toBeUndefined();
        const query = from.mock.results[0].value;
        expect(query.select).toHaveBeenCalledExactlyOnceWith("id, name");
        expect(query.order).toHaveBeenCalledExactlyOnceWith("created_at", { ascending: false });
        expect(query.single).not.toHaveBeenCalled(); expect(query.limit).not.toHaveBeenCalled();
    });

    it("does not silently substitute another job for a missing selected ID", async () => {
        const page = await ProjectSettingsPage({ searchParams: Promise.resolve({ projectId: "missing" }) });
        expect(filters).toEqual({ user_id: "local-user", id: "missing" });
        expect(page.props.project).toBeUndefined();
        expect(page.props.children).toContain("No active project found");
    });

    it("does not query projects without an authenticated user", async () => {
        mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) }, from });
        const page = await ProjectSettingsPage({ searchParams: Promise.resolve({ projectId: second.id }) });
        expect(from).not.toHaveBeenCalled();
        expect(page.props.children).toBe("Please log in.");
    });

    it("does not substitute the newest job for an explicit blank ID", async () => {
        const page = await ProjectSettingsPage({ searchParams: Promise.resolve({ projectId: "" }) });
        expect(filters).toEqual({ user_id: "local-user", id: "" });
        expect(page.props.project).toBeUndefined();
        expect(page.props.children).toContain("No active project found");
        expect(from.mock.results[0].value.select).toHaveBeenCalledExactlyOnceWith("*");
        expect(from.mock.results[0].value.order).not.toHaveBeenCalled();
    });

    it("does not impose a new shortlist cap before browser memory resolves", async () => {
        listed = Array.from({ length: 30 }, (_, index) => ({ ...first, id: `owned-${index}` }));
        const page = await ProjectSettingsPage({ searchParams: Promise.resolve({}) });
        expect(page.props.projects).toHaveLength(30);
        expect(page.props.projects[29].id).toBe("owned-29");
        expect(from.mock.results[0].value.limit).not.toHaveBeenCalled();
        expect(from).toHaveBeenCalledTimes(1);
    });

    it.each([[], null])("keeps an empty/unavailable owner list out of the editable form: %j", async list => {
        listed = list;
        const page = await ProjectSettingsPage({ searchParams: Promise.resolve({}) });
        expect(page.type).toBe(ProjectEntry); expect(page.props.projects).toEqual([]);
        expect(page.props.project).toBeUndefined();
    });
});
