import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const current = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[],
    pathname: "/dashboard/projects/proposal", query: "", theme: "dark",
    replace: vi.fn(), getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), dispatch: vi.fn(),
    signedIn: true, empty: false, fail: "" as "" | "list" | "single",
    reads: [] as { table: string; selected: string; filters: Record<string, string>; ordered: { column: string; ascending: boolean | null } | null; limited: number | null }[],
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? next(current.slots[i]) : next; }];
    },
    useRef: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = { current: initial };
        return current.slots[i];
    },
    useEffect: (effect: () => void) => { current.effects.push(effect); },
    useEffectEvent: (callback: unknown) => callback,
}));
vi.mock("next/navigation", () => ({
    redirect: (path: string) => { throw Error(`REDIRECT:${path}`); },
    useRouter: () => ({ replace: current.replace }),
    usePathname: () => current.pathname,
    useSearchParams: () => new URLSearchParams(current.query),
}));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));
vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: current.signedIn ? { id: "owner" } : null } }) },
        from: (table: string) => {
            const filters: Record<string, string> = {};
            let selected = "";
            let ordered: { column: string; ascending: boolean | null } | null = null;
            let limited: number | null = null;
            const finish = () => {
                current.reads.push({ table, selected, filters: { ...filters }, ordered, limited });
                if (current.fail === "list" && table === "projects" && !("id" in filters)) return { data: null, error: { message: "read failed" } };
                if (current.fail === "single" && table === "projects" && "id" in filters) return { data: null, error: { message: "read failed" } };
                if (table === "projects" && !("id" in filters)) {
                    const visible = current.empty ? [] : filters.user_id ? rows.filter(row => row.user_id === filters.user_id) : rows;
                    const data = selected === "id, name" ? visible.map(({ id, name }) => ({ id, name })) : visible;
                    return { data, error: null };
                }
                if (table === "projects") {
                    const data = rows.find(row => row.id === filters.id && row.user_id === filters.user_id) ?? null;
                    return { data, error: data ? null : { message: "not found" } };
                }
                if (table === "estimates") return { data: filters.project_id === "remembered-job" ? [estimate] : [], error: null };
                if (table === "profiles") return { data: { company_name: "Example company", case_studies: [] }, error: null };
                if (table === "proposal_publications") return { data: [], error: null };
                return { data: null, error: { message: "unread table" } };
            };
            const query = {
                select: (cols: string) => { selected = cols; return query; },
                eq: (column: string, value: string | boolean) => { filters[column] = String(value); return query; },
                order: (column: string, options?: { ascending?: boolean }) => { ordered = { column, ascending: options?.ascending ?? null }; return query; },
                limit: (count: number) => { limited = count; return query; },
                single: async () => finish(),
                then: (resolve: (value: ReturnType<typeof finish>) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(finish()).then(resolve, reject),
            };
            return query;
        },
    }),
}));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./review-send-client", () => ({ default: () => null }));

import ProjectEntry from "@/components/project-entry";
import { BEFORE_PROJECT_NAVIGATION } from "@/lib/project-navigation";
import ProposalPage from "./page";

const owned = [
    { id: "newest-job", name: "Newest job", user_id: "owner" },
    ...Array.from({ length: 24 }, (_, index) => ({ id: `job-${index}`, name: `Job ${index}`, user_id: "owner" })),
    { id: "remembered-job", name: "Remembered job", user_id: "owner" },
];
const foreign = { id: "foreign-job", name: "Foreign job", user_id: "other-owner" };
const rows = [...owned, foreign];
const estimate = { id: "estimate-1", project_id: "remembered-job", is_active: true, estimate_lines: [] };
const path = "/dashboard/projects/proposal";
type Element = ReactElement<{ children?: Element[] | string; projects?: { id: string; name: string | null }[]; path?: string; context?: { project: { id: string } } }>;
const listed = owned.map(({ id, name }) => ({ id, name }));

function render(projectId?: string) {
    const searchParams = projectId === undefined ? {} : { projectId };
    return ProposalPage({ searchParams: Promise.resolve(searchParams) }) as Promise<Element>;
}
function view(list: { id: string; name: string | null }[] = listed) {
    current.cursor = 0; current.effects = [];
    return ProjectEntry({ projects: list, path });
}
function effects() { current.effects.forEach(effect => effect()); }
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (typeof value === "string") return value;
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}

