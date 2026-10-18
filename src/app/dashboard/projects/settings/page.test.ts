import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("./client-page", () => ({ default: () => null }));

import ProjectSettingsPage from "./page";

const first = { id: "project-a", name: "First job", project_type: "Other" };
const second = { id: "project-b", name: "Second job", project_type: "Domestic Renovation" };

describe("settings project identity", () => {
    let filters: Record<string, string>;
    let from: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        filters = {};
        const query = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((column: string, value: string) => { filters[column] = value; return query; }),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: filters.id ? [first, second].find(p => p.id === filters.id) : first })),
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

    it("retains the existing latest-job fallback only when no ID is supplied", async () => {
        const page = await ProjectSettingsPage({ searchParams: Promise.resolve({}) });
        expect(filters).toEqual({ user_id: "local-user" });
        expect(page.props.project).toBe(first);
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
});
