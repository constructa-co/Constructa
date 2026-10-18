import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AreaQuantityAidProps } from "@/components/area-quantity-aid";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";
import type { Estimate } from "./types";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, aid: null as AreaQuantityAidProps | null, dispatch: vi.fn(), server: vi.fn() }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: current.dispatch }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./simple-actions", () => ({ saveSimplePriceLineAction: current.server, updateSimplePriceLineAction: current.server, deleteSimplePriceLineAction: current.server, savePriceAdjustmentsAction: current.server, loadAdvancedEstimatingDataAction: current.server }));
vi.mock("@/components/area-quantity-aid", () => ({ default: (props: AreaQuantityAidProps) => { current.aid = props; return null; } }));
import EstimateClient from "./estimate-client";

beforeEach(() => {
    const estimate: Estimate = { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 500, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Prepare walls", quantity: 10, unit: "m2", unit_rate: 50, line_total: 500, trade_section: "Decoration", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
    current.state = initialEstimatingState([estimate], { pendingEstimateId: "pending" });
    current.aid = null; current.server.mockReset(); current.dispatch.mockReset().mockImplementation(action => { current.state = estimatingReducer(current.state!, action); });
});
function view() {
    current.aid = null;
    return renderToStaticMarkup(<EstimateClient estimates={[]} project={{ id: "job", name: "Example room", client_name: "", brief_scope: "Prepare walls" }} />);
}
describe("measurement aid draft boundary", () => {
    it.each(["line", NEW_LINE_KEY])("updates only the open %s draft quantity, never saved data or financial actions", key => {
        current.state = estimatingReducer(current.state!, { type: "op/open", key, kind: key === NEW_LINE_KEY ? "add" : "edit", lineId: key, draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Prepare walls", mode: "rate", quantity: "10", unit: "m2", rate: "50" } });
        const before = JSON.stringify(current.state.estimates);
        view(); expect(current.aid).not.toBeNull();
        current.aid!.onUse("0.02");
        expect(current.dispatch).toHaveBeenCalledExactlyOnceWith({ type: "op/change", key, patch: { quantity: "0.02" } });
        expect(current.state!.ops[key].draft).toMatchObject({ description: "Prepare walls", mode: "rate", unit: "m2", rate: "50", quantity: "0.02" });
        expect(JSON.stringify(current.state!.estimates)).toBe(before);
        expect(current.server).not.toHaveBeenCalled();
    });
    it("does not mount measurement controls in a lump-sum form", () => {
        current.state = estimatingReducer(current.state!, { type: "op/open", key: "line", kind: "edit", lineId: "line", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Whole job", mode: "amount", amount: "500" } });
        view(); expect(current.aid).toBeNull(); expect(current.server).not.toHaveBeenCalled();
    });
    it("passes the unchanged selected unit without automatic conversion", () => {
        current.state = estimatingReducer(current.state!, { type: "op/open", key: "line", kind: "edit", lineId: "line", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Work", mode: "rate", quantity: "10", unit: "hr", rate: "50" } });
        view(); expect(current.aid?.unit).toBe("hr");
        expect(current.dispatch).not.toHaveBeenCalled(); expect(current.server).not.toHaveBeenCalled();
    });
});
