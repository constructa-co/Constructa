import { createElement, type ReactElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { briefReducer, DESCRIPTION_NEEDED_ERROR, initialBriefState, type BriefState, type BriefStore } from "@/lib/guided-brief";

// Same slot harness as the brief lock tests: state and refs survive a later
// render, and effects run after render so a handler sees the latest lock.
const current = vi.hoisted(() => ({
    store: null as unknown as BriefStore,
    slots: [] as unknown[],
    effects: [] as Array<{ deps: unknown[] | undefined; cleanup?: () => void } | undefined>,
    queue: [] as Array<() => void>,
    cursor: 0,
    push: vi.fn(), save: vi.fn(), ask: vi.fn(), confirm: vi.fn(),
}));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = typeof initial === "function" ? initial() : initial;
        return [current.slots[i], (next: unknown) => { current.slots[i] = typeof next === "function" ? next(current.slots[i]) : next; }];
    },
    useRef: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = { current: initial };
        return current.slots[i];
    },
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
        const i = current.cursor++;
        const prev = current.effects[i];
        if (prev && deps && prev.deps && deps.every((d, k) => Object.is(d, prev.deps![k]))) return;
        current.effects[i] = { deps, cleanup: prev?.cleanup };
        current.queue.push(() => {
            current.effects[i]?.cleanup?.();
            const cleanup = effect();
            current.effects[i] = { deps, cleanup: typeof cleanup === "function" ? cleanup : undefined };
        });
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.store.getState(), current.store] }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: current.push }) }));
vi.mock("next/dynamic", () => ({ default: () => function VideoWalkthrough() { return null; } }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("./actions", () => ({ saveBriefAction: vi.fn(), suggestBriefAction: vi.fn() }));
import BriefClient from "./brief-client";

type Element = ReactElement<Record<string, unknown>>;
const project = {
    id: "direct-price-job", name: "Direct price job", client_name: "Client", site_address: "Existing site", postcode: "",
    brief_scope: "Replace the roof.", brief_trade_sections: ["Roofing"], client_type: "domestic",
    potential_value: null, start_date: "", lat: null, lng: null, region: "", brief_completed: true,
};
const LOCK = "This job is locked.";

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element; return [e, ...nodes(e.props.children)];
}
function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    return value && typeof value === "object" && "props" in value ? text((value as Element).props.children) : "";
}
function props(lockReason?: string | null) {
    return { project, save: current.save, ask: current.ask, ...(lockReason === undefined ? {} : { lockReason }) };
}
function render(lockReason?: string | null) {
    current.cursor = 0;
    const tree = BriefClient(props(lockReason));
    const queued = current.queue.splice(0); for (const run of queued) run();
    return nodes(tree);
}
function ssr(lockReason?: string | null) {
    current.slots = []; current.effects = []; current.queue = []; current.cursor = 0;
    const html = renderToStaticMarkup(createElement(BriefClient, props(lockReason)));
    current.queue.splice(0); current.slots = []; current.effects = []; current.cursor = 0;
    return html;
}
const byId = (tree: Element[], id: string) => tree.find(e => e.props.id === id);
const buttons = (tree: Element[], label: string) => tree.filter(e => e.type === "button" && text(e.props.children).trim() === label);
const steps = (tree: Element[]) => tree.filter(e => e.type === "button" && text(e.props.children).startsWith("Step "));
const stage = (key: BriefState["stage"]) => current.store.dispatch({ type: "stage/set", stage: key });
const typeInto = (e: Element | undefined, value: string) => (e!.props.onChange as (ev: unknown) => void)({ target: { value } });
const click = (e: Element | undefined) => (e!.props.onClick as () => unknown)();
const activity = (tree: Element[]) => tree.find(e => typeof e.props.onAdd === "function" && typeof e.props.onClear === "function")!;

