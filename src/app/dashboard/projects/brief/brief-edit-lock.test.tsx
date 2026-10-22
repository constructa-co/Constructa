import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { briefReducer, initialBriefState, type BriefState, type BriefStore } from "@/lib/guided-brief";
import { getPrecontractEditLockReason, type PrecontractProjectState } from "@/lib/project-editability";

// A small hook harness: state and refs keep their slot between renders and
// effects run after a render when their dependencies change, so a handler
// taken from one render can be called after a later one.
const current = vi.hoisted(() => ({
    store: null as unknown as BriefStore,
    slots: [] as unknown[],
    effects: [] as Array<{ deps: unknown[] | undefined; cleanup?: () => void } | undefined>,
    queue: [] as Array<() => void>,
    cursor: 0,
    push: vi.fn(), fetch: vi.fn(), save: vi.fn(), ask: vi.fn(), confirm: vi.fn(),
    createClient: vi.fn(),
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
vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: current.push }),
    redirect: (path: string) => { throw Error(`NEXT_REDIRECT:${path}`); },
}));
vi.mock("next/dynamic", () => ({ default: () => function VideoWalkthrough() { return null; } }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "light" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: current.createClient }));
vi.mock("@/components/project-navbar", () => ({ default: () => null }));
vi.mock("./actions", () => ({ saveBriefAction: vi.fn(), suggestBriefAction: vi.fn() }));
import BriefClient from "./brief-client";
import BriefPage from "./page";

type Element = ReactElement<Record<string, unknown>>;
const project = { id: "lock-unit-job", name: "Lock unit job", client_name: "Client", site_address: "Existing site", postcode: "", brief_scope: "Replace the roof.", brief_trade_sections: ["Roofing"], client_type: "domestic", potential_value: null, start_date: "", lat: null, lng: null, region: "", brief_completed: true };

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
function render(lockReason?: string | null) {
    current.cursor = 0;
    const tree = BriefClient({ project, save: current.save, ask: current.ask, ...(lockReason === undefined ? {} : { lockReason }) });
    const queued = current.queue.splice(0); for (const run of queued) run();
    return nodes(tree);
}
const byId = (tree: Element[], id: string) => tree.find(e => e.props.id === id);
const buttons = (tree: Element[], label: string) => tree.filter(e => e.type === "button" && text(e.props.children).trim() === label);
const capture = (tree: Element[]) => tree.filter(e => e.type === "button" && text(e.props.children).startsWith("Other ways to capture the job"));
const lockNote = (tree: Element[]) => tree.find(e => e.props["data-brief-locked"] !== undefined);
const stage = (key: BriefState["stage"]) => current.store.dispatch({ type: "stage/set", stage: key });
const typeInto = (e: Element | undefined, value: string) => (e!.props.onChange as (ev: unknown) => void)({ target: { value } });
const click = (e: Element | undefined) => (e!.props.onClick as () => unknown)();

const LOCKED_PROJECTS: Array<[string, PrecontractProjectState]> = [
    ["Active", { status: "active" }],
    ["Won", { status: "Won" }],
    ["accepted proposal status", { status: "sent", proposal_status: "accepted" }],
    ["accepted timestamp", { status: "sent", proposal_accepted_at: "2026-10-01T09:00:00Z" }],
    ["archived", { status: "draft", is_archived: true }],
    ["completed", { status: "completed" }],
    ["lost", { status: "lost" }],
];

