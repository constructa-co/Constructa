/**
 * Local offline fixture: optional detailed build-up inside the actual pricing page.
 *
 * REAL EstimateClient -> real lazy AdvancedEstimate -> real BuildUpPanel, with
 * their real component maths (resource total, built-up rate) and the parent's
 * real running total. Simulated transport, all explicit:
 *  - EstimateClient's injected simple-price server records and refuses (unused);
 *  - loadAdvancedData answers with synthetic empty reference data;
 *  - the costs `./actions` module is replaced by the compiler's `build-up`
 *    MOCK module, which records every call and answers only from the
 *    acknowledgement/refusal script below, set by the spec.
 * No server, account, database, resource library, network or provider.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate } from "../../src/app/dashboard/projects/costs/types";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

type ApplyAnswer = { refuse: true } | { ack: { unitRate: number; quantity: number; lineTotal: number } };
export interface LocalBuildUpFixture {
    /** Every call reaching the MOCK costs actions module, in order. */
    actionCalls: { name: string; args: unknown[] }[];
    simpleServerCalls: string[];
    script: { addComponent: ("ack" | "refuse")[]; applyRate: ApplyAnswer[] };
    answer: (name: string, args: unknown[]) => Promise<unknown>;
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window { __buildUpLocal: LocalBuildUpFixture }
}

const PROJECT_ID = "local-build-up-job";
const ESTIMATE_ID = "local-build-up-estimate";
export const BUILD_UP_LINE_ID = "local-build-up-line";

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

const estimates: Estimate[] = [{
    id: ESTIMATE_ID,
    project_id: PROJECT_ID,
    version_name: "Estimate v1",
    prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0, discount_reason: "",
    total_cost: 500,
    is_active: true,
    estimate_lines: [{
        id: BUILD_UP_LINE_ID,
        estimate_id: ESTIMATE_ID,
        description: "Lay block paving",
        quantity: 10,
        unit: "m²",
        unit_rate: 50,
        line_total: 500,
        trade_section: "General",
        line_type: "general",
        pricing_mode: "simple",
        estimate_line_components: [],
    }],
}];

const fixture: LocalBuildUpFixture = {
    actionCalls: [],
    simpleServerCalls: [],
    script: { addComponent: [], applyRate: [] },
    async answer(name, args) {
        if (name === "addComponentAction") {
            const next = fixture.script.addComponent.shift();
            if (next !== "ack") return null;
            const [lineId, data] = args as [string, Record<string, unknown>];
            // MOCK acknowledgement: echoes the submitted row with a synthetic id.
            return { ...data, id: `local-component-${fixture.actionCalls.length}`, estimate_line_id: lineId };
        }
        if (name === "updateLineBuiltUpRateAction") {
            const next = fixture.script.applyRate.shift();
            if (!next || "refuse" in next) throw new Error("Local fixture: rate not acknowledged.");
            return next.ack;
        }
        throw new Error(`Local build-up fixture does not answer ${name}`);
    },
    router: {
        push: (href) => { throw new Error(`Local build-up fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__buildUpLocal = fixture;

const refuseSimple = (name: string) => async () => {
    fixture.simpleServerCalls.push(name);
    return { success: false as const, error: "Local fixture: simple price saves are outside this leg." };
};
const server = {
    saveLine: refuseSimple("saveLine"),
    updateLine: refuseSimple("updateLine"),
    deleteLine: refuseSimple("deleteLine"),
    saveAdjustments: refuseSimple("saveAdjustments"),
} as unknown as EstimatingServer;

createRoot(document.getElementById("app")!).render(
    <EstimateClient
        estimates={estimates}
        project={{ id: PROJECT_ID, name: "TEST DATA - Driveway", client_name: "Synthetic client", brief_scope: "Lay a block paved driveway." }}
        server={server}
        loadAdvancedData={async () => ({ ok: true, data: { orgId: "local-build-up-org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] } })}
    />,
);
