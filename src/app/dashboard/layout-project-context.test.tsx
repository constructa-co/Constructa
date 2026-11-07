import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ createClient: vi.fn(), signedIn: true, filters: [] as unknown[][], limits: [] as number[] }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw Error(`REDIRECT:${path}`); } }));
vi.mock("@/lib/theme-context", () => ({ ThemeProvider: () => null }));
vi.mock("@/components/dashboard-shell", () => ({ default: () => null }));
vi.mock("sonner", () => ({ Toaster: () => null }));
import DashboardLayout from "./layout";

const projects = Array.from({ length: 26 }, (_, i) => ({ id: `job-${i}`, name: `Job ${i}`, client_name: "QA" }));
beforeEach(() => {
    mock.signedIn = true; mock.filters = []; mock.limits = [];
    mock.createClient.mockResolvedValue({
        auth: { getUser: async () => ({ data: { user: mock.signedIn ? { id: "owner", email: "qa@example.invalid" } : null } }) },
        from: (table: string) => {
            const query = {
                select: () => query,
                eq: (...args: unknown[]) => { mock.filters.push([table, ...args]); return query; },
                single: async () => ({ data: { theme_preference: "dark" } }),
                order: () => {
                    const result = Promise.resolve({ data: projects });
                    return Object.assign(result, { limit: (n: number) => { mock.limits.push(n); return Promise.resolve({ data: projects.slice(0, n) }); } });
                },
            };
            return query;
        },
    });
});

describe("dashboard owner project context", () => {
    it("passes the same owner-scoped project list to the sidebar, not just the newest twenty", async () => {
        const layout = await DashboardLayout({ children: <div>Workspace</div> });
        const shell = layout.props.children[0];
        expect(shell.props.projects).toEqual(projects);
        expect(mock.limits).toEqual([]);
        expect(mock.filters).toContainEqual(["projects", "user_id", "owner"]);
        expect(mock.filters).toContainEqual(["profiles", "id", "owner"]);
        expect(layout.props.initialTheme).toBe("dark");
    });
    it("authenticates before reading project or profile context", async () => {
        mock.signedIn = false;
        await expect(DashboardLayout({ children: null })).rejects.toThrow("REDIRECT:/login");
        expect(mock.filters).toEqual([]);
    });
});
