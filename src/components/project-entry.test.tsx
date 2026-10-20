import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const current = vi.hoisted(() => ({
    slots: [] as unknown[], cursor: 0, effects: [] as (() => void)[],
    pathname: "/dashboard/projects/brief", query: "", theme: "dark", replace: vi.fn(), getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), dispatch: vi.fn(),
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
const router = { replace: current.replace };
vi.mock("next/navigation", () => ({
    useRouter: () => ({ replace: current.replace }),
    usePathname: () => current.pathname,
    useSearchParams: () => new URLSearchParams(current.query),
}));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: current.theme }) }));

import ProjectEntry from "./project-entry";
import { BEFORE_PROJECT_NAVIGATION } from "@/lib/project-navigation";

type Element = ReactElement<Record<string, unknown>>;
const projects = [{ id: "newest", name: "Newest job" }, { id: "older", name: "Older job" }];
const path = "/dashboard/projects/brief";
function view(list = projects) {
    current.cursor = 0; current.effects = [];
    return ProjectEntry({ projects: list, path });
}
function effects() { current.effects.forEach(effect => effect()); }
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function text(value: unknown): string {
    if (Array.isArray(value)) return value.map(text).join(" ");
    if (typeof value === "string") return value;
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
beforeEach(() => {
    current.slots = []; current.cursor = 0; current.effects = []; current.pathname = path; current.query = ""; current.theme = "dark";
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

describe("actual project-entry effect and retry control", () => {
    it("prefers an owner-listed remembered job over the newest job", () => {
        current.getItem.mockReturnValue("older"); view(); effects();
        expect(router.replace).toHaveBeenCalledExactlyOnceWith(`${path}?projectId=older`, { scroll: false });
        expect(current.getItem).toHaveBeenCalledExactlyOnceWith("constructa_selected_project_id");
    });
    it.each([null, "deleted-job", "another-owner-job", "https://untrusted.example"])("falls back to the existing newest default for memory %j", memory => {
        current.getItem.mockReturnValue(memory); view(); effects();
        expect(current.replace).toHaveBeenCalledExactlyOnceWith(`${path}?projectId=newest`, { scroll: false });
    });
    it("does not require a stale stored display name to honour a valid remembered ID", () => {
        current.getItem.mockImplementation(key => key.endsWith("_id") ? "older" : null); view(); effects();
        expect(current.replace).toHaveBeenCalledWith(`${path}?projectId=older`, { scroll: false });
    });
    it("can resolve remembered projects beyond the sidebar's twenty-item list", () => {
        const list = [...Array.from({ length: 25 }, (_, i) => ({ id: `job-${i}`, name: `Job ${i}` })), projects[1]];
        current.getItem.mockReturnValue("older"); view(list); effects();
        expect(current.replace).toHaveBeenCalledWith(`${path}?projectId=older`, { scroll: false });
    });
    it("uses the existing default if browser storage is blocked", () => {
        current.getItem.mockImplementation(() => { throw Error("private storage detail"); }); view(); effects();
        expect(current.replace).toHaveBeenCalledWith(`${path}?projectId=newest`, { scroll: false });
        expect(text(view())).not.toContain("private storage detail");
    });
    it.each(["projectId=older", "projectId=unknown", "projectId=", "projectId=newest&projectId=older"])("never replaces an already explicit URL: %s", query => {
        current.query = query; view(); effects();
        expect(current.replace).not.toHaveBeenCalled(); expect(current.getItem).not.toHaveBeenCalled();
        expect(current.dispatch).not.toHaveBeenCalled();
    });
    it("preserves version/other query entries and the current fragment", () => {
        current.query = "tab=estimate-b&view=details&tag=a&tag=b"; window.location.hash = "#price";
        current.getItem.mockReturnValue("older"); view(); effects();
        expect(current.replace).toHaveBeenCalledWith(`${path}?tab=estimate-b&view=details&tag=a&tag=b&projectId=older#price`, { scroll: false });
    });
    it("does not redirect a stale entry component after navigation to a different page", () => {
        current.pathname = "/dashboard/projects/costs"; view(); effects();
        expect(current.replace).not.toHaveBeenCalled(); expect(current.dispatch).not.toHaveBeenCalled();
    });
    it("replays the effect without duplicate router requests or guard prompts", () => {
        view(); effects(); effects(); view(); effects();
        expect(current.replace).toHaveBeenCalledOnce(); expect(current.dispatch).toHaveBeenCalledOnce();
    });
    it("lets the real cancellable project-navigation event stop canonicalisation", () => {
        const target = new EventTarget();
        target.addEventListener(BEFORE_PROJECT_NAVIGATION, event => event.preventDefault());
        current.dispatch.mockImplementation(event => target.dispatchEvent(event));
        view(); effects();
        expect(current.replace).not.toHaveBeenCalled();
        const event = current.dispatch.mock.calls[0][0] as Event;
        expect(event.type).toBe(BEFORE_PROJECT_NAVIGATION); expect(event.cancelable).toBe(true);
        expect(text(view())).toContain("Your current work has been kept");
        effects(); expect(current.dispatch).toHaveBeenCalledOnce();
    });
    it("retries only after the explicit retry button and rechecks current memory and guard", () => {
        current.dispatch.mockReturnValue(false); view(); effects();
        const button = nodes(view()).find(node => node.type === "button")!;
        expect(button.props.type).toBe("button");
        current.dispatch.mockReturnValue(true); current.getItem.mockReturnValue("older");
        (button.props.onClick as () => void)(); view(); effects();
        expect(current.dispatch).toHaveBeenCalledTimes(2);
        expect(current.replace).toHaveBeenCalledExactlyOnceWith(`${path}?projectId=older`, { scroll: false });
    });
    it("reports a router failure without exposing internal details or automatic retry", () => {
        current.replace.mockImplementation(() => { throw Error("private router detail"); }); view(); effects();
        expect(text(view())).toContain("could not be opened"); expect(text(view())).not.toContain("private router detail");
        effects(); expect(current.replace).toHaveBeenCalledOnce();
    });
    it("does not invent or load a job when the owner list is empty", () => {
        view([]); effects();
        expect(current.replace).not.toHaveBeenCalled(); expect(current.dispatch).not.toHaveBeenCalled();
        expect(text(view([]))).toContain("No projects are available");
    });
    it.each(["dark", "system-c"])("uses readable existing theme colours for %s", theme => {
        current.theme = theme;
        const entry = view();
        expect(entry.props.className).toContain(theme === "dark" ? "text-slate-100" : "text-slate-900");
        expect(nodes(entry).some(node => node.props.role === "status")).toBe(true);
        expect(nodes(entry).some(node => node.type === "a" && node.props.href === "/dashboard")).toBe(true);
    });
});
