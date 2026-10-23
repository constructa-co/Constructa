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
function render(lockReason?: string | null, fields: Partial<Parameters<typeof BriefClient>[0]["project"]> = {}) {
    current.cursor = 0;
    const tree = BriefClient({ project: { ...project, ...fields }, save: current.save, ask: current.ask, ...(lockReason === undefined ? {} : { lockReason }) });
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
        expect(byId(tree, "brief-rough-value")).toBeUndefined();
        expect(byId(tree, "brief-postcode")).toBeUndefined();
        expect(byId(tree, "brief-start-date")).toBeUndefined();
        for (const id of ["brief-site-notes"]) {
            expect(byId(tree, id)!.props.readOnly).toBe(true); typeInto(byId(tree, id), "x");
        }
        expect(tree.find(e => typeof e.props.onApply === "function")).toBeUndefined();
        expect(capture(tree)).toHaveLength(0);
        stage("site"); tree = render(reason);
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

describe("retired rough-value capture", () => {
    it.each([0, 123.456, 45000])("Save omits historical value %s rather than clearing or rounding it", async value => {
        let state = initialBriefState({ ...project, potential_value: value });
        current.store = { getState: () => state, dispatch: action => { state = briefReducer(state, action); } };
        typeInto(byId(render(null), "brief-work"), "Changed scope");
        click(buttons(render(null), "Save")[0]);
        await Promise.resolve();
        expect(current.save).toHaveBeenCalledTimes(1);
        expect(current.save.mock.calls[0][1]).not.toHaveProperty("potential_value");
        expect(state.draft.roughValue).toBe(value ? String(value) : "");
        expect(state.saved).toEqual(state.draft);
        expect(current.push).not.toHaveBeenCalled();
    });

    it("Build the price also omits the retired value and waits for acknowledgement", async () => {
        let state = initialBriefState({ ...project, potential_value: 123.456 });
        current.store = { getState: () => state, dispatch: action => { state = briefReducer(state, action); } };
        typeInto(byId(render(null), "brief-work"), "Updated description");
        stage("site");
        const tree = render(null);
        expect(byId(tree, "brief-rough-value")).toBeUndefined();
        await click(buttons(tree, "Save and build the price")[0]);
        expect(current.save.mock.calls[0][1]).not.toHaveProperty("potential_value");
        expect(current.push).toHaveBeenCalledExactlyOnceWith(`/dashboard/projects/costs?projectId=${project.id}`);
    });

    it("neither displays nor applies a monetary-only suggestion, including a direct callback", () => {
        current.store.dispatch({ type: "suggestion/received", suggestion: { id: "money", source: "assistant", basedOnWork: project.brief_scope, work: null, trades: [], siteNotes: null, clientType: null, roughValue: 45000, startDate: null, note: null } });
        const card = render(null).find(e => e.props.suggestion)!;
        current.cursor = 1000;
        const tree = nodes((card.type as (props: unknown) => unknown)(card.props));
        expect(tree.filter(e => e.type === "input")).toHaveLength(0);
        expect(text(tree)).not.toContain("45,000");
        expect(buttons(tree, "Apply")).toHaveLength(0);
        (card.props.onApply as (parts: string[], replace: boolean) => void)(["roughValue"], false);
        expect(current.store.getState().draft.roughValue).toBe("");
        expect(current.store.getState().suggestion?.id).toBe("money");
        expect(current.save).not.toHaveBeenCalled();
    });

    it("applies allowed suggested wording but refuses its retired money part", () => {
        current.store.dispatch({ type: "suggestion/received", suggestion: { id: "mixed", source: "assistant", basedOnWork: project.brief_scope, work: "Reviewed wording", trades: [], siteNotes: null, clientType: null, roughValue: 45000, startDate: null, note: null } });
        const card = render(null).find(e => e.props.suggestion)!;
        (card.props.onApply as (parts: string[], replace: boolean) => void)(["work", "roughValue"], false);
        expect(current.store.getState().draft.work).toBe("Reviewed wording");
        expect(current.store.getState().draft.roughValue).toBe("");
        expect(current.save).not.toHaveBeenCalled();
    });
});

describe("Brief reuses site context instead of asking for it again", () => {
    const fields = { site_address: "  Rear yard\nUnit 2  ", postcode: " sw1a 1aa ", start_date: "2026-11-06", lat: 51.5, lng: -0.1, region: "London" };
    function context() {
        let state = initialBriefState({ ...project, ...fields });
        current.store = { getState: () => state, dispatch: action => { state = briefReducer(state, action); } };
        stage("site");
        return render(null, fields);
    }

    it("shows the exact existing address/postcode and current date without a lookup or write", () => {
        const tree = context();
        expect(text(tree)).toContain(fields.site_address);
        expect(text(tree)).toContain(fields.postcode);
        expect(text(tree)).toContain("6 November 2026");
        expect(text(tree)).toContain(fields.region);
        expect(byId(tree, "brief-postcode")).toBeUndefined();
        expect(tree.filter(e => e.type === "input")).toHaveLength(1);
        expect(current.fetch).not.toHaveBeenCalled(); expect(current.save).not.toHaveBeenCalled();
        expect(current.store.getState().draft).toEqual(current.store.getState().saved);
    });

    it("keeps the existing date input in an optional, initially closed disclosure", () => {
        const tree = context();
        const disclosure = tree.find(e => e.type === "details" && text(e.props.children).includes("Change likely start date"))!;
        expect(disclosure).toBeDefined(); expect(disclosure.props.open).not.toBe(true);
        expect(byId(nodes(disclosure), "brief-start-date")!.props.value).toBe(fields.start_date);
        expect(byId(tree, "brief-site-notes")).toBeDefined();
        expect(tree.find(e => e.props["data-brief-job-details"] !== undefined)?.props).toMatchObject({ href: "/dashboard/projects/settings?projectId=lock-unit-job", prefetch: false });
    });

    it("shows missing context honestly without forcing re-entry or choosing a date", () => {
        stage("site");
        const tree = render(null, { site_address: "", postcode: "" });
        expect(text(tree)).toContain("No site address on this job yet");
        const summary = tree.find(e => e.props["data-brief-site-context"] !== undefined)!;
        expect(text(summary)).toBe("Site postcodeNot setLikely start dateNot set");
        expect(current.store.getState().draft.startDate).toBe("");
        expect(current.fetch).not.toHaveBeenCalled(); expect(current.save).not.toHaveBeenCalled();
    });

    it("retains deliberate date edits and uses only the existing acknowledged save", async () => {
        let tree = context();
        typeInto(byId(tree, "brief-start-date"), "2026-11-09");
        expect(current.save).not.toHaveBeenCalled();
        tree = render(null, fields);
        expect(text(tree)).toContain("9 November 2026");
        click(buttons(tree, "Save")[0]); await Promise.resolve();
        expect(current.save).toHaveBeenCalledTimes(1);
        expect(current.save.mock.calls[0][1]).toMatchObject({ start_date: "2026-11-09", lat: fields.lat, lng: fields.lng, region: fields.region });
        expect(current.save.mock.calls[0][1]).not.toHaveProperty("postcode");
        expect(current.save.mock.calls[0][1]).not.toHaveProperty("site_address");
        expect(current.fetch).not.toHaveBeenCalled();
    });

    it("retains newer date text and does not navigate on a late price-save acknowledgement", async () => {
        let tree = context();
        typeInto(byId(tree, "brief-start-date"), "2026-11-09");
        let finish!: (result: { success: true }) => void;
        current.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        tree = render(null, fields);
        const pending = click(buttons(tree, "Save and build the price")[0]);
        typeInto(byId(tree, "brief-start-date"), "2026-11-12");
        finish({ success: true }); await pending;
        expect(current.store.getState().draft.startDate).toBe("2026-11-12");
        expect(current.store.getState().saved.startDate).toBe("2026-11-09");
        expect(current.push).not.toHaveBeenCalled();
    });

    it("keeps a refused date save and all local notes without a lookup or navigation", async () => {
        const tree = context();
        typeInto(byId(tree, "brief-start-date"), "2026-11-09");
        typeInto(byId(tree, "brief-site-notes"), "  Rear access only.  ");
        current.save.mockResolvedValue({ success: false, error: "Refused" });
        await click(buttons(render(null, fields), "Save and build the price")[0]);
        expect(current.store.getState().draft).toMatchObject({ startDate: "2026-11-09", siteNotes: "  Rear access only.  " });
        expect(current.store.getState().save.error).toBe("Refused");
        expect(current.fetch).not.toHaveBeenCalled(); expect(current.push).not.toHaveBeenCalled();
    });

    it("keeps current context readable when locked without date edits or a settings shortcut", () => {
        context();
        const tree = render("Locked job", fields);
        expect(text(tree)).toContain(fields.postcode); expect(text(tree)).toContain("6 November 2026");
        expect(byId(tree, "brief-start-date")).toBeUndefined();
        expect(tree.find(e => text(e.props.children) === "Edit job details")).toBeUndefined();
        expect(byId(tree, "brief-site-notes")!.props.readOnly).toBe(true);
        expect(current.save).not.toHaveBeenCalled(); expect(current.fetch).not.toHaveBeenCalled();
    });

    it("refreshes read-only address/postcode context without editing the retained date or notes", () => {
        context();
        current.store.dispatch({ type: "draft/edit", patch: { siteNotes: "Retained access note" } });
        stage("site");
        const tree = render(null, { ...fields, site_address: "Updated site", postcode: "NE1 1AA" });
        expect(text(tree)).toContain("Updated site"); expect(text(tree)).toContain("NE1 1AA");
        expect(current.store.getState().draft).toMatchObject({ startDate: fields.start_date, siteNotes: "Retained access note" });
        expect(current.save).not.toHaveBeenCalled(); expect(current.fetch).not.toHaveBeenCalled();
    });

    it("retains the existing dirty-navigation confirmation", () => {
        context();
        current.store.dispatch({ type: "draft/edit", patch: { siteNotes: "Unsaved access note" } });
        render(null, fields); current.confirm.mockReturnValue(false);
        const handler = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls.filter(([event]) => event === "click").at(-1)![1] as (event: unknown) => void;
        const event = { target: { closest: () => ({ getAttribute: () => null }) }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
        handler(event);
        expect(current.confirm).toHaveBeenCalledTimes(1);
        expect(event.preventDefault).toHaveBeenCalledTimes(1);
        expect(current.store.getState().draft.siteNotes).toBe("Unsaved access note");
        expect(current.save).not.toHaveBeenCalled();
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
        stage("site"); tree = render(lockReason);
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
        const date = byId(tree, "brief-start-date")!;
        stage("site"); tree = render(null);
        const build = buttons(tree, "Save and build the price")[0];

        render(reason);
        typeInto(stale.work, "overwritten"); click(stale.business); click(stale.ask); click(stale.save); click(trade);
        (video.props.onApply as (r: unknown) => void)({ scope: "From video", suggestedTrades: ["Plumbing"] });
        typeInto(date, "2026-11-06"); await (build.props.onClick as () => Promise<void>)();

        const state = current.store.getState();
        expect(state.draft.work).toBe(unsaved); expect(state.draft.clientType).toBe("domestic"); expect(state.draft.trades).toEqual(["Roofing"]);
        expect(state.draft.startDate).toBe("");
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
        stage("site");
        const pending = (buttons(render(null), "Save and build the price")[0].props.onClick as () => Promise<void>)();
        render(reason);
        finish({ success: true }); await pending;
        expect(current.save).toHaveBeenCalledTimes(1); expect(current.push).not.toHaveBeenCalled();
        expect(current.store.getState().draft.work).toBe(unsaved);
    });

    it("shows the server's existing lock refusal without offering a retry", async () => {
        current.save.mockResolvedValue({ success: false, error: reason });
        current.store.dispatch({ type: "draft/edit", patch: { work: unsaved } });
        stage("site");
        await (buttons(render(null), "Save and build the price")[0].props.onClick as () => Promise<void>)();
        const tree = render(reason);
        expect(current.store.getState().save).toEqual({ status: "failed", error: reason });
        expect(tree.some(e => e.props.role === "alert" && text(e.props.children).includes(reason))).toBe(true);
        expect(buttons(tree, "Try again")).toHaveLength(0);
        expect(current.store.getState().draft.work).toBe(unsaved); expect(current.push).not.toHaveBeenCalled();
    });
});


describe("contractor activity entry integration", () => {
    const activity = (tree: Element[]) => tree.find(e => typeof e.props.onAdd === "function" && typeof e.props.onClear === "function")!;
    const change = (e: Element, value: string) => (e.props.onChange as (text: string) => void)(value);
    const add = (e: Element) => (e.props.onAdd as () => void)();
    const clear = (e: Element) => (e.props.onClear as () => void)();
    it("puts contractor entry before an optional closed legacy picker", () => {
        stage("work"); const tree = render(null);
        const entryIndex = tree.indexOf(activity(tree)); const details = tree.find(e => e.type === "details")!;
        expect(entryIndex).toBeLessThan(tree.indexOf(details)); expect(details.props.open).toBeUndefined();
        expect(text(details.props.children)).toContain("Choose from existing trade names (optional)");
        expect(nodes(details).some(e => e.props["aria-label"] === "Trades")).toBe(true);
        expect(current.save).not.toHaveBeenCalled();
    });
    it("typing and Add stay local; a single explicit Save carries the exact activity", async () => {
        stage("work"); change(activity(render(null)), "  Protect hallway\n  then strip out  ");
        expect(current.store.getState().draft.trades).toEqual(["Roofing"]); expect(current.save).not.toHaveBeenCalled();
        add(activity(render(null))); expect(current.store.getState().draft.trades).toEqual(["Roofing", "  Protect hallway\n  then strip out  "]);
        expect(current.save).not.toHaveBeenCalled(); click(buttons(render(null), "Save")[0]); await Promise.resolve();
        expect(current.save).toHaveBeenCalledTimes(1);
        expect(current.save.mock.calls[0][1].brief_trade_sections).toEqual(["Roofing", "  Protect hallway\n  then strip out  "]);
    });
    it("unadded text survives steps, remains visible and enters the existing unload guard", () => {
        stage("work"); change(activity(render(null)), "  Pending\n activity  "); render(null);
        expect(window.addEventListener).toHaveBeenCalledWith("beforeunload", expect.any(Function));
        stage("site"); const tree = render(null);
        expect(tree.some(e => e.props.role === "status" && text(e.props.children).includes("  Pending\n activity  "))).toBe(true);
        expect(buttons(tree, "Return to activities")).toHaveLength(1);
        click(buttons(tree, "Return to activities")[0]); expect(activity(render(null)).props.text).toBe("  Pending\n activity  ");
    });
    it("stale Save and Build handlers cannot omit new unadded activity text", async () => {
        current.store.dispatch({ type: "draft/edit", patch: { work: "Older changed work" } });
        const save = buttons(render(null), "Save")[0]; stage("site");
        const build = buttons(render(null), "Save and build the price")[0];
        stage("work"); change(activity(render(null)), "New unadded text");
        click(save); await click(build);
        expect(current.save).not.toHaveBeenCalled(); expect(current.push).not.toHaveBeenCalled();
        expect(current.store.getState().stage).toBe("work"); expect(current.store.getState().activityEntry).toBe("New unadded text");
    });
    it("retains exact text when a refreshed lock arrives and fences earlier callbacks", () => {
        stage("work"); change(activity(render(null)), "  Retain this\n exactly  ");
        const old = activity(render(null)); const tree = render("This job is locked.");
        expect(activity(tree).props.text).toBe("  Retain this\n exactly  "); expect(activity(tree).props.locked).toBe(true);
        change(old, "Wrong newer text"); add(old); clear(old);
        expect(current.store.getState().activityEntry).toBe("  Retain this\n exactly  ");
        expect(current.store.getState().draft.trades).toEqual(["Roofing"]); expect(current.save).not.toHaveBeenCalled();
    });
    it("old Add/Clear cannot change a later identical entry", () => {
        stage("work"); change(activity(render(null)), "Same wording"); const old = activity(render(null));
        clear(old); change(activity(render(null)), "Same wording"); add(old); clear(old);
        expect(activity(render(null)).props.text).toBe("Same wording");
        expect(current.store.getState().draft.trades).toEqual(["Roofing"]);
    });
    it("typing during the price save keeps the newer entry and prevents navigation", async () => {
        let finish!: (value: unknown) => void;
        current.save.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        stage("work"); change(activity(render(null)), "Included activity"); add(activity(render(null)));
        stage("site"); const pending = click(buttons(render(null), "Save and build the price")[0]);
        stage("work"); change(activity(render(null)), "Newer pending activity");
        finish({ success: true }); await pending;
        expect(current.push).not.toHaveBeenCalled(); expect(activity(render(null)).props.text).toBe("Newer pending activity");
        expect(current.store.getState().saved.trades).toEqual(["Roofing", "Included activity"]);
    });
});

describe("Brief site-context Job details handoff", () => {
    function shortcut(tree: Element[]) { return tree.find(e => e.props["data-brief-job-details"] !== undefined); }
    function linkEvent(link: Element) {
        const anchor = { getAttribute: (name: string) => name === "href" ? link.props.href : null };
        return { target: { closest: () => anchor }, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    }
    function guard() {
        return (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls.filter(([name]) => name === "click").at(-1)?.[1] as ((event: unknown) => void) | undefined;
    }
    function noWrites() {
        expect(current.save).not.toHaveBeenCalled(); expect(current.ask).not.toHaveBeenCalled();
        expect(current.fetch).not.toHaveBeenCalled(); expect(current.push).not.toHaveBeenCalled();
    }

    it("offers the current job's existing editor without prefetch,custom navigation or a write", () => {
        stage("site"); const before = JSON.stringify(current.store.getState()), link = shortcut(render(null))!;
        expect(link.props.href).toBe("/dashboard/projects/settings?projectId=lock-unit-job");
        expect(text(link.props.children)).toBe("Edit job details"); expect(link.props.prefetch).toBe(false);
        expect(link.props.target).toBeUndefined(); expect(link.props.onClick).toBeUndefined();
        expect(JSON.stringify(current.store.getState())).toBe(before); noWrites();
    });
    it("encodes only the current explicit identity without a fallback or second lookup", () => {
        stage("site"); const id = "job/a?x=one&two";
        expect(shortcut(render(null, { id }))!.props.href).toBe(`/dashboard/projects/settings?projectId=${encodeURIComponent(id)}`); noWrites();
    });
    it.each(["client", "work"] as const)("does not add a duplicate edit entry on %s", next => {
        stage(next); expect(shortcut(render(null))).toBeUndefined(); noWrites();
    });
    it("does not offer protected editing on an initially locked job", () => {
        stage("site"); expect(shortcut(render("This project is archived."))).toBeUndefined();
        expect(shortcut(render(null))).toBeDefined(); noWrites();
    });
    it("Cancel from the real link retains exact newer notes and prevents navigation propagation", () => {
        current.store.dispatch({ type: "draft/edit", patch: { siteNotes: "  Newer access\n\n  exact notes  " } }); stage("site");
        const link = shortcut(render(null))!, before = JSON.stringify(current.store.getState()), event = linkEvent(link);
        current.confirm.mockReturnValue(false); guard()!(event);
        expect(current.confirm).toHaveBeenCalledOnce(); expect(event.preventDefault).toHaveBeenCalledOnce(); expect(event.stopPropagation).toHaveBeenCalledOnce();
        expect(JSON.stringify(current.store.getState())).toBe(before); noWrites();
    });
    it("unadded contractor activity text is guarded and retained on Cancel", () => {
        current.store.dispatch({ type: "activity/edit", text: "  Keep this\n  pending activity  " }); stage("site");
        const link = shortcut(render(null))!, before = JSON.stringify(current.store.getState()), event = linkEvent(link);
        current.confirm.mockReturnValue(false); guard()!(event);
        expect(event.preventDefault).toHaveBeenCalledOnce(); expect(JSON.stringify(current.store.getState())).toBe(before);
        expect(current.store.getState().activityEntry).toBe("  Keep this\n  pending activity  "); noWrites();
    });
    it("explicit consent permits the link event without autosaving or mutating the current draft", () => {
        current.store.dispatch({ type: "draft/edit", patch: { work: "Newer deliberate draft" } }); stage("site");
        const link = shortcut(render(null))!, before = JSON.stringify(current.store.getState()), event = linkEvent(link);
        current.confirm.mockReturnValue(true); guard()!(event);
        expect(current.confirm).toHaveBeenCalledOnce(); expect(event.preventDefault).not.toHaveBeenCalled(); expect(event.stopPropagation).not.toHaveBeenCalled();
        expect(JSON.stringify(current.store.getState())).toBe(before); noWrites();
    });
    it("retains the existing leave guard for a failed Brief", () => {
        current.store.dispatch({ type: "save/failed", error: "Unconfirmed save" });
        stage("site"); const link = shortcut(render(null))!, before = JSON.stringify(current.store.getState()), event = linkEvent(link);
        current.confirm.mockReturnValue(false); guard()!(event);
        expect(event.preventDefault).toHaveBeenCalledOnce(); expect(JSON.stringify(current.store.getState())).toBe(before); noWrites();
    });
    it("hides the shortcut during a save while the existing old-link leave guard still retains the current draft", () => {
        stage("site"); const old = shortcut(render(null))!;
        current.store.dispatch({ type: "save/started" });
        expect(shortcut(render(null))).toBeUndefined(); const before = JSON.stringify(current.store.getState()), event = linkEvent(old);
        current.confirm.mockReturnValue(false); guard()!(event);
        expect(event.preventDefault).toHaveBeenCalledOnce(); expect(JSON.stringify(current.store.getState())).toBe(before); noWrites();
    });
    it("hides the shortcut once the existing confirmed Build the price handoff has started", async () => {
        stage("site"); expect(shortcut(render(null))).toBeDefined();
        await click(buttons(render(null), "Build the price")[0]);
        expect(shortcut(render(null))).toBeUndefined(); expect(current.push).toHaveBeenCalledExactlyOnceWith("/dashboard/projects/costs?projectId=lock-unit-job");
        expect(current.save).not.toHaveBeenCalled(); expect(current.fetch).not.toHaveBeenCalled();
    });
    it("does not install a leave prompt for an already saved clean Brief", () => {
        stage("site"); expect(shortcut(render(null))).toBeDefined(); expect(guard()).toBeUndefined(); noWrites();
    });
    it("refreshed lock hides the shortcut and preserves the locked unsaved-leave warning for an old link", () => {
        current.store.dispatch({ type: "draft/edit", patch: { siteNotes: "Retain on lock" } }); stage("site");
        const old = shortcut(render(null))!, before = JSON.stringify(current.store.getState());
        expect(shortcut(render("This job is now locked."))).toBeUndefined();
        const event = linkEvent(old); current.confirm.mockReturnValue(false); guard()!(event);
        expect(current.confirm.mock.lastCall?.[0]).toContain("now locked"); expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(JSON.stringify(current.store.getState())).toBe(before); noWrites();
    });
});

