import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const current = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0, effects: [] as (() => unknown)[], query: "", pathname: "/dashboard/projects/brief", push: vi.fn(), dispatch: vi.fn(),
    storage: new Map<string, string>(),
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
    useEffect: (effect: () => unknown) => { current.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: current.push }), usePathname: () => current.pathname, useSearchParams: () => new URLSearchParams(current.query) }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));
import SidebarNav, { ProjectPickerControls } from "./sidebar-nav";
import { BEFORE_PROJECT_NAVIGATION } from "@/lib/project-navigation";

type Element = ReactElement<Record<string, unknown>>;
const projects = Array.from({ length: 26 }, (_, i) => ({ id: `job-${i}`, name: `Current name ${i}` }));
function view() {
    current.cursor = 0; current.effects = [];
    return SidebarNav({ user: {}, projects });
}
function effects() { current.effects.forEach(effect => effect()); }
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function picker() { return nodes(view()).find(node => node.type === ProjectPickerControls)!; }

beforeEach(() => {
    current.slots = []; current.cursor = 0; current.effects = []; current.storage.clear(); current.query = ""; current.pathname = "/dashboard/projects/brief";
    current.push.mockReset(); current.dispatch.mockReset().mockReturnValue(true);
    const storage = {
        getItem: (key: string) => current.storage.get(key) ?? null,
        setItem: (key: string, value: string) => { current.storage.set(key, value); },
        removeItem: (key: string) => { current.storage.delete(key); },
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { dispatchEvent: current.dispatch });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("actual sidebar project context and existing guards", () => {
    it.each([null, "Stale old name"])("retains an owner-listed remembered ID with cached name %j and uses the current owner name", name => {
        current.storage.set("constructa_selected_project_id", "job-25");
        if (name) current.storage.set("constructa_selected_project_name", name);
        view(); effects();
        expect(picker().props.name).toBe("Current name 25");
        expect(current.storage.get("constructa_selected_project_id")).toBe("job-25");
        expect(current.push).not.toHaveBeenCalled();
    });
    it("synchronises an explicit canonical URL into the sidebar and existing cache", () => {
        current.storage.set("constructa_selected_project_id", "job-0");
        current.storage.set("constructa_selected_project_name", "Old job 0");
        current.query = "projectId=job-25&tab=saved-version";
        view(); effects();
        expect(picker().props.name).toBe("Current name 25");
        expect(current.storage.get("constructa_selected_project_id")).toBe("job-25");
        expect(current.storage.get("constructa_selected_project_name")).toBe("Current name 25");
        expect(current.push).not.toHaveBeenCalled();
    });
    it("does not adopt a remembered ID outside the owner list", () => {
        current.storage.set("constructa_selected_project_id", "another-owner");
        current.storage.set("constructa_selected_project_name", "Untrusted name");
        view(); effects();
        expect(picker().props.selected).toBe(false);
        expect(current.storage.has("constructa_selected_project_id")).toBe(false);
    });
    it("preserves the existing cancellable clear guard and remembered selection", () => {
        current.query = "projectId=job-25"; view(); effects();
        const target = new EventTarget();
        target.addEventListener(BEFORE_PROJECT_NAVIGATION, event => event.preventDefault());
        current.dispatch.mockImplementation(event => target.dispatchEvent(event));
        (picker().props.onClear as () => void)();
        expect(current.push).not.toHaveBeenCalled();
        expect(current.storage.get("constructa_selected_project_id")).toBe("job-25");
        expect(picker().props.name).toBe("Current name 25");
    });
    it("keeps the explicit deselection path to dashboard and clears only existing selection keys", () => {
        current.query = "projectId=job-25"; view(); effects();
        current.storage.set("unrelated", "keep");
        (picker().props.onClear as () => void)();
        expect(current.push).toHaveBeenCalledExactlyOnceWith("/dashboard");
        expect(current.storage.has("constructa_selected_project_id")).toBe(false);
        expect(current.storage.get("unrelated")).toBe("keep");
    });
});
