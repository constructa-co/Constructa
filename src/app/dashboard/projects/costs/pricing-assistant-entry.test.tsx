import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";
import type { PricingConversationGenerator } from "@/lib/pricing-conversation";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, server: vi.fn(), dispatch: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(), useEffect: () => undefined, useMemo: (calculate: () => unknown) => calculate(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (value: unknown) => { current.slots[i] = typeof value === "function" ? value(current.slots[i]) : value; }];
    },
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.server, updateSimplePriceLineAction: current.server, deleteSimplePriceLineAction: current.server, savePriceAdjustmentsAction: current.server, loadAdvancedEstimatingDataAction: current.server }));
import EstimateClient from "./estimate-client";
import type { PricingAssistantSession } from "@/lib/pricing-assistant-session";

type Element = ReactElement<Record<string, unknown>>;
const project = { id: "job", name: "Example room", client_name: "QA", brief_scope: "Prepare walls. Paint walls.\n\nSite, access and assumptions:\nPrivate access notes." };
const reply = { message: "Review this source activity.", suggestions: [{ source: "briefWork", start: 0, end: 14 }] };
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function session(generate?: PricingConversationGenerator) {
    current.cursor = 0;
    const view = EstimateClient({ estimates: [], project, pricingGenerator: generate });
    const panel = nodes(view).find(e => e.props.session);
    expect(panel).toBeDefined();
    return panel!.props.session as PricingAssistantSession;
}
beforeEach(() => {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Main", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 777, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Existing work", quantity: 3, unit: "item", unit_rate: 259, line_total: 777, trade_section: "General", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.slots = []; current.cursor = 0; current.server.mockReset();
    current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
});

describe("actual pricing parent assistant boundary (unit-injected replies only)", () => {
    it("is mounted honestly unavailable by default and makes no action call", async () => {
        const c = session();
        expect(c.getSnapshot().available).toBe(false);
        await c.send();
        expect(c.getSnapshot().conversation.status).toBe("off");
        expect(current.server).not.toHaveBeenCalled(); expect(current.dispatch).not.toHaveBeenCalled();
    });
    it("passes only allowlisted job context to the injected generator and holds review without changing lines", async () => {
        const generate = vi.fn<PricingConversationGenerator>().mockResolvedValue(reply), c = session(generate), before = JSON.stringify(current.state);
        c.setMessage("Help organise preparation"); await c.send();
        expect(c.getSnapshot().conversation.pending?.suggestions[0].description).toBe("Prepare walls.");
        expect(JSON.stringify(generate.mock.calls[0][0])).not.toMatch(/Private access|projectId|estimateId|unit_rate|777|259/);
        expect(JSON.stringify(current.state)).toBe(before); expect(current.server).not.toHaveBeenCalled();
    });
    it("opens one unpriced existing-form draft only after the explicit reviewed choice", async () => {
        const c = session(async () => reply), before = JSON.stringify(current.state!.estimates);
        c.setMessage("Review preparation"); await c.send();
        expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined();
        expect(c.choose(0)).toEqual({ ok: true });
        expect(current.state!.ops[NEW_LINE_KEY].draft).toEqual({ ...EMPTY_PRICE_LINE_DRAFT, description: "Prepare walls." });
        expect(c.choose(0).ok).toBe(false);
        expect(current.dispatch).toHaveBeenCalledTimes(1); expect(JSON.stringify(current.state!.estimates)).toBe(before);
        expect(current.server).not.toHaveBeenCalled();
    });
    it.each(["price", "open-line", "adjustments", "advanced", "version"])("rechecks %s at the actual choice boundary without overwriting or saving", async change => {
        const c = session(async () => reply); c.setMessage("Review preparation"); await c.send();
        if (change === "price") current.state!.estimates[0].estimate_lines[0].unit_rate = 999;
        if (change === "open-line") current.state = estimatingReducer(current.state!, { type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "draft", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "My typing" } });
        if (change === "adjustments") current.state!.adjustments.status = "saving";
        if (change === "advanced") current.state!.advancedOpen = true;
        if (change === "version") current.state!.estimates[0].id = "other-version";
        const before = JSON.stringify(current.state);
        expect(c.choose(0).ok).toBe(false); expect(JSON.stringify(current.state)).toBe(before);
        expect(current.server).not.toHaveBeenCalled();
    });
    it("keeps blank-first-estimate creation inside the existing unsaved line path", async () => {
        current.state = initialEstimatingState([], { pendingEstimateId: "pending" });
        const c = session(async () => reply); c.setMessage("Start preparation"); await c.send(); expect(c.choose(0).ok).toBe(true);
        expect(current.state!.estimates).toEqual([]); expect(current.state!.ops[NEW_LINE_KEY].draft.amount).toBe("");
        expect(current.server).not.toHaveBeenCalled();
    });
});
