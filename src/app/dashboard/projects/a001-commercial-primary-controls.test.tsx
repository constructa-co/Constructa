import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coreFocusVisibleRing, corePrimaryButton } from "@/lib/core-editing-palette";

const current = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    seed: new Map<number, unknown>(),
    pending: false,
    transitions: [] as (() => unknown)[],
    refresh: vi.fn(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) {
            current.slots[i] = current.seed.has(i)
                ? current.seed.get(i)
                : typeof initial === "function"
                  ? (initial as () => unknown)()
                  : initial;
        }
        return [
            current.slots[i],
            (next: unknown) => {
                current.slots[i] =
                    typeof next === "function" ? (next as (v: unknown) => unknown)(current.slots[i]) : next;
            },
        ];
    },
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useCallback: (fn: unknown) => fn,
    useTransition: () => [current.pending, (fn: () => unknown) => { current.transitions.push(fn); }],
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: current.refresh, push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("./billing/actions", () => ({
    createAfpAction: vi.fn(async () => ({})),
    updateInvoiceStatusAction: vi.fn(async () => ({})),
    deleteInvoiceAction: vi.fn(async () => ({})),
    releaseRetentionAction: vi.fn(async () => ({})),
    createMilestoneAction: vi.fn(async () => ({})),
    deleteMilestoneAction: vi.fn(async () => ({})),
}));
vi.mock("./billing/invoice-pdf-button", () => ({ default: () => null }));
vi.mock("./variations/actions", () => ({
    createVariationAction: vi.fn(async () => ({})),
    updateVariationStatusAction: vi.fn(async () => ({})),
    deleteVariationAction: vi.fn(async () => ({})),
}));
vi.mock("./variations/variation-pdf-button", () => ({ default: () => null }));
vi.mock("./final-account/actions", () => ({
    upsertFinalAccountAction: vi.fn(async () => ({})),
    createAdjustmentAction: vi.fn(async () => ({})),
    deleteAdjustmentAction: vi.fn(async () => ({})),
}));
vi.mock("./final-account/final-account-pdf-button", () => ({ default: () => null }));

import ClientBilling from "./billing/client-billing";
import ClientVariations from "./variations/client-variations";
import FinalAccountClient from "./final-account/final-account-client";
import { createAfpAction, createMilestoneAction } from "./billing/actions";
import { createVariationAction } from "./variations/actions";
import { createAdjustmentAction } from "./final-account/actions";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...nodes(el.props.children)];
}

function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
    return "";
}

function tree(element: Element): Element[] {
    const out = (element.type as (p: Record<string, unknown>) => unknown)(element.props);
    return nodes(out);
}

const className = (e: Element) => String(e.props.className ?? "");
const button = (els: Element[], label: RegExp) =>
    els.find(e => e.type === "button" && e.props.type !== "submit" && label.test(text(e.props.children)))!;
const submitButton = (els: Element[], label: RegExp) =>
    els.find(e => e.props.type === "submit" && label.test(text(e.props.children)))!;

function expectBrandPrimary(e: Element) {
    expect(className(e)).toContain(corePrimaryButton);
    expect(className(e)).toContain(coreFocusVisibleRing);
    expect(className(e)).not.toMatch(/\bbg-blue-600\b|\bhover:bg-blue-500\b/);
}

const billingProps = {
    projectId: "job-1",
    project: { name: "Kitchen" },
    originalContractSum: 100_000,
    approvedVariationsTotal: 0,
    variations: [],
    initialInvoices: [],
    initialMilestones: [],
};

const variationsProps = {
    projectId: "job-1",
    project: { name: "Kitchen" },
    initialVariations: [],
};

const finalAccountProps = {
    projectId: "job-1",
    project: { name: "Kitchen" },
    profile: {},
    originalContractSum: 100_000,
    variations: [],
    invoices: [],
    finalAccount: { status: "Draft" },
    adjustments: [],
};

beforeEach(() => {
    current.slots = [];
    current.cursor = 0;
    current.seed = new Map();
    current.pending = false;
    current.transitions = [];
    current.refresh.mockReset();
    vi.mocked(createAfpAction).mockClear();
    vi.mocked(createMilestoneAction).mockClear();
    vi.mocked(createVariationAction).mockClear();
    vi.mocked(createAdjustmentAction).mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("A001 commercial workflow primary controls", () => {
    it("billing: New AFP and Add Milestone use brand primary without calling actions from the toolbar", () => {
        current.seed = new Map([[0, "valuations"]]);
        let els = tree(<ClientBilling {...billingProps} /> as Element);
        const newAfp = button(els, /New AFP/);
        expectBrandPrimary(newAfp);
        expect(newAfp.props.type).toBeUndefined();
        (newAfp.props.onClick as () => void)();
        expect(createAfpAction).not.toHaveBeenCalled();

        current.cursor = 0;
        current.slots = [];
        current.seed = new Map([[0, "schedule"]]);
        els = tree(<ClientBilling {...billingProps} /> as Element);
        const milestone = button(els, /Add Milestone/);
        expectBrandPrimary(milestone);
        (milestone.props.onClick as () => void)();
        expect(createMilestoneAction).not.toHaveBeenCalled();
        expect(els.some(e => className(e).includes("text-blue-400"))).toBe(true);
    });

    it("variations: Log Variation and Save Variation submit use brand primary; create action only on submit", () => {
        let els = tree(<ClientVariations {...variationsProps} /> as Element);
        const log = button(els, /Log Variation/);
        expectBrandPrimary(log);
        (log.props.onClick as () => void)();
        expect(createVariationAction).not.toHaveBeenCalled();

        current.cursor = 0;
        current.slots = [];
        current.seed = new Map([[0, true]]);
        els = tree(<ClientVariations {...variationsProps} /> as Element);
        const save = submitButton(els, /Save Variation/);
        expectBrandPrimary(save);
        expect(save.props.type).toBe("submit");
        expect(save.props.disabled).toBe(false);
    });

    it("final account: Update Status and Add Adjustment submit use brand primary; KPI metric blues remain", () => {
        let els = tree(<FinalAccountClient {...finalAccountProps} /> as Element);
        const status = button(els, /Update Status/);
        expectBrandPrimary(status);
        (status.props.onClick as () => void)();
        expect(createAdjustmentAction).not.toHaveBeenCalled();

        current.cursor = 0;
        current.slots = [];
        current.seed = new Map([[0, true]]);
        els = tree(<FinalAccountClient {...finalAccountProps} /> as Element);
        const addAdj = submitButton(els, /Add Adjustment/);
        expectBrandPrimary(addAdj);
        expect(addAdj.props.type).toBe("submit");
        const addAdjToolbar = button(els, /Add Adjustment/);
        expect(className(addAdjToolbar)).toContain("border-slate-600");
        expect(className(addAdjToolbar)).not.toMatch(/\bbg-blue-600\b/);
        expect(els.some(e => className(e).includes("text-blue-400"))).toBe(true);
    });
});