beforeEach(() => {
    let state: BriefState = initialBriefState(project);
    current.store = { getState: () => state, dispatch: action => { state = briefReducer(state, action); } };
    current.slots = []; current.effects = []; current.queue = []; current.cursor = 0;
    current.push.mockReset(); current.fetch.mockReset(); current.confirm.mockReset().mockReturnValue(true);
    current.save.mockReset().mockResolvedValue({ success: true }); current.ask.mockReset();
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
    vi.stubGlobal("window", { requestAnimationFrame: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: current.confirm, scrollTo: vi.fn() });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("fetch", current.fetch);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Brief page passes the existing pre-contract lock", () => {
    async function editorFor(row: Record<string, unknown>) {
        current.createClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: "local-user" } } }) },
            from: () => ({ select: () => ({ eq: () => ({
                order: async () => ({ data: [{ id: "p", name: "Job" }] }),
                single: async () => ({ data: { id: "p", name: "Job", brief_scope: "Saved scope", ...row } }),
            }) }) }),
        });
        const page = await BriefPage({ searchParams: Promise.resolve({ projectId: "p" }) });
        return page.props.children[1];
    }
    it.each(LOCKED_PROJECTS)("%s: hands BriefClient the same reason the server uses", async (_label, row) => {
        const editor = await editorFor(row as Record<string, unknown>);
        const reason = getPrecontractEditLockReason(row);
        expect(reason).not.toBeNull();
        expect(editor.props.lockReason).toBe(reason);
        expect(editor.key).toBe("p");
        expect(editor.props.project).toMatchObject({ id: "p", brief_scope: "Saved scope" });
    });
    it.each([["draft", { status: "draft" }], ["sent", { status: "sent", proposal_status: "sent" }], ["no status", {}]])("%s: stays editable", async (_label, row) => {
        expect((await editorFor(row)).props.lockReason).toBeNull();
    });
});

describe.each(LOCKED_PROJECTS)("Brief locked (%s)", (_label, row) => {
    const reason = getPrecontractEditLockReason(row)!;
    it("states the reason once and keeps the saved brief readable but not editable", () => {
        const tree = render(reason);
        const note = lockNote(tree)!;
        expect(note.props.role).toBe("status"); expect(note.props.id).toBe("brief-lock-note");
        expect(text(note.props.children)).toContain(reason);
        const work = byId(tree, "brief-work")!;
        expect(work.props.value).toBe("Replace the roof."); expect(work.props.readOnly).toBe(true);
        expect(String(work.props["aria-describedby"])).toContain("brief-lock-note");
        expect(buttons(tree, "Tidy this up for me")).toHaveLength(0);
        expect(buttons(tree, "Save")).toHaveLength(0);
        for (const label of ["A homeowner", "A business", "Public sector"]) expect(buttons(tree, label)[0].props.disabled).toBe(true);
    });
    it("refuses edits, trade changes, save, suggestion, media and build-price even if a control is triggered", async () => {
        let tree = render(reason);
        typeInto(byId(tree, "brief-work"), "changed"); click(buttons(tree, "A business")[0]);
        stage("work"); tree = render(reason);
        const trade = tree.find(e => e.type === "button" && e.props["aria-pressed"] === false)!;
        expect(trade.props.disabled).toBe(true); click(trade);
        click(tree.find(e => e.props["aria-label"] === "Remove Roofing"));
        stage("site"); tree = render(reason);
        for (const id of ["brief-site-notes", "brief-start-date", "brief-rough-value", "brief-postcode"]) {
            expect(byId(tree, id)!.props.readOnly).toBe(true); typeInto(byId(tree, id), "x");
        }
        await (byId(tree, "brief-postcode")!.props.onBlur as () => Promise<void>)();
        expect(tree.find(e => typeof e.props.onApply === "function")).toBeUndefined();
        expect(capture(tree)).toHaveLength(0);
        stage("review"); tree = render(reason);
        expect(buttons(tree, "Save and build the price")).toHaveLength(0);
        expect(buttons(tree, "Build the price")).toHaveLength(0);
        expect(buttons(tree, "Confirm and save")).toHaveLength(0);
        const state = current.store.getState();
        expect(state.draft).toEqual(state.saved); expect(state.draft.trades).toEqual(["Roofing"]); expect(state.draft.clientType).toBe("domestic");
        expect(current.save).not.toHaveBeenCalled(); expect(current.ask).not.toHaveBeenCalled();
        expect(current.fetch).not.toHaveBeenCalled(); expect(current.push).not.toHaveBeenCalled();
    });
    it("keeps step and Back/Next navigation for reading", () => {
        click(buttons(render(reason), "Next")[0]); expect(current.store.getState().stage).toBe("work");
        click(buttons(render(reason), "Back")[0]); expect(current.store.getState().stage).toBe("client");
    });
});

