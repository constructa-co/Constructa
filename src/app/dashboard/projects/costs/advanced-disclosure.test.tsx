import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null, load: vi.fn() }));
vi.mock("@/lib/use-reducer-store", () => ({
    useReducerStore: () => [current.state, { getState: () => current.state, dispatch: vi.fn() }],
}));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./simple-actions", () => ({
    saveSimplePriceLineAction: vi.fn(), updateSimplePriceLineAction: vi.fn(),
    deleteSimplePriceLineAction: vi.fn(), savePriceAdjustmentsAction: vi.fn(),
    loadAdvancedEstimatingDataAction: current.load,
}));

import EstimateClient from "./estimate-client";

function markup(state: EstimatingState) {
    current.state = state;
    return renderToStaticMarkup(<EstimateClient estimates={[]} project={{ id: "job-b", name: "Example renovation", client_name: "Synthetic client", brief_scope: "Example work" }} />);
}
function openLine() {
    return estimatingReducer(initialEstimatingState([], { pendingEstimateId: "pending" }), {
        type: "op/open", key: NEW_LINE_KEY, kind: "add", lineId: "local", draft: EMPTY_PRICE_LINE_DRAFT,
    });
}

describe("Advanced estimating pre-open disclosure", () => {
    it("describes the existing discard boundary before an open line form is closed", () => {
        const html = markup(openLine());
        expect(html).toContain('id="advanced-line-warning"');
        expect(html).toContain('aria-describedby="advanced-line-warning"');
        expect(html).toContain("Opening Advanced estimating closes open price-line forms without saving their changes. Save or cancel your line first.");
        expect(html).toContain('aria-expanded="false"');
        expect(current.load).not.toHaveBeenCalled();
    });

    it("removes the warning after the existing explicit line cancellation", () => {
        const clean = estimatingReducer(openLine(), { type: "op/cancel", key: NEW_LINE_KEY });
        const html = markup(clean);
        expect(html).not.toContain("advanced-line-warning");
        expect(html).toContain("Advanced estimating");
        expect(current.load).not.toHaveBeenCalled();
    });
});