beforeEach(() => {
    let state: BriefState = initialBriefState(project);
    current.store = { getState: () => state, dispatch: action => { state = briefReducer(state, action); } };
    current.slots = []; current.effects = []; current.queue = []; current.cursor = 0;
    current.push.mockReset(); current.confirm.mockReset().mockReturnValue(true);
    current.save.mockReset().mockResolvedValue({ success: true }); current.ask.mockReset();
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
    vi.stubGlobal("window", { requestAnimationFrame: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: current.confirm, scrollTo: vi.fn() });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("brief goes straight to Build the price", () => {
    it("uses three columns in the effective module rule while retaining the narrow-screen fallback", () => {
        const css = readFileSync("src/components/brief-chrome.module.css", "utf8");
        expect(css).toContain(".steps ol { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }");
        expect(css).not.toContain("repeat(4,");
        expect(css).toContain(".steps ol { grid-template-columns: repeat(2, minmax(0, 1fr)); }");
    });
    it("renders three steps, no Review step and no Confirm and save", () => {
        const html = ssr();
        expect(html).toContain("grid-cols-3");
        expect(html).toContain("then build the price");
        expect(html).not.toContain("review before pricing");
        expect(html).not.toContain("Confirm and save");
        expect(html).not.toContain("Step 4");
        const tree = render();
        expect(steps(tree).map(e => text(e.props.children))).toEqual([
            "Step 1The job",
            "Step 2Activities",
            "Step 3Site and assumptions",
        ]);
        expect(tree.some(e => e.type === "button" && text(e.props.children).includes("Review"))).toBe(false);
        expect(buttons(tree, "Next")).toHaveLength(1);
        expect(buttons(tree, "Confirm and save")).toHaveLength(0);
    });

    it("shows Build on an unlocked site and hides it when the site is locked", () => {
        stage("site");
        const open = render();
        for (const id of ["brief-site-notes", "brief-start-date", "brief-postcode"]) expect(byId(open, id)).toBeDefined();
        expect(byId(open, "brief-rough-value")).toBeUndefined();
        expect(open.some(e => text(e.props.children) === "Existing site")).toBe(true);
        const build = buttons(open, "Build the price");
        expect(build).toHaveLength(1);
        expect(build[0].props.disabled).toBe(false);
        expect(build[0].props.onClick).toBeTypeOf("function");
        expect(buttons(open, "Save and build the price")).toHaveLength(0);
        expect(buttons(open, "Next")).toHaveLength(0);
        expect(buttons(open, "Confirm and save")).toHaveLength(0);
        expect(open.some(e => text(e.props.children).includes("Your brief is saved before pricing opens."))).toBe(false);

        stage("client");
        typeInto(byId(render(), "brief-work"), "Replace the roof and gutters.");
        stage("site");
        const dirty = render();
        expect(buttons(dirty, "Save and build the price")).toHaveLength(1);
        expect(buttons(dirty, "Next")).toHaveLength(0);
        expect(dirty.some(e => text(e.props.children).includes("If the save fails you stay here with everything you typed."))).toBe(true);
        expect(buttons(dirty, "Save")).toHaveLength(1);

        stage("work");
        expect(buttons(render(), "Next")).toHaveLength(1);
        stage("site");
        const locked = render(LOCK);
        expect(buttons(locked, "Build the price")).toHaveLength(0);
        expect(buttons(locked, "Save and build the price")).toHaveLength(0);
        expect(buttons(locked, "Confirm and save")).toHaveLength(0);
        expect(buttons(locked, "Next")).toHaveLength(0);
        const lockedHtml = ssr(LOCK);
        expect(lockedHtml).not.toContain("Save and build the price");
        expect(lockedHtml).not.toContain("Confirm and save");
    });

    it("keeps the saving label and disables Build while a save is in progress", () => {
        stage("site");
        current.store.dispatch({ type: "save/started" });
        const button = buttons(render(), "Saving…")[0];
        expect(button.props.disabled).toBe(true);
        expect(buttons(render(), "Build the price")).toHaveLength(0);
    });
});

describe("Build the price keeps the existing guards", () => {
    it("refuses a blank description and stays on the brief", async () => {
        typeInto(byId(render(), "brief-work"), "   ");
        stage("site");
        await click(buttons(render(), "Save and build the price")[0]);
        expect(current.save).not.toHaveBeenCalled();
        expect(current.push).not.toHaveBeenCalled();
        expect(current.store.getState().stage).toBe("client");
        expect(current.store.getState().save).toEqual({ status: "failed", error: DESCRIPTION_NEEDED_ERROR });
        expect(current.store.getState().draft.work).toBe("   ");
    });

    it("stays on the brief when the save is refused and still offers Try again", async () => {
        current.save.mockResolvedValue({ success: false, error: "The brief was not saved." });
        typeInto(byId(render(), "brief-work"), "Replace the roof and gutters.");
        stage("site");
        await click(buttons(render(), "Save and build the price")[0]);
        const tree = render();
        expect(current.save).toHaveBeenCalledTimes(1);
        expect(current.push).not.toHaveBeenCalled();
        expect(current.store.getState().stage).toBe("site");
        expect(current.store.getState().draft.work).toBe("Replace the roof and gutters.");
        expect(current.store.getState().save).toEqual({ status: "failed", error: "The brief was not saved." });
        expect(tree.some(e => e.props.role === "alert" && text(e.props.children).includes("The brief was not saved."))).toBe(true);
        expect(buttons(tree, "Try again")).toHaveLength(1);
    });

    it("keeps a newer activity entry and does not open pricing", async () => {
        let finish!: (value: unknown) => void;
        current.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        typeInto(byId(render(), "brief-work"), "Replace the roof and gutters.");
        stage("site");
        const pending = click(buttons(render(), "Save and build the price")[0]);
        stage("work");
        (activity(render()).props.onChange as (value: string) => void)("Newer pending activity");
        finish({ success: true });
        await pending;
        expect(current.push).not.toHaveBeenCalled();
        expect(current.store.getState().activityEntry).toBe("Newer pending activity");
        expect(current.store.getState().stage).toBe("work");
    });

    it("does not open pricing when the lock lands while the save is on its way", async () => {
        let finish!: (value: unknown) => void;
        current.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        typeInto(byId(render(), "brief-work"), "Replace the roof and gutters.");
        stage("site");
        const pending = click(buttons(render(), "Save and build the price")[0]);
        render(LOCK);
        finish({ success: true });
        await pending;
        expect(current.save).toHaveBeenCalledTimes(1);
        expect(current.push).not.toHaveBeenCalled();
        expect(current.store.getState().draft.work).toBe("Replace the roof and gutters.");
    });

    it("refuses a Build handler taken before the lock", async () => {
        stage("site");
        const build = buttons(render(), "Build the price")[0];
        render(LOCK);
        await click(build);
        expect(current.save).not.toHaveBeenCalled();
        expect(current.push).not.toHaveBeenCalled();
    });

    it("opens pricing from a confirmed site without a second save", async () => {
        stage("site");
        await click(buttons(render(), "Build the price")[0]);
        expect(current.save).not.toHaveBeenCalled();
        expect(current.push).toHaveBeenCalledExactlyOnceWith("/dashboard/projects/costs?projectId=direct-price-job");
        expect(buttons(render(), "Opening pricing…")[0].props.disabled).toBe(true);
    });
});