describe("unlocked Brief is unchanged", () => {
    it.each([undefined, null])("lockReason %s keeps editing, assistant, capture and save-then-price", async lockReason => {
        let tree = render(lockReason);
        expect(lockNote(tree)).toBeUndefined();
        expect(byId(tree, "brief-work")!.props.readOnly).toBe(false);
        expect(byId(tree, "brief-work")!.props["aria-describedby"]).toBe("brief-work-help");
        typeInto(byId(tree, "brief-work"), "Replace the roof and gutters.");
        expect(current.store.getState().draft.work).toBe("Replace the roof and gutters.");
        expect(buttons(render(lockReason), "Tidy this up for me")).toHaveLength(1);
        stage("site"); tree = render(lockReason);
        expect(capture(tree)).toHaveLength(1);
        stage("review"); tree = render(lockReason);
        await (buttons(tree, "Save and build the price")[0].props.onClick as () => Promise<void>)();
        expect(current.save).toHaveBeenCalledTimes(1);
        expect(current.push).toHaveBeenCalledExactlyOnceWith(`/dashboard/projects/costs?projectId=${project.id}`);
    });
});

describe("lock arriving after the page opened", () => {
    const reason = getPrecontractEditLockReason({ status: "active" })!;
    const unsaved = "  Strip out kitchen.\nKeep the boiler where it is.  ";

    it("retains the exact unsaved text, writes nothing and does not navigate", () => {
        let tree = render(null);
        typeInto(byId(tree, "brief-work"), unsaved);
        tree = render(reason);
        expect(current.store.getState().draft.work).toBe(unsaved);
        expect(byId(tree, "brief-work")!.props.value).toBe(unsaved);
        expect(text(lockNote(tree)!.props.children)).toContain("not saved and can't be saved while it is locked");
        expect(buttons(tree, "Save")).toHaveLength(0);
        expect(current.save).not.toHaveBeenCalled(); expect(current.push).not.toHaveBeenCalled();
        const leaveWarning = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.filter(([type]) => type === "beforeunload");
        expect(leaveWarning.length).toBeGreaterThan(0);
    });

    it("refuses handlers taken from the unlocked render", async () => {
        current.store.dispatch({ type: "draft/edit", patch: { work: unsaved } });
        let tree = render(null);
        const stale = {
            work: byId(tree, "brief-work")!, business: buttons(tree, "A business")[0],
            ask: buttons(tree, "Tidy this up for me")[0], save: buttons(tree, "Save")[0],
        };
        stage("work"); tree = render(null);
        const trade = tree.find(e => e.type === "button" && e.props["aria-pressed"] === false)!;
        stage("site"); tree = render(null);
        click(capture(tree)[0]); tree = render(null);
        const video = tree.find(e => typeof e.props.onApply === "function")!;
        const postcode = byId(tree, "brief-postcode")!;
        typeInto(postcode, "SW1A 1AA"); tree = render(null);
        const postcodeBlur = byId(tree, "brief-postcode")!.props.onBlur as () => Promise<void>;
        stage("review"); tree = render(null);
        const build = buttons(tree, "Save and build the price")[0];

        render(reason);
        typeInto(stale.work, "overwritten"); click(stale.business); click(stale.ask); click(stale.save); click(trade);
        (video.props.onApply as (r: unknown) => void)({ scope: "From video", suggestedTrades: ["Plumbing"] });
        await postcodeBlur(); await (build.props.onClick as () => Promise<void>)();

        const state = current.store.getState();
        expect(state.draft.work).toBe(unsaved); expect(state.draft.clientType).toBe("domestic"); expect(state.draft.trades).toEqual(["Roofing"]);
        expect(state.suggestion).toBeNull(); expect(state.save.status).toBe("idle");
        expect(current.save).not.toHaveBeenCalled(); expect(current.ask).not.toHaveBeenCalled();
        expect(current.fetch).not.toHaveBeenCalled(); expect(current.push).not.toHaveBeenCalled();
    });

    it("drops an assistant reply that arrives after the lock", async () => {
        let answer!: (value: unknown) => void;
        current.ask.mockReturnValue(new Promise(resolve => { answer = resolve; }));
        const tree = render(null);
        click(buttons(tree, "Tidy this up for me")[0]);
        expect(current.store.getState().ai.status).toBe("loading");
        render(reason);
        expect(current.store.getState().ai.status).toBe("idle");
        answer({ ok: true, result: { scope: "Tidied", suggestedTrades: ["Plumbing"] } }); await Promise.resolve(); await Promise.resolve();
        expect(current.store.getState().suggestion).toBeNull(); expect(current.store.getState().draft.work).toBe("Replace the roof.");
    });

    it("keeps a waiting suggestion discardable but not applicable", () => {
        current.store.dispatch({ type: "suggestion/received", suggestion: { id: "s1", source: "assistant", basedOnWork: "Replace the roof.", work: "Tidied", trades: ["Plumbing"], siteNotes: null, clientType: null, roughValue: null, startDate: null, note: null } });
        const staleApply = render(null).find(e => typeof e.props.onApply === "function" && e.props.suggestion)!;
        const card = render(reason).find(e => typeof e.props.onApply === "function" && e.props.suggestion)!;
        expect(card.props.locked).toBe(true);
        current.cursor = 1000;
        const cardTree = nodes((card.type as (p: unknown) => unknown)(card.props));
        expect(buttons(cardTree, "Apply")[0].props.disabled).toBe(true);
        for (const box of cardTree.filter(e => e.type === "input")) expect(box.props.disabled).toBe(true);
        (staleApply.props.onApply as (parts: string[], r: boolean) => void)(["work", "trades"], false);
        expect(current.store.getState().draft.work).toBe("Replace the roof."); expect(current.store.getState().suggestion).not.toBeNull();
        click(buttons(cardTree, "Discard")[0]);
        expect(current.store.getState().suggestion).toBeNull(); expect(current.store.getState().draft.work).toBe("Replace the roof.");
    });

    it("does not open pricing when the lock lands while the save is on its way", async () => {
        let finish!: (value: unknown) => void;
        current.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        current.store.dispatch({ type: "draft/edit", patch: { work: unsaved } });
        stage("review");
        const pending = (buttons(render(null), "Save and build the price")[0].props.onClick as () => Promise<void>)();
        render(reason);
        finish({ success: true }); await pending;
        expect(current.save).toHaveBeenCalledTimes(1); expect(current.push).not.toHaveBeenCalled();
        expect(current.store.getState().draft.work).toBe(unsaved);
    });

    it("shows the server's existing lock refusal without offering a retry", async () => {
        current.save.mockResolvedValue({ success: false, error: reason });
        current.store.dispatch({ type: "draft/edit", patch: { work: unsaved } });
        stage("review");
        await (buttons(render(null), "Save and build the price")[0].props.onClick as () => Promise<void>)();
        const tree = render(reason);
        expect(current.store.getState().save).toEqual({ status: "failed", error: reason });
        expect(tree.some(e => e.props.role === "alert" && text(e.props.children).includes(reason))).toBe(true);
        expect(buttons(tree, "Try again")).toHaveLength(0);
        expect(current.store.getState().draft.work).toBe(unsaved); expect(current.push).not.toHaveBeenCalled();
    });
});
