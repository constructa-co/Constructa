import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { Estimate, EstimateLine } from "./types";

const replay = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    other: vi.fn(),
    margins: vi.fn(),
    discount: vi.fn(),
    toastError: vi.fn(),
    estimates: [] as unknown[],
    confirmDiscount: null as (() => void) | null,
    cancelDiscount: null as (() => void) | null,
}));
vi.mock("react", async (original) => ({
    ...(await original<typeof import("react")>()),
    useState: (initial: unknown) => {
        const i = replay.cursor++;
        if (!(i in replay.slots)) replay.slots[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [replay.slots[i], (value: unknown) => {
            replay.slots[i] = typeof value === "function" ? (value as (prev: unknown) => unknown)(replay.slots[i]) : value;
        }];
    },
    useRef: (initial: unknown) => {
        const i = replay.cursor++;
        if (!(i in replay.slots)) replay.slots[i] = { current: initial };
        return replay.slots[i];
    },
    useId: () => "discount-confirm-test",
    useCallback: (callback: unknown) => callback,
    useEffect: () => undefined,
    useTransition: () => [false, (callback: () => unknown) => { void callback(); }],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./actions", () => ({
    createEstimateAction: replay.other,
    updateEstimateMarginsAction: replay.margins,
    updateEstimateNameAction: replay.other,
    addLineItemAction: replay.other,
    updateLineItemAction: replay.other,
    deleteLineItemAction: replay.other,
    setActiveEstimateAction: replay.other,
    deleteEstimateAction: replay.other,
    setPricingModeAction: replay.other,
    saveDiscountAction: replay.discount,
}));
vi.mock("./build-up-panel", () => ({ default: () => null }));
vi.mock("./boq-import", () => ({ default: () => null }));
vi.mock("./boq-excel-export", () => ({ exportBoQToExcel: replay.other }));
vi.mock("@/app/dashboard/foundations/vision-takeoff", () => ({ default: () => null }));
vi.mock("@/lib/launch-profile", () => ({ isCapabilityEnabled: () => false }));
vi.mock("sonner", () => ({ toast: { error: replay.toastError, success: replay.other } }));
vi.mock("./discount-confirm-dialog", () => ({
    HighDiscountConfirmDialog: (props: { onCancel: () => void; onConfirm: () => void; discountPct: number }) => {
        replay.cancelDiscount = props.onCancel;
        replay.confirmDiscount = props.onConfirm;
        return {
            type: "high-discount-confirm-dialog",
            props,
        };
    },
}));
import AdvancedEstimate from "./advanced-estimate";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
let rendered: Element[] | null = null;
function view() {
    replay.cursor = 0;
    rendered = nodes(AdvancedEstimate({
        estimates: replay.estimates as Estimate[],
        setEstimates: (update) => { replay.estimates = update(replay.estimates as Estimate[]); },
        activeTab: "a",
        setActiveTab: replay.other,
        costLibrary: [],
        projectId: "job",
        orgId: "org",
        rateBuildups: [],
        labourRates: [],
        preferredTrades: [],
    }));
    return rendered;
}
type Handler = (event?: { target: { value: string } }) => void;
const field = (label: string) => rendered!.find((e) => e.type === "input" && e.props["aria-label"] === label)!;
const fire = (label: string, handler: "onFocus" | "onChange" | "onBlur", value?: string) =>
    (field(label).props[handler] as Handler)(value === undefined ? undefined : { target: { value } });
const edit = (label: string, value: string) => {
    view();
    fire(label, "onFocus");
    fire(label, "onChange", value);
    view();
    fire(label, "onBlur", value);
    view();
};

const line: EstimateLine = {
    id: "l1", estimate_id: "a", description: "Line", quantity: 2, unit: "m2", unit_rate: 40, line_total: 80,
    trade_section: "Groundworks", line_type: "general", pricing_mode: "simple", estimate_line_components: [],
};
const estimate = (): Estimate => ({
    id: "a", project_id: "job", version_name: "Saved a", overhead_pct: 5, profit_pct: 10, risk_pct: 2, prelims_pct: 3,
    discount_pct: 4, discount_reason: "Returning client", total_cost: 80, is_active: true, estimate_lines: [line],
});

beforeEach(() => {
    replay.slots = [];
    replay.cursor = 0;
    replay.estimates = [estimate()];
    replay.other.mockReset();
    replay.margins.mockReset();
    replay.discount.mockReset().mockResolvedValue({ success: true });
    replay.toastError.mockReset();
    replay.confirmDiscount = null;
    replay.cancelDiscount = null;
    rendered = null;
});

describe("CON-069 Advanced discount confirm", () => {
    it("saves a 25% discount on blur without confirmation", () => {
        edit("Discount %", "25");
        expect(replay.discount).toHaveBeenCalledExactlyOnceWith("a", 25, "Returning client");
    });

    it("does not autosave a discount above 25% on blur alone", () => {
        edit("Discount %", "40");
        expect(replay.discount).not.toHaveBeenCalled();
    });

    it("rolls back an unconfirmed high discount after tabbing to reason with no reason", () => {
        replay.estimates = [{ ...estimate(), discount_reason: "" }];
        view();
        fire("Discount %", "onFocus");
        fire("Discount %", "onChange", "40");
        view();
        fire("Discount %", "onBlur", "40");
        expect((replay.estimates[0] as Estimate).discount_pct).toBe(4);
        expect(replay.discount).not.toHaveBeenCalled();
        view();
        fire("Discount Reason", "onFocus");
        expect((replay.estimates[0] as Estimate).discount_pct).toBe(4);
    });

    it("cancel on high-discount confirm restores acknowledged discount without saving", () => {
        edit("Discount %", "40");
        expect(replay.discount).not.toHaveBeenCalled();
        expect(replay.slots).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ discountPct: 40, savedDiscount: 4, savedReason: "Returning client" }),
            ]),
        );
        const dialog = view().find((e) => e.props?.discountPct === 40);
        expect(dialog).toBeTruthy();
        (dialog!.props.onCancel as () => void)();
        expect((replay.estimates[0] as Estimate).discount_pct).toBe(4);
        expect((replay.estimates[0] as Estimate).discount_reason).toBe("Returning client");
        expect(replay.discount).not.toHaveBeenCalled();
    });

    it("rolls back and clears pending confirm when save rejects", async () => {
        replay.discount.mockResolvedValueOnce({ success: false, error: "locked" });
        edit("Discount %", "40");
        const dialog = view().find((e) => e.props?.discountPct === 40)!;
        (dialog.props.onConfirm as () => void)();
        await Promise.resolve();
        expect((replay.estimates[0] as Estimate).discount_pct).toBe(4);
        expect(view().find((e) => e.props?.discountPct === 40)).toBeUndefined();
    });
});