import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({
    state: null as EstimatingState | null,
    slots: [] as unknown[],
    cursor: 0,
    effects: new Map<number, () => void>(),
    dispatch: vi.fn(),
    action: vi.fn(),
    setItem: vi.fn(),
    getItem: vi.fn(() => null as string | null),
    guard: vi.fn(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useRef: (initial: unknown) => {
        const i = current.cursor++;
        return current.slots[i] ??= { current: initial };
    },
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) current.slots[i] = initial;
        return [current.slots[i], (value: unknown) => { current.slots[i] = typeof value === "function" ? value(current.slots[i]) : value; }];
    },
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
        const i = current.cursor++;
        const old = current.slots[i] as unknown[] | undefined;
        if (!old || !deps || deps.some((v, n) => !Object.is(v, old[n]))) {
            current.effects.get(i)?.();
            current.slots[i] = deps;
            const cleanup = effect();
            if (cleanup) current.effects.set(i, cleanup);
            else current.effects.delete(i);
        }
    },
    useMemo: (calculate: () => unknown) => calculate(),
}));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("@/lib/use-unsaved-guard", () => ({ useUnsavedGuard: current.guard }));
vi.mock("./simple-actions", () => ({
    saveSimplePriceLineAction: current.action,
    updateSimplePriceLineAction: current.action,
    deleteSimplePriceLineAction: current.action,
    savePriceAdjustmentsAction: current.action,
    loadAdvancedEstimatingDataAction: current.action,
}));

import EstimateClient from "./estimate-client";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function selector() {
    return nodes(view()).find(e => e.type === "select" && e.props.id === "estimate-version")!;
}

const project = { id: "job", name: "Kitchen job", client_name: "QA", brief_scope: "Fit cupboards" };
const estimate = (id: string, active: boolean): Estimate => ({
    id,
    project_id: "job",
    version_name: id === "a" ? "Original price" : "Alternative <price>",
    is_active: active,
    overhead_pct: 0,
    profit_pct: 0,
    risk_pct: 0,
    prelims_pct: 0,
    discount_pct: 0,
    discount_reason: "",
    total_cost: 100,
    estimate_lines: [],
});

function view(extra: { defaultTabId?: string } = {}) {
    current.cursor = 0;
    return EstimateClient({ estimates: [], project, ...extra });
}

function stubSession(overrides: Partial<{ getItem: () => string | null; setItem: (...args: unknown[]) => void }> = {}) {
    vi.stubGlobal("window", {
        sessionStorage: {
            getItem: overrides.getItem ?? current.getItem,
            setItem: overrides.setItem ?? current.setItem,
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        confirm: () => true,
    });
}

beforeEach(() => {
    current.state = initialEstimatingState([estimate("a", true), estimate("b", false)], { pendingEstimateId: "pending" });
    current.slots = [];
    current.cursor = 0;
    current.effects = new Map();
    current.getItem.mockReset().mockReturnValue(null);
    current.setItem.mockReset();
    current.action.mockReset();
    current.guard.mockReset();
    current.dispatch.mockReset().mockImplementation(action => {
        current.state = estimatingReducer(current.state!, action);
    });
    stubSession();
});

afterEach(() => {
    for (const cleanup of current.effects.values()) cleanup();
    vi.unstubAllGlobals();
});

describe("optional sessionStorage for estimate version preference", () => {
    it("restores a valid saved version on mount when storage read succeeds", () => {
        current.getItem.mockReturnValue("b");
        view();
        expect(current.getItem).toHaveBeenCalledWith("constructa_tab_job");
        expect(current.state!.activeEstimateId).toBe("b");
    });

    it("skips storage read when defaultTabId is set", () => {
        current.getItem.mockReturnValue("b");
        view({ defaultTabId: "a" });
        expect(current.getItem).not.toHaveBeenCalled();
        expect(current.state!.activeEstimateId).toBe("a");
    });

    it("keeps default selection when storage getItem throws", () => {
        stubSession({ getItem: () => { throw new DOMException("denied", "SecurityError"); } });
        expect(() => view()).not.toThrow();
        expect(current.state!.activeEstimateId).toBe("a");
    });

    it("keeps default selection when sessionStorage getter throws on mount", () => {
        vi.stubGlobal("window", {
            get sessionStorage() {
                throw new DOMException("denied", "SecurityError");
            },
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            confirm: () => true,
        });
        expect(() => view()).not.toThrow();
        expect(current.state!.activeEstimateId).toBe("a");
    });

    it("updates in-memory selection when setItem throws", () => {
        view();
        stubSession({
            getItem: current.getItem,
            setItem: () => { throw new DOMException("quota", "QuotaExceededError"); },
        });
        const change = selector().props.onChange as (event: unknown) => void;
        expect(() => change({ target: { value: "b" } })).not.toThrow();
        expect(current.state!.activeEstimateId).toBe("b");
    });

    it("ignores invalid selection and does not write storage", () => {
        view();
        (selector().props.onChange as (event: unknown) => void)({ target: { value: "unknown" } });
        expect(current.dispatch).not.toHaveBeenCalled();
        expect(current.setItem).not.toHaveBeenCalled();
    });

    it("does not switch versions when estimate work is open", () => {
        current.state = estimatingReducer(current.state!, {
            type: "op/open",
            key: NEW_LINE_KEY,
            kind: "add",
            lineId: "new",
            draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Draft" },
        });
        const snapshot = JSON.stringify(current.state);
        view();
        (selector().props.onChange as (event: unknown) => void)({ target: { value: "b" } });
        expect(JSON.stringify(current.state)).toBe(snapshot);
        expect(current.setItem).not.toHaveBeenCalled();
    });
});
