/**
 * Local offline fixture: an EXISTING line's quantity edit inside the optional
 * Advanced estimating workspace whose acknowledgement is ambiguous ("uncertain"),
 * and the fences that follow.
 *
 * REAL EstimateClient -> lazy AdvancedEstimate with its real quantity-draft
 * save flow, uncertainty fence and guarded controls. Synthetic saved estimate
 * with two owned simple lines in two activities.
 * MOCK transport, all explicit:
 *  - costs `./actions` and `./activity-actions` (compiler mocks) record every
 *    call and answer only from this fixture's script. `updateLineItemAction`
 *    answers "uncertain" (no write, ambiguous refusal) or "ack" (writes the
 *    submitted quantity and recomputed totals into the in-memory MOCK store);
 *    every other action is recorded as unexpected and refused;
 *  - EstimateClient's simple-price server refuses (expected unused);
 *  - loadAdvancedData answers with synthetic empty reference data.
 * No server, account, database, resource library or provider.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate } from "../../src/app/dashboard/projects/costs/types";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

type UpdateAnswer = "uncertain" | "ack";
interface ExistingPriceUncertainActions {
    actionCalls: { name: string; args: unknown[] }[];
    script: { update: UpdateAnswer[] };
    answer: (name: string, args: unknown[]) => Promise<unknown>;
}
export interface LocalExistingPriceUncertainFixture {
    /** The MOCK persisted estimate: synthetic saved lines plus acknowledged writes only. */
    estimates: Estimate[];
    updateAttempts: Array<{ lineId: string; updates: Record<string, unknown> }>;
    updateAcknowledgements: number;
    simpleServerCalls: string[];
    unexpectedWrites: string[];
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window {
        __existingPriceUncertainLocal: LocalExistingPriceUncertainFixture;
        __existingPriceUncertainActions: ExistingPriceUncertainActions;
    }
}

const PROJECT_ID = "local-existing-price-uncertain-job";
const ESTIMATE_ID = "local-existing-price-uncertain-estimate";

// about:blank has no storage origin; EstimateClient remembers its tab in sessionStorage.
const sessionValues = new Map<string, string>();
Object.defineProperty(window, "sessionStorage", { value: {
    get length() { return sessionValues.size; },
    clear: () => sessionValues.clear(),
    key: (index: number) => [...sessionValues.keys()][index] ?? null,
    getItem: (key: string) => sessionValues.get(key) ?? null,
    setItem: (key: string, value: string) => { sessionValues.set(String(key), String(value)); },
    removeItem: (key: string) => { sessionValues.delete(key); },
} satisfies Storage });

const line = (
    id: string,
    description: string,
    trade_section: string,
    quantity: number,
    unit: string,
    unit_rate: number,
): Estimate["estimate_lines"][number] => ({
    id,
    estimate_id: ESTIMATE_ID,
    description,
    quantity,
    unit,
    unit_rate,
    line_total: quantity * unit_rate,
    trade_section,
    line_type: "general",
    pricing_mode: "simple",
    estimate_line_components: [],
});

const fixture: LocalExistingPriceUncertainFixture = {
    estimates: [{
        id: ESTIMATE_ID,
        project_id: PROJECT_ID,
        version_name: "Estimate v1",
        prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0, discount_reason: "",
        total_cost: 740,
        is_active: true,
        estimate_lines: [
            line("line-paving", "TEST DATA - Lay block paving", "Groundworks", 10, "m2", 50),
            line("line-gutter", "TEST DATA - Replace gutter run", "Roofing", 8, "m", 30),
        ],
    }],
    updateAttempts: [],
    updateAcknowledgements: 0,
    simpleServerCalls: [],
    unexpectedWrites: [],
    router: {
        push: (href) => { throw new Error(`Local existing-price-uncertain fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__existingPriceUncertainLocal = fixture;

const actions: ExistingPriceUncertainActions = {
    actionCalls: [],
    script: { update: [] },
    async answer(name, args) {
        if (name === "updateLineItemAction") {
            const [lineId, updates] = args as [string, { quantity?: number; unit_rate?: number }];
            fixture.updateAttempts.push({ lineId, updates: structuredClone(updates) });
            const next = actions.script.update.shift() ?? "uncertain";
            if (next !== "ack") {
                // Ambiguous save: the write may or may not have landed; the
                // component must keep the acknowledged store untouched.
                return { success: false, error: "Local fixture: quantity save not confirmed; it may have saved." };
            }
            fixture.estimates = fixture.estimates.map(estimate => {
                if (estimate.id !== ESTIMATE_ID) return estimate;
                const estimate_lines = estimate.estimate_lines.map(row => {
                    if (row.id !== lineId) return row;
                    const quantity = updates.quantity ?? row.quantity;
                    const unit_rate = updates.unit_rate ?? row.unit_rate;
                    return { ...row, quantity, unit_rate, line_total: quantity * unit_rate };
                });
                return { ...estimate, estimate_lines, total_cost: estimate_lines.reduce((sum, row) => sum + (Number(row.line_total) || 0), 0) };
            });
            fixture.updateAcknowledgements += 1;
            const saved = fixture.estimates[0]!.estimate_lines.find(row => row.id === lineId)!;
            return { success: true, line: { id: lineId, quantity: saved.quantity, unit_rate: saved.unit_rate, line_total: saved.line_total } };
        }
        fixture.unexpectedWrites.push(name);
        return { success: false, error: `Local fixture: ${name} is refused in this leg.` };
    },
};
window.__existingPriceUncertainActions = actions;
// The shared compiler MOCK modules call this name; it is the same typed object.
(window as unknown as { __buildUpLocal: ExistingPriceUncertainActions }).__buildUpLocal = actions;

const refuseSimple = (name: string) => async () => {
    fixture.simpleServerCalls.push(name);
    return { ok: false as const, success: false as const, error: "Local fixture: simple price saves are outside this leg." };
};
const server = {
    saveLine: refuseSimple("saveLine"),
    updateLine: refuseSimple("updateLine"),
    deleteLine: refuseSimple("deleteLine"),
    saveAdjustments: refuseSimple("saveAdjustments"),
} as unknown as EstimatingServer;

createRoot(document.getElementById("app")!).render(
    <EstimateClient
        estimates={structuredClone(fixture.estimates)}
        project={{
            id: PROJECT_ID,
            name: "TEST DATA - Uncertain existing price edit",
            client_name: "TEST DATA - Synthetic client",
            brief_scope: "Lay block paving and replace a gutter run.",
        }}
        server={server}
        loadAdvancedData={async () => ({ ok: true, data: { orgId: "local-existing-price-uncertain-org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] } })}
    />,
);
