import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProgrammeDraft, initialProgrammeState, type ProgrammeState } from "@/lib/simple-programme";

// A055: the actual Programme parent, its actual request adapter and the actual
// action module boundary. Only the action's server answer is simulated here.
const hooks = vi.hoisted(() => ({
    effects: [] as Array<() => void | (() => void)>,
    state: null as ProgrammeState | null,
    panel: null as null | { session: import("@/lib/planning-conversation").PlanningConversation; blocked: boolean; blockedNote?: string },
    turn: vi.fn(),
}));
vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useEffect: (effect: () => void | (() => void)) => { hooks.effects.push(effect); },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => { throw Error("Detailed planner must stay closed"); } }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [hooks.state, {}] }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: vi.fn() }));
vi.mock("@/components/programme-stage-focus", () => ({ default: () => null }));
vi.mock("./simple-actions", () => ({ saveSimpleProgrammeAction: vi.fn() }));
vi.mock("./assistant-actions", () => ({ planningAssistantTurnAction: hooks.turn }));
vi.mock("@/components/planning-conversation-panel", () => ({ default: (props: NonNullable<typeof hooks.panel>) => { hooks.panel = props; return null; } }));

import SimpleProgrammeClient from "./simple-programme-client";
import { buildPlanningContext, PLANNING_OFF, PLANNING_SERVER_CHANGED } from "@/lib/planning-conversation";

const project = { id: "job-a", name: "Example job", client_name: "QA", start_date: "2026-11-02", programme_phases: [{ name: "Groundworks", manualDays: 10, startOffset: 0 }] };
const reply = { message: "Confirm the drainage layout before Groundworks.", questions: ["Has the client chosen the drainage route?"], suggestions: [{ topic: "client-decision", title: "Drainage route", stage: "Groundworks", timing: null }] };
const cleanups: Array<() => void> = [];
const revision = () => createHash("sha256").update(JSON.stringify(buildPlanningContext(project))).digest("hex");

function mount(props: Record<string, unknown> = {}) {
    hooks.state = initialProgrammeState(emptyProgrammeDraft("2026-11-02"), false);
    hooks.effects = []; hooks.panel = null;
    renderToStaticMarkup(<SimpleProgrammeClient project={project} lockReason={null} estimate={null} {...props} />);
    for (const effect of hooks.effects) {
        const cleanup = effect();
        if (cleanup) cleanups.push(cleanup);
    }
    expect(hooks.panel).not.toBeNull();
    return hooks.panel!;
}

beforeEach(() => { hooks.turn.mockReset(); vi.stubGlobal("window", Object.assign(new EventTarget(), { confirm: vi.fn() })); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.unstubAllGlobals(); });

describe("A055 Programme page request path (actual parent, adapter and action boundary)", () => {
    it("stays honestly off when the server has not switched it on, and never calls the action", async () => {
        const { session } = mount();
        expect(session.getSnapshot().available).toBe(false);
        expect(await session.send()).toBe("off");
        expect(hooks.turn).not.toHaveBeenCalled();
    });

    it("sends only the job id, the message, the transcript and the saved-programme fingerprint", async () => {
        const { session } = mount({ planningAssistantEnabled: true });
        hooks.turn.mockResolvedValue({ status: "reply", reply, provenance: { projectId: "job-a", revision: revision() } });
        session.setMessage("What does the client need to decide?");
        expect(await session.send()).toBe("reply");
        expect(hooks.turn.mock.calls[0][0]).toEqual({ projectId: "job-a", message: "What does the client need to decide?", expectedRevision: revision(), history: [] });
        expect(session.getSnapshot().messages[1]).toMatchObject({ role: "assistant", suggestions: [{ stage: "Groundworks", timing: null }] });

        session.setMessage("Anything to order?");
        expect(await session.send()).toBe("reply");
        expect(hooks.turn.mock.calls[1][0].history).toEqual([
            { role: "user", content: "What does the client need to decide?" },
            { role: "assistant", content: `${reply.message}\n${reply.questions[0]}` },
        ]);
    });

    it("maps off and server-side changes truthfully, keeping the contractor's typing", async () => {
        const { session } = mount({ planningAssistantEnabled: true });
        hooks.turn.mockResolvedValueOnce({ status: "off", message: PLANNING_OFF });
        session.setMessage("Order list?");
        expect(await session.send()).toBe("off");
        expect(session.getSnapshot()).toMatchObject({ error: PLANNING_OFF, message: "Order list?", messages: [] });
        hooks.turn.mockResolvedValueOnce({ status: "stale", message: "changed" });
        expect(await session.send()).toBe("stale");
        expect(session.getSnapshot()).toMatchObject({ notice: PLANNING_SERVER_CHANGED, message: "Order list?", messages: [] });
        hooks.turn.mockResolvedValueOnce({ status: "reply", reply, provenance: { projectId: "job-b", revision: revision() } });
        expect(await session.send()).toBe("stale");
    });

    it("drops a server reply the page's own checks refuse", async () => {
        const { session } = mount({ planningAssistantEnabled: true });
        hooks.turn.mockResolvedValue({ status: "reply", reply: { ...reply, message: "Allow 6 weeks for drainage." }, provenance: { projectId: "job-a", revision: revision() } });
        session.setMessage("How long?");
        expect(await session.send()).toBe("rejected");
        expect(session.getSnapshot()).toMatchObject({ messages: [], canRetry: true });
    });

    it("blocks a locked job with its reason, and unmounting ignores a late answer", async () => {
        const locked = mount({ planningAssistantEnabled: true, lockReason: "This job has been won." });
        expect(locked).toMatchObject({ blocked: true, blockedNote: "This job has been won. The planning conversation is not available for this job." });

        const { session } = mount({ planningAssistantEnabled: true });
        let release: (value: unknown) => void = () => {};
        hooks.turn.mockImplementation(() => new Promise(resolve => { release = resolve; }));
        session.setMessage("Order list?");
        const outcome = session.send();
        await vi.waitFor(() => expect(hooks.turn).toHaveBeenCalled());
        cleanups.splice(0).forEach(cleanup => cleanup());
        release({ status: "reply", reply, provenance: { projectId: "job-a", revision: revision() } });
        expect(await outcome).toBe("cancelled");
        expect(session.getSnapshot().messages).toEqual([]);
    });
});
