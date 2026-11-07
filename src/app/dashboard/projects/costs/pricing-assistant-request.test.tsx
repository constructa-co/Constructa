import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

// A055: the actual Estimate parent, its actual request adapter and the actual
// action module boundary. Only the action's server answer is simulated here.
const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, server: vi.fn(), dispatch: vi.fn(), turn: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(), useEffect: () => undefined, useMemo: (calculate: () => unknown) => calculate(),
    useId: () => "assistant", useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read(),
    useRef: (initial: unknown) => {
        const index = current.cursor++;
        if (!(index in current.slots)) current.slots[index] = { current: initial };
        return current.slots[index];
    },
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (value: unknown) => { current.slots[i] = typeof value === "function" ? value(current.slots[i]) : value; }];
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.server, updateSimplePriceLineAction: current.server, deleteSimplePriceLineAction: current.server, savePriceAdjustmentsAction: current.server, loadAdvancedEstimatingDataAction: current.server }));
vi.mock("./assistant-actions", () => ({ pricingAssistantTurnAction: current.turn }));
import EstimateClient from "./estimate-client";
import type { PricingAssistantSession } from "@/lib/pricing-assistant-session";
import { buildPricingReviewContext } from "@/lib/pricing-review";
import { PRICING_CONVERSATION_OFF, PRICING_SERVER_STALE } from "@/lib/pricing-conversation";

type Element = ReactElement<Record<string, unknown>>;
const project = { id: "job", name: "Example room", client_name: "QA", brief_scope: "Prepare walls. Paint walls.\n\nSite, access and assumptions:\nPrivate access notes." };
const reply = { message: "Review this source activity.", suggestions: [{ source: "briefWork", start: 0, end: 14 }] };
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function mount(props: Record<string, unknown> = {}) {
    current.cursor = 0;
    const view = EstimateClient({ estimates: [], project, ...props });
    const panel = nodes(view).find(e => e.props.session);
    expect(panel).toBeDefined();
    return { session: panel!.props.session as PricingAssistantSession, panel: panel! };
}
const estimate = () => current.state!.estimates[0];
function revision(message: string) {
    const context = buildPricingReviewContext({ id: project.id, brief_scope: project.brief_scope }, estimate(), message);
    if (!context.ok) throw new Error(context.error);
    return createHash("sha256").update(context.value.revision).digest("hex");
}
const answer = (message: string) => ({ status: "reply", reply, provenance: { projectId: "job", estimateId: "estimate", revision: revision(message) } });

beforeEach(() => {
    const saved: Estimate = { id: "estimate", project_id: "job", version_name: "Main", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 777, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Existing work", quantity: 3, unit: "item", unit_rate: 259, line_total: 777, trade_section: "General", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    current.state = initialEstimatingState([saved], { pendingEstimateId: "pending" });
    current.slots = []; current.cursor = 0; current.server.mockReset(); current.turn.mockReset();
    current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
});

describe("A055 Estimate page request path (actual parent, adapter and action boundary)", () => {
    it("stays honestly off when the server has not switched it on, and never calls the action", async () => {
        const { session } = mount();
        expect(session.getSnapshot().available).toBe(false);
        await session.send();
        expect(current.turn).not.toHaveBeenCalled();
    });

    it("sends only ids, the message, the transcript and the page's fingerprint to the server action", async () => {
        const { session } = mount({ pricingAssistantEnabled: true });
        expect(session.getSnapshot().available).toBe(true);
        current.turn.mockImplementation(async (input: { message: string }) => answer(input.message));
        session.setMessage("Help organise preparation"); await session.send();
        expect(current.turn).toHaveBeenCalledOnce();
        expect(current.turn.mock.calls[0][0]).toEqual({ projectId: "job", estimateId: "estimate", message: "Help organise preparation", expectedRevision: revision("Help organise preparation"), history: [] });
        expect(JSON.stringify(current.turn.mock.calls[0][0])).not.toMatch(/Private access|Prepare walls|777|259|model|budget/);
        expect(session.getSnapshot().conversation.pending?.suggestions[0].description).toBe("Prepare walls.");

        session.setMessage("And the painting?"); await session.send();
        expect(current.turn.mock.calls[1][0].history).toEqual([{ role: "user", content: "Help organise preparation" }, { role: "assistant", content: reply.message }]);
        expect(current.server).not.toHaveBeenCalled(); expect(current.dispatch).not.toHaveBeenCalled();
    });

    it("opens one unpriced draft only after the contractor's explicit choice on a server-checked reply", async () => {
        const { session } = mount({ pricingAssistantEnabled: true });
        current.turn.mockImplementation(async (input: { message: string }) => answer(input.message));
        session.setMessage("Review preparation"); await session.send();
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
        expect(session.choose(0)).toEqual({ ok: true });
        expect(current.state!.ops[NEW_LINE_KEY].draft).toEqual({ ...EMPTY_PRICE_LINE_DRAFT, description: "Prepare walls." });
        expect(current.server).not.toHaveBeenCalled();
    });

    it.each([
        ["off", { status: "off", message: PRICING_CONVERSATION_OFF }, { status: "off", error: PRICING_CONVERSATION_OFF }],
        ["server stale", { status: "stale", message: "changed" }, { status: "error", error: PRICING_SERVER_STALE }],
        ["other job's reply", { status: "reply", reply, provenance: { projectId: "other", estimateId: "estimate", revision: "x" } }, { status: "error", error: PRICING_SERVER_STALE }],
        ["refused", { status: "unavailable", message: "The pricing request could not be checked." }, { status: "error", error: "The pricing request could not be checked." }],
        ["network failure", new Error("offline"), { status: "error" }],
    ])("holds no review and changes nothing on %s", async (_name, result, expected) => {
        const { session } = mount({ pricingAssistantEnabled: true });
        current.turn.mockImplementation(async () => { if (result instanceof Error) throw result; return result; });
        const before = JSON.stringify(current.state);
        session.setMessage("Help"); await session.send();
        expect(session.getSnapshot().conversation).toMatchObject({ ...expected, pending: null });
        expect(JSON.stringify(current.state)).toBe(before);
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.server).not.toHaveBeenCalled();
    });

    it("ignores a late server answer after Stop waiting, and after the page is left", async () => {
        for (const leave of ["cancel", "detach"] as const) {
            const { session } = mount({ pricingAssistantEnabled: true });
            let release: (value: unknown) => void = () => {};
            current.turn.mockImplementation((input: { message: string }) => new Promise(resolve => { release = () => resolve(answer(input.message)); }));
            session.setMessage("Help"); const outcome = session.send();
            await vi.waitFor(() => expect(current.turn).toHaveBeenCalled());
            session[leave](); release(undefined);
            expect(await outcome).toBe("cancelled");
            expect(session.getSnapshot().conversation.pending).toBeNull();
            current.turn.mockReset();
        }
    });

    it("blocks a locked job with its reason instead of offering to send", () => {
        const { panel } = mount({ pricingAssistantEnabled: true, project: { ...project, payment_lock_reason: "This job has been won." } });
        expect(panel.props.blocked).toBe(true);
        const html = renderToStaticMarkup(panel);
        expect(html).toContain("This job has been won. The pricing assistant is not available for this job.");
        expect(html).toMatch(/<textarea[^>]*disabled/);
    });
});
