import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";
import { reviewSavedLine, type SavedLineReuseContext, type ReviewedSavedLine } from "@/lib/saved-line-reuse";
const current = vi.hoisted(() => ({ state: null as EstimatingState | null, slots: [] as unknown[], cursor: 0, effects: new Map<number, () => void>(), server: vi.fn(), dispatch: vi.fn(), guard: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useRef: (initial: unknown) => { const i = current.cursor++; return current.slots[i] ??= { current: initial }; },
    useState: (initial: unknown) => {
        const i = current.cursor++; if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (value: unknown) => { current.slots[i] = typeof value === "function" ? value(current.slots[i]) : value; }];
    },
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
        const i = current.cursor++, old = current.slots[i] as unknown[] | undefined;
        if (!old || !deps || deps.some((v, n) => !Object.is(v, old[n]))) {
            current.effects.get(i)?.(); current.slots[i] = deps; const cleanup = effect(); if (cleanup) current.effects.set(i, cleanup); else current.effects.delete(i);
        }
    },
    useMemo: (calculate: () => unknown) => calculate(),
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: current.guard }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.server, updateSimplePriceLineAction: current.server, deleteSimplePriceLineAction: current.server, savePriceAdjustmentsAction: current.server, loadAdvancedEstimatingDataAction: current.server }));
import EstimateClient from "./estimate-client";
import SavedLineReuse from "@/components/saved-line-reuse";
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] { if (Array.isArray(value)) return value.flatMap(nodes); if (!value || typeof value !== "object" || !("props" in value)) return []; const node = value as Element; return [node, ...nodes(node.props.children)]; }
const project = { id: "job", name: "Room", client_name: "", brief_scope: "Saved work", proposal_introduction: "Opening", payment_schedule: [], full_scope: { scope_text: "Scope", brief_scope: "Saved work" } };
function view(patch: Partial<typeof project> & { payment_lock_reason?: string | null } = {}) { current.cursor = 0; return EstimateClient({ estimates: [], project: { ...project, ...patch } }); }
function chooser() { return nodes(view()).find(n => n.type === SavedLineReuse)!; }
function reviewed(element = chooser()) { const context = (element.props.context as { ok: true; value: SavedLineReuseContext }).value; return reviewSavedLine(context.sources[0], context); }
function open(element = chooser(), pending = reviewed(element)) { return (element.props.onOpen as (p: ReviewedSavedLine) => { ok: boolean; error?: string })(pending); }
function row() { return nodes(view()).find(n => n.props["data-inline-add"])!; }
beforeEach(() => {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Current", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 777,
        estimate_lines: [{ id: "source", estimate_id: "estimate", description: "Fit doors, excluding frames", quantity: 3, unit: "item", unit_rate: 259, line_total: 777, trade_section: "Carpentry", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" }); current.slots = []; current.cursor = 0; current.effects = new Map();
    current.server.mockReset(); current.guard.mockReset(); current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
    vi.stubGlobal("window", { sessionStorage: { getItem: () => null, setItem: vi.fn() }, addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: () => true });
});
afterEach(() => { for (const cleanup of current.effects.values()) cleanup(); vi.unstubAllGlobals(); });
describe("saved wording reuse in real pricing parent/controller", () => {
    it("opens ONE unpriced draft without touching original rows,IDs,order,prices or resources;Cancel writes nothing", () => {
        const old = chooser(), before = JSON.stringify(current.state!.estimates); expect(open(old)).toEqual({ ok: true });
        expect(current.state!.ops[NEW_LINE_KEY].draft).toEqual({ ...EMPTY_PRICE_LINE_DRAFT, description: "Fit doors, excluding frames", activity: "Carpentry" });
        expect(current.state!.ops[NEW_LINE_KEY].lineId).not.toBe("source");
        (row().props.onChange as (patch: unknown) => void)({ description: "Later typed work", amount: "123" }); expect(open(old).ok).toBe(false);
        expect(current.state!.ops[NEW_LINE_KEY].draft.description).toBe("Later typed work"); expect(current.server).not.toHaveBeenCalled();
        (row().props.onCancel as () => void)(); expect(JSON.stringify(current.state!.estimates)).toBe(before); expect(current.server).not.toHaveBeenCalled();
    });
    it("uses unchanged explicit per-line Save/controller for one new priced row and reviewed activity", async () => {
        open(); (row().props.onChange as (patch: unknown) => void)({ amount: "100" }); expect(current.server).not.toHaveBeenCalled();
        current.server.mockImplementationOnce(async request => ({ ok: true, estimateId: "estimate", line: { id: request.lineId, estimate_id: "estimate", ...request.line, trade_section: request.activity, line_total: 100 } }));
        (row().props.onSave as () => void)(); await Promise.resolve(); await Promise.resolve();
        expect(current.server).toHaveBeenCalledOnce(); expect(current.server.mock.calls[0][0]).toMatchObject({ activity: "Carpentry", line: { description: "Fit doors, excluding frames", quantity: 1, unit: "item", unit_rate: 100 } });
        expect(current.state!.estimates[0].estimate_lines[0].id).toBe("source"); expect(current.state!.estimates[0].total_cost).toBe(877);
    });
    it("retains failed/pending draft identity and pricing inputs and refuses another reuse", async () => {
        const old = chooser(); open(old); const id = current.state!.ops[NEW_LINE_KEY].lineId;
        (row().props.onChange as (patch: unknown) => void)({ amount: "100" }); current.server.mockResolvedValueOnce({ ok: false, error: "Failed" });
        (row().props.onSave as () => void)(); expect(open(old).ok).toBe(false); await Promise.resolve(); await Promise.resolve();
        expect(current.state!.ops[NEW_LINE_KEY]).toMatchObject({ lineId: id, status: "failed", draft: { amount: "100", activity: "Carpentry" } }); expect(open(old).ok).toBe(false);
    });
    it("leaves Save-and-add-next blank instead of auto-copying or creating another line", async () => {
        open(); (row().props.onChange as (patch: unknown) => void)({ amount: "100" });
        current.server.mockImplementationOnce(async request => ({ ok: true, estimateId: "estimate", line: { id: request.lineId, estimate_id: "estimate", ...request.line, trade_section: request.activity, line_total: 100 } }));
        await (row().props.onSaveNext as () => Promise<boolean>)(); expect(current.server).toHaveBeenCalledOnce();
        expect(current.state!.ops[NEW_LINE_KEY].draft).toMatchObject({ description: "", amount: "", quantity: "", rate: "" });
        expect(current.state!.ops[NEW_LINE_KEY].draft.activity).toBeUndefined();
    });
    it.each(["edit", "delete", "adjustments", "advanced", "boq", "removed", "sourceChanged", "versionChanged"])("fences current %s boundary with an old reuse handler", boundary => {
        const old = chooser(), pending = reviewed(old);
        if (boundary === "edit" || boundary === "delete") current.dispatch({ type: "op/open", key: "source", kind: boundary, lineId: "source", draft: EMPTY_PRICE_LINE_DRAFT });
        if (boundary === "adjustments") current.state!.adjustments.status = "saving";
        if (boundary === "advanced") current.state!.advancedOpen = true;
        if (boundary === "boq") current.state!.estimates[0].is_client_boq = true;
        if (boundary === "removed") current.state!.estimates[0].estimate_lines = [];
        if (boundary === "sourceChanged") current.state!.estimates[0].estimate_lines[0].trade_section = "Changed";
        if (boundary === "versionChanged") current.state!.estimates[0].id = "another";
        expect(open(old, pending).ok).toBe(false); expect(current.state!.ops[NEW_LINE_KEY]).toBeUndefined(); expect(current.server).not.toHaveBeenCalled();
    });
    it.each(["saving", "uncertain", "draft"] as const)("fences %s resource/library/line ledgers", status => {
        const old = chooser();
        const slot = current.slots.findIndex(value => value && typeof value === "object" && "status" in value && value.status === "idle" && "data" in value && "error" in value);
        expect(slot).toBeGreaterThanOrEqual(0);
        current.slots[slot] = { status: "ready", error: "", data: { orgId: "org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] } };
        current.state!.advancedOpen = true;
        const advanced = nodes(view()).find(n => typeof n.props.onResourceSaveStateChanged === "function")!;
        current.state!.advancedOpen = false;
        (advanced.props.onResourceSaveStateChanged as (id: string, status: string) => void)("library:source", status);
        expect(open(old).ok).toBe(false); expect(current.server).not.toHaveBeenCalled();
    });
    it.each(["opening", "fullscope", "payment"])("fences independent %s proposal work", kind => {
        const old = chooser(), tree = nodes(view());
        const editor = tree.find(n => typeof n.props.onWorkChange === "function" && (kind === "opening" ? n.props.source === "Opening" : kind === "fullscope" ? (n.props.source as { scope_text?: string } | undefined)?.scope_text === "Scope" : "schedule" in n.props))!;
        (editor.props.onWorkChange as (open: boolean) => void)(true); expect(open(old).ok).toBe(false); expect(current.server).not.toHaveBeenCalled();
    });
    it("rechecks fresh brief/project/lock and refuses after unmount", () => {
        const old = chooser(), pending = reviewed(old); view({ brief_scope: "Revised brief" }); expect(open(old, pending).ok).toBe(false);
        view({ id: "other" }); expect(open(old, pending).ok).toBe(false); view({ payment_lock_reason: "Accepted" }); expect(open(old, pending).ok).toBe(false);
        for (const cleanup of current.effects.values()) cleanup(); expect(open(old, pending).ok).toBe(false); expect(current.server).not.toHaveBeenCalled();
    });
});
