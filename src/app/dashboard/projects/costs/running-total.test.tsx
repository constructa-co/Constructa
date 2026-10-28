import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Estimate } from "./types";
import { EMPTY_PRICE_LINE_DRAFT, NEW_LINE_KEY, draftFromLine, estimatingReducer, initialEstimatingState, type EstimatingState } from "@/lib/simple-estimate";

const current = vi.hoisted(() => ({ state: null as EstimatingState | null }));
vi.mock("@/lib/use-reducer-store", () => ({ useReducerStore: () => [current.state, { getState: () => current.state, dispatch: vi.fn() }] }));
vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./simple-actions", () => ({
    saveSimplePriceLineAction: vi.fn(), updateSimplePriceLineAction: vi.fn(),
    deleteSimplePriceLineAction: vi.fn(), savePriceAdjustmentsAction: vi.fn(), loadAdvancedEstimatingDataAction: vi.fn(),
}));

import EstimateClient from "./estimate-client";

function savedState() {
    const estimate: Estimate = {
        id: "estimate", project_id: "job", version_name: "Estimate", is_active: true,
        overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0,
        discount_reason: "", total_cost: 0,
        estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Example work", quantity: 1,
            unit: "item", unit_rate: 1100, line_total: 1100, trade_section: "General", line_type: "general",
            pricing_mode: "simple", estimate_line_components: [] }],
    };
    return initialEstimatingState([estimate], { pendingEstimateId: "pending" });
}
function markup(state: EstimatingState) {
    current.state = state;
    return renderToStaticMarkup(<EstimateClient estimates={[]} project={{ id: "job", name: "Example job", client_name: "", brief_scope: "" }} />);
}

describe("in-view estimate total", () => {
    it("repeats the existing summary figure with an honest uncertainty note and no save control", () => {
        const html = markup(savedState());
        const dock = html.match(/<aside[^>]*data-running-total[\s\S]*?<\/aside>/)?.[0];
        expect(dock).toBeDefined();
        const cardValue = html.match(/data-contract-sum[^>]*>([^<]+)/)?.[1];
        expect(cardValue).toBe("£1,100.00");
        expect(dock?.match(/data-in-view-contract-sum[^>]*>([^<]+)/)?.[1]).toBe(cardValue);
        expect(dock).toContain("Saved total before VAT");
        expect(dock).toContain("May include changes not yet confirmed.");
        expect(dock).not.toContain("data-in-view-draft-contract-sum");
        expect(dock).toMatch(/<details[^>]*open[^>]*data-running-total-disclosure/);
        expect(dock).toMatch(/<summary[^>]*>[\s\S]*Estimate total[\s\S]*data-in-view-contract-sum[^>]*>£1,100\.00[\s\S]*<\/summary>/);
        expect(dock).toMatch(/<div[^>]*data-running-total-values[\s\S]*Saved total before VAT[\s\S]*May include changes not yet confirmed\.[\s\S]*<\/div>\s*<\/details>/);
        expect(dock).not.toMatch(/<button|<input|<a /);
    });

    it("keeps the same contract sum on the summary and in the expanded panel", () => {
        const html = markup(savedState());
        const dock = html.match(/<aside[^>]*data-running-total[\s\S]*?<\/aside>/)?.[0] ?? "";
        const amounts = [...dock.matchAll(/data-in-view-contract-sum[^>]*>([^<]+)/g)].map((m) => m[1]);
        expect(amounts).toEqual(["£1,100.00", "£1,100.00"]);
    });

    it("labels a valid unsaved add draft separately without changing saved contract sums", () => {
        const state = estimatingReducer(savedState(), { type: "op/open", key: NEW_LINE_KEY,
            kind: "add", lineId: "unsent", draft: { ...EMPTY_PRICE_LINE_DRAFT, description: "Unsent", amount: "9000" } });
        const html = markup(state);
        expect(html.match(/data-in-view-contract-sum[^>]*>([^<]+)/)?.[1]).toBe("£1,100.00");
        expect(html.match(/data-contract-sum[^>]*>([^<]+)/)?.[1]).toBe("£1,100.00");
        expect(html.match(/data-in-view-draft-contract-sum[^>]*>([^<]+)/)?.[1]).toBe("£10,100.00");
        expect(html).toContain("data-running-total-draft-preview");
        expect(state.ops[NEW_LINE_KEY].draft.amount).toBe("9000");
    });

    it("shows saved and draft figures while a mounted line edit is open", () => {
        const base = savedState();
        const line = base.estimates[0].estimate_lines[0];
        let state = estimatingReducer(base, { type: "op/open", key: line.id, kind: "edit", lineId: line.id, draft: draftFromLine(line) });
        state = estimatingReducer(state, { type: "op/change", key: line.id, patch: { amount: "200" } });
        const html = markup(state);
        expect(html.match(/data-in-view-contract-sum[^>]*>([^<]+)/)?.[1]).toBe("£1,100.00");
        expect(html.match(/data-in-view-draft-contract-sum[^>]*>([^<]+)/)?.[1]).toBe("£200.00");
        expect(html.match(/data-contract-sum[^>]*>([^<]+)/)?.[1]).toBe("£1,100.00");
    });

    it("withholds a draft preview while the open draft is invalid", () => {
        const base = savedState();
        const line = base.estimates[0].estimate_lines[0];
        let state = estimatingReducer(base, { type: "op/open", key: line.id, kind: "edit", lineId: line.id, draft: draftFromLine(line) });
        state = estimatingReducer(state, { type: "op/change", key: line.id, patch: { amount: "0" } });
        const html = markup(state);
        expect(html.match(/data-in-view-contract-sum[^>]*>([^<]+)/)?.[1]).toBe("£1,100.00");
        expect(html).not.toContain("data-in-view-draft-contract-sum");
        expect(html).toContain("May include changes not yet confirmed.");
    });
});
