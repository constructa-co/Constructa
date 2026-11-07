/**
 * Local offline fixture: changing the activity of an EXISTING line inside the
 * optional Advanced estimating workspace, and how lines are grouped by activity.
 *
 * REAL EstimateClient -> lazy AdvancedEstimate with its own activity control,
 * gates and grouping. Synthetic saved estimate with four owned lines:
 *  - two simple lines in "Groundworks" (the supported path);
 *  - one built-up line with a saved resource, and one Preliminaries line
 *    (both unsupported by this control, by source).
 * MOCK transport, all explicit:
 *  - `savePriceLineActivityAction` (compiler `activity-actions-mock`) and the
 *    costs `./actions` (compiler `build-up-actions`) record every call and answer
 *    only from the spec's script. An acknowledgement is built from the submitted
 *    arguments and writes only `trade_section` into the in-memory MOCK store;
 *  - EstimateClient's simple-price server refuses (expected unused);
 *  - loadAdvancedData answers with synthetic empty reference data.
 * No server, account, database, resource library or provider.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate } from "../../src/app/dashboard/projects/costs/types";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

type ActivityAnswer = "ack" | "refuse" | "uncertain";
interface ActivityGroupingActions {
    actionCalls: { name: string; args: unknown[] }[];
    script: { activity: ActivityAnswer[] };
    answer: (name: string, args: unknown[]) => Promise<unknown>;
}
export interface LocalActivityGroupingFixture {
    /** The MOCK persisted estimate: synthetic saved lines plus acknowledged writes only. */
    estimates: Estimate[];
    simpleServerCalls: string[];
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window { __activityGroupingLocal: LocalActivityGroupingFixture; __activityGroupingActions: ActivityGroupingActions }
}

const PROJECT_ID = "local-activity-grouping-job";
const ESTIMATE_ID = "local-activity-grouping-estimate";

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

const line = (id: string, description: string, trade_section: string, quantity: number, unit: string, unit_rate: number, extra: Partial<Estimate["estimate_lines"][number]> = {}): Estimate["estimate_lines"][number] => ({
    id, estimate_id: ESTIMATE_ID, description, quantity, unit, unit_rate, line_total: quantity * unit_rate,
    trade_section, line_type: "general", pricing_mode: "simple", estimate_line_components: [], ...extra,
});

const fixture: LocalActivityGroupingFixture = {
    estimates: [{
        id: ESTIMATE_ID, project_id: PROJECT_ID, version_name: "Estimate v1",
        prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0, discount_reason: "",
        total_cost: 1240, is_active: true,
        estimate_lines: [
            line("line-excavate", "Excavate driveway", "Groundworks", 20, "m2", 12),
            line("line-paving", "Lay block paving", "Groundworks", 10, "m2", 50),
            line("line-kerbs", "Edging kerbs", "External Works", 20, "m", 15, {
                pricing_mode: "buildup",
                estimate_line_components: [{
                    id: "component-kerb-labour", estimate_line_id: "line-kerbs", component_type: "labour", description: "Kerb labour",
                    quantity: 20, unit: "hr", unit_rate: 15, line_total: 300, manhours_per_unit: 1, total_manhours: 20, sort_order: 0,
                }],
            }),
            line("line-welfare", "Site welfare", "Preliminaries", 1, "item", 200),
        ],
    }],
    simpleServerCalls: [],
    router: {
        push: (href) => { throw new Error(`Local activity fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__activityGroupingLocal = fixture;

const actions: ActivityGroupingActions = {
    actionCalls: [],
    script: { activity: [] },
    async answer(name, args) {
        if (name !== "savePriceLineActivityAction") throw new Error(`Local activity fixture does not answer ${name}`);
        const [input] = args as [{ lineId: string; estimateId: string; expectedSection: string | null; section: string }];
        const next = actions.script.activity.shift();
        if (next === "uncertain") return { ok: false, uncertain: true, error: "Local fixture: activity save not confirmed." };
        if (next !== "ack") return { ok: false, error: "Local fixture: activity not acknowledged." };
        fixture.estimates = fixture.estimates.map(estimate => estimate.id !== input.estimateId ? estimate : {
            ...estimate,
            estimate_lines: estimate.estimate_lines.map(row => row.id === input.lineId ? { ...row, trade_section: input.section } : row),
        });
        return { ok: true, lineId: input.lineId, estimateId: input.estimateId, section: input.section };
    },
};
window.__activityGroupingActions = actions;
// The shared compiler MOCK modules call this name; it is the same typed object.
(window as unknown as { __buildUpLocal: ActivityGroupingActions }).__buildUpLocal = actions;

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
        project={{ id: PROJECT_ID, name: "TEST DATA - Driveway activities", client_name: "TEST DATA - Synthetic client", brief_scope: "Excavate and pave a driveway with kerbs." }}
        server={server}
        loadAdvancedData={async () => ({ ok: true, data: { orgId: "local-activity-org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] } })}
    />,
);
