import { createHash } from "node:crypto";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { briefReducer, initialBriefState, type BriefState, type BriefStore } from "@/lib/guided-brief";

// A055 Brief: the actual BriefClient, through the same hook harness as
// brief-edit-lock.test.tsx, with only the Server Action's answer simulated.
// Imports nothing new, so a missing panel or request path is a behavioural failure.
const current = vi.hoisted(() => ({
    store: null as unknown as BriefStore,
    slots: [] as unknown[],
    effects: [] as Array<{ deps: unknown[] | undefined; cleanup?: () => void } | undefined>,
    queue: [] as Array<() => void>,
    cursor: 0,
    push: vi.fn(), save: vi.fn(), ask: vi.fn(), turn: vi.fn(),
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
vi.mock("./assistant-actions", () => ({ briefAssistantTurnAction: current.turn }));
import BriefClient from "./brief-client";

type Element = ReactElement<Record<string, unknown>>;
const project = {
    id: "brief-job", name: "Roof job", client_name: "Private Client Name", site_address: "1 Private Street", postcode: "AB1 2CD",
    brief_scope: "Replace the roof.\n\nSite, access and assumptions:\nKey safe code 1234.", brief_trade_sections: ["Roofing"],
    client_type: "domestic", potential_value: 18000, start_date: "2026-11-09", lat: null, lng: null, region: "", brief_completed: true,
};
// The minimal SAVED context, written out here rather than imported.
const savedContext = { job: { id: "brief-job" }, work: "Replace the roof.", clientType: "domestic", trades: ["Roofing"] };
const revision = (context: object = savedContext) => createHash("sha256").update(JSON.stringify(context)).digest("hex");
const reply = { message: "Do you know the roof's current covering?", facts: [{ start: 0, end: 17 }], assumptions: ["Scaffold access is needed."], questions: ["Is the client keeping the existing gutters?"], suggestions: [{ kind: "client-question", text: "Confirm the tile colour." }] };
const answer = (patch: Record<string, unknown> = {}) => ({ status: "reply", reply, provenance: { projectId: "brief-job", revision: revision() }, ...patch });

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element; return [e, ...nodes(e.props.children)];
}
type Session = { getSnapshot: () => { available: boolean; status: string; message: string; messages: Array<Record<string, unknown>>; error: string | null; notice: string | null; canRetry: boolean }; setMessage: (text: string) => void; send: () => Promise<string>; retry: () => Promise<string>; cancel: () => void };
function mount(props: Record<string, unknown> = {}) {
    current.cursor = 0;
    const tree = nodes(BriefClient({ project, save: current.save, ask: current.ask, ...props }));
    const queued = current.queue.splice(0); for (const run of queued) run();
    const panel = tree.find(e => e.props.session && e.props["data-brief-conversation-mount"] !== undefined);
    expect(panel, "Brief conversation panel is mounted").toBeDefined();
    return { panel: panel!, session: panel!.props.session as Session };
}
const unmount = () => { for (const effect of current.effects) effect?.cleanup?.(); };

beforeEach(() => {
    let state: BriefState = initialBriefState(project);
    current.store = { getState: () => state, dispatch: action => { state = briefReducer(state, action); } };
    current.slots = []; current.effects = []; current.queue = []; current.cursor = 0;
    current.save.mockReset(); current.ask.mockReset(); current.turn.mockReset();
    vi.stubGlobal("window", { requestAnimationFrame: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: vi.fn(() => true), scrollTo: vi.fn() });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("A055 Brief conversation on the actual Brief page", () => {
    it("is mounted honestly off by default and never calls the action, saves or asks", async () => {
        const { panel, session } = mount();
        expect(session.getSnapshot().available).toBe(false);
        expect(await session.send()).toBe("off");
        expect(renderToStaticMarkup(panel)).toContain("Not enabled");
        expect(current.turn).not.toHaveBeenCalled(); expect(current.save).not.toHaveBeenCalled(); expect(current.ask).not.toHaveBeenCalled();
    });

    it("sends only the job id, the message, the transcript and the SAVED brief fingerprint", async () => {
        const { session } = mount({ briefAssistantEnabled: true });
        current.turn.mockResolvedValue(answer());
        session.setMessage("What should I ask the client?");
        expect(await session.send()).toBe("reply");
        expect(current.turn).toHaveBeenCalledExactlyOnceWith({ projectId: "brief-job", message: "What should I ask the client?", expectedRevision: revision(), history: [] });
        expect(JSON.stringify(current.turn.mock.calls[0][0])).not.toMatch(/Key safe|1234|Private|AB1|18000|2026-11-09/);
        expect(session.getSnapshot().messages[1]).toMatchObject({ role: "assistant", facts: ["Replace the roof."], assumptions: ["Scaffold access is needed."] });

        session.setMessage("And the gutters?");
        expect(await session.send()).toBe("reply");
        expect(current.turn.mock.calls[1][0].history[0]).toEqual({ role: "user", content: "What should I ask the client?" });
        expect(current.save).not.toHaveBeenCalled(); expect(current.ask).not.toHaveBeenCalled();
    });

    it("blocks a turn while the brief has unsaved changes, leaving the typed draft exactly as it is", async () => {
        current.store.dispatch({ type: "draft/edit", patch: { work: "Replace the roof and add a dormer." } });
        const { panel, session } = mount({ briefAssistantEnabled: true });
        expect(panel.props.blocked).toBe(true);
        session.setMessage("Anything missing?");
        expect(await session.send()).toBe("blocked");
        expect(current.turn).not.toHaveBeenCalled();
        expect(current.store.getState().draft.work).toBe("Replace the roof and add a dormer.");
        expect(current.store.getState().saved.work).toBe("Replace the roof.");
        expect(renderToStaticMarkup(panel)).toContain("only uses your saved brief");
    });

    it("blocks a locked job with its reason", () => {
        const { panel } = mount({ briefAssistantEnabled: true, lockReason: "This job has been won." });
        expect(panel.props.blocked).toBe(true);
        expect(renderToStaticMarkup(panel)).toContain("This job has been won. The brief conversation is not available for this job.");
    });

    it("maps off, a server-side change and another job's reply truthfully, keeping the typing", async () => {
        const { session } = mount({ briefAssistantEnabled: true });
        session.setMessage("Anything missing?");
        current.turn.mockResolvedValueOnce({ status: "off", message: "off" });
        expect(await session.send()).toBe("off");
        expect(session.getSnapshot()).toMatchObject({ message: "Anything missing?", messages: [] });
        current.turn.mockResolvedValueOnce({ status: "stale", message: "changed" });
        expect(await session.send()).toBe("stale");
        expect(session.getSnapshot().notice).toMatch(/Reload the page/);
        current.turn.mockResolvedValueOnce(answer({ provenance: { projectId: "other-job", revision: revision() } }));
        expect(await session.send()).toBe("stale");
        expect(session.getSnapshot().message).toBe("Anything missing?");
    });

    it("drops a reply quoting work the saved brief does not contain or naming money, and retries only when asked", async () => {
        const { session } = mount({ briefAssistantEnabled: true });
        current.turn.mockResolvedValueOnce(answer({ reply: { ...reply, facts: [{ start: 0, end: 500 }] } }));
        session.setMessage("Summarise it");
        expect(await session.send()).toBe("rejected");
        expect(session.getSnapshot()).toMatchObject({ messages: [], canRetry: true });
        current.turn.mockResolvedValueOnce(answer({ reply: { ...reply, message: "Budget about £12,000." } }));
        expect(await session.retry()).toBe("rejected");
        expect(current.turn).toHaveBeenCalledTimes(2);
        expect(current.turn.mock.calls[1][0].message).toBe("Summarise it");
    });

    it("ignores a late answer after Stop waiting, and after the page is left", async () => {
        for (const leave of ["cancel", "unmount"] as const) {
            current.slots = []; current.effects = []; current.queue = [];
            const { session } = mount({ briefAssistantEnabled: true });
            let release: (value: unknown) => void = () => {};
            current.turn.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
            session.setMessage("Anything missing?");
            const outcome = session.send();
            await vi.waitFor(() => expect(current.turn).toHaveBeenCalled());
            if (leave === "cancel") session.cancel(); else unmount();
            release(answer());
            expect(await outcome).toBe("cancelled");
            expect(session.getSnapshot().messages).toEqual([]);
            current.turn.mockReset();
        }
    });
});