beforeEach(() => {
    current.slots = []; current.cursor = 0; current.effects = []; current.pathname = path; current.query = ""; current.theme = "dark";
    current.signedIn = true; current.empty = false; current.fail = ""; current.reads = [];
    current.replace.mockReset(); current.getItem.mockReset().mockReturnValue(null); current.dispatch.mockReset().mockReturnValue(true);
    current.setItem.mockReset(); current.removeItem.mockReset();
    vi.stubGlobal("window", {
        localStorage: { getItem: current.getItem, setItem: current.setItem, removeItem: current.removeItem },
        dispatchEvent: current.dispatch, location: { hash: "" },
    });
});
afterEach(() => {
    expect(current.setItem).not.toHaveBeenCalled();
    expect(current.removeItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
});

describe("proposal absent-id entry", () => {
    it("reads the uncapped owned id and name list, newest first, and mounts no editor", async () => {
        const page = await render();
        expect(page.type).toBe(ProjectEntry);
        expect(page.props.path).toBe(path);
        expect(page.props.projects).toEqual(listed);
        expect(listed).toHaveLength(26);
        expect(current.reads).toEqual([{
            table: "projects", selected: "id, name", filters: { user_id: "owner" },
            ordered: { column: "created_at", ascending: false }, limited: null,
        }]);
    });

    it("passes an empty owner list through and does not invent a row", async () => {
        current.empty = true;
        const page = await render();
        expect(page.type).toBe(ProjectEntry);
        expect(page.props.projects).toEqual([]);
        expect(current.reads).toEqual([{
            table: "projects", selected: "id, name", filters: { user_id: "owner" },
            ordered: { column: "created_at", ascending: false }, limited: null,
        }]);
    });

    it("passes no row when the owned list read fails", async () => {
        current.fail = "list";
        const page = await render();
        expect(page.type).toBe(ProjectEntry);
        expect(page.props.projects).toEqual([]);
        expect(current.reads.map(read => read.table)).toEqual(["projects"]);
        expect(current.reads.some(read => read.limited != null || read.table !== "projects")).toBe(false);
    });

    it.each(["", "unknown-job", "foreign-job"])("does not replace explicit id %j", async projectId => {
        const page = await render(projectId);
        expect(page.type).toBe("div");
        expect(page.props.children).toBe("Project not found.");
        expect(page.props.projects).toBeUndefined();
        expect(current.reads).toEqual([{
            table: "projects", selected: "*", filters: { id: projectId, user_id: "owner" }, ordered: null, limited: null,
        }]);
    });

    it("keeps an owned explicit id, including one past the old 25, on the single-project read", async () => {
        const page = await render("remembered-job");
        const editor = (page.props.children as Element[])[1];
        expect(page.type).not.toBe(ProjectEntry);
        expect(editor.key).toBe("remembered-job");
        expect(editor.props.context!.project.id).toBe("remembered-job");
        expect(current.reads[0]).toEqual({
            table: "projects", selected: "*", filters: { id: "remembered-job", user_id: "owner" }, ordered: null, limited: null,
        });
        expect(current.reads.map(read => read.table)).toEqual(["projects", "estimates", "profiles", "proposal_publications"]);
        expect(current.reads.some(read => read.limited != null || read.selected === "id, name")).toBe(false);
    });

    it("does not replace an explicit id when that single read fails", async () => {
        current.fail = "single";
        const page = await render("remembered-job");
        expect(page.props.children).toBe("Project not found.");
        expect(page.props.projects).toBeUndefined();
        expect(current.reads).toEqual([{
            table: "projects", selected: "*", filters: { id: "remembered-job", user_id: "owner" }, ordered: null, limited: null,
        }]);
    });

    it("authenticates before listing or resolving a project", async () => {
        current.signedIn = false;
        await expect(render()).rejects.toThrow("REDIRECT:/login");
        expect(current.reads).toEqual([]);
    });
});

describe("proposal ProjectEntry effect", () => {
    it("opens a remembered owned job past 25 and keeps the other query and hash", () => {
        current.query = "tab=send&view=details";
        window.location.hash = "#terms";
        current.getItem.mockReturnValue("remembered-job");
        view(); effects();
        expect(current.replace).toHaveBeenCalledExactlyOnceWith(`${path}?tab=send&view=details&projectId=remembered-job#terms`, { scroll: false });
        expect(current.getItem).toHaveBeenCalledExactlyOnceWith("constructa_selected_project_id");
    });

    it("does not replace the URL when the navigation guard cancels", () => {
        const target = new EventTarget();
        target.addEventListener(BEFORE_PROJECT_NAVIGATION, event => event.preventDefault());
        current.dispatch.mockImplementation(event => target.dispatchEvent(event));
        current.getItem.mockReturnValue("remembered-job");
        view(); effects();
        expect(current.replace).not.toHaveBeenCalled();
        expect((current.dispatch.mock.calls[0][0] as Event).type).toBe(BEFORE_PROJECT_NAVIGATION);
    });

    it.each(["foreign-job", "deleted-job"])("uses the newest owned job when memory is %j", memory => {
        current.getItem.mockReturnValue(memory);
        view(); effects();
        expect(current.replace).toHaveBeenCalledExactlyOnceWith(`${path}?projectId=newest-job`, { scroll: false });
    });

    it("does not invent a job from an empty list", () => {
        view([]); effects();
        expect(current.replace).not.toHaveBeenCalled();
        expect(current.dispatch).not.toHaveBeenCalled();
        expect(text(view([]))).toContain("No projects are available");
    });

    it.each(["projectId=remembered-job", "projectId=", "projectId=foreign-job", "projectId=unknown-job"])("never replaces an explicit URL: %s", query => {
        current.query = query;
        view(); effects();
        expect(current.replace).not.toHaveBeenCalled();
        expect(current.getItem).not.toHaveBeenCalled();
        expect(current.dispatch).not.toHaveBeenCalled();
    });
});
