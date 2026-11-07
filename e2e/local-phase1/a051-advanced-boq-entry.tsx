/**
 * Local offline fixture: the ACTUAL client-BoQ estimate opened inside the lazy
 * Advanced estimating workspace, and the boundary that follows.
 *
 * REAL EstimateClient -> lazy AdvancedEstimate. The synthetic saved estimate is
 * a real `is_client_boq: true` estimate (the genuine data path; no fixture
 * markup hides controls and no normal line is forced into BoQ). Advanced's own
 * source gates keep the unsupported controls absent for client-BoQ rows.
 * MOCK transport, all explicit:
 *  - costs `./actions` and `./activity-actions` (compiler mocks) record every
 *    call; this leg never edits, so every action stays uncalled;
 *  - EstimateClient's simple-price server refuses and records (expected unused);
 *  - loadAdvancedData answers with synthetic empty reference data.
 * No server, account, database, resource library or provider. No import,
 * no save, no write of any kind is exercised.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate, EstimateLine } from "../../src/app/dashboard/projects/costs/types";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

interface A051AdvancedBoqActions {
    actionCalls: { name: string; args: unknown[] }[];
    answer: (name: string, args: unknown[]) => Promise<unknown>;
}
export interface A051AdvancedBoqFixture {
    /** The synthetic client-BoQ estimate; the MOCK persisted store never changes. */
    estimates: Estimate[];
    priceWrites: string[];
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window {
        __a051AdvancedBoqLocal: A051AdvancedBoqFixture;
        __a051AdvancedBoqActions: A051AdvancedBoqActions;
    }
}

const PROJECT_ID = "a051-advanced-boq-job";
const ESTIMATE_ID = "a051-advanced-boq-estimate";

// about:blank has no storage origin; EstimateClient remembers its tab in sessionStorage.
const sessionValues = new Map<string, string>();
Object.defineProperty(window, "sessionStorage", { configurable: true, value: {
    get length() { return sessionValues.size; },
    clear: () => sessionValues.clear(),
    key: (index: number) => [...sessionValues.keys()][index] ?? null,
    getItem: (key: string) => sessionValues.get(String(key)) ?? null,
    setItem: (key: string, value: string) => { sessionValues.set(String(key), String(value)); },
    removeItem: (key: string) => { sessionValues.delete(String(key)); },
} satisfies Storage });

// Existing WebCrypto guard recipe (e2e/local-navigation/boq-activity-boundary-entry):
// only used when the browser build lacks randomUUID.
if (typeof crypto.randomUUID !== "function") {
    Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        value: () => {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 0x0f) | 0x40;
            bytes[8] = (bytes[8] & 0x3f) | 0x80;
            const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
            return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        },
    });
}

// Same BoQ shape as the 3c212ba simple-workspace boundary, with the client
// references the Advanced "Ref" column renders.
function boqLine(id: string, clientRef: string, description: string, tradeSection: string, quantity: number, unit: string, rate: number): EstimateLine {
    const total = Math.round(quantity * rate * 100) / 100;
    return {
        id, estimate_id: ESTIMATE_ID, description, quantity, unit, unit_rate: rate,
        line_total: total, trade_section: tradeSection, line_type: "labour",
        cost_library_item_id: null, mom_item_code: null, notes: null,
        pricing_mode: "simple", estimate_line_components: [], client_ref: clientRef,
    };
}

const fixture: A051AdvancedBoqFixture = {
    estimates: [{
        id: ESTIMATE_ID, project_id: PROJECT_ID, version_name: "Client BoQ v1",
        overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0,
        discount_pct: 0, discount_reason: "", total_cost: 2290,
        is_active: true, is_client_boq: true, client_boq_filename: "client-boq.pdf",
        estimate_lines: [
            boqLine("boq-line-1", "A1", "Strip existing roof coverings", "Roofing", 40, "m2", 18.5),
            boqLine("boq-line-2", "A2", "Supply and lay new felt roofing system", "Roofing", 40, "m2", 32.25),
            boqLine("boq-line-3", "B1", "Replace guttering and downpipes", "Rainwater goods", 10, "m", 26),
        ],
    }],
    priceWrites: [],
    router: {
        push: (href) => { throw new Error(`Local A051 advanced-BoQ fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__a051AdvancedBoqLocal = fixture;

const actions: A051AdvancedBoqActions = {
    actionCalls: [],
    async answer(name) {
        return { success: false, error: `Local fixture: ${name} is refused in this leg.` };
    },
};
window.__a051AdvancedBoqActions = actions;
// The shared compiler MOCK modules call this name; it is the same typed object.
(window as unknown as { __buildUpLocal: A051AdvancedBoqActions }).__buildUpLocal = actions;

// Explicit mock: every real price write is refused and recorded. This boundary
// case never needs a successful save; nothing may reach a server action.
const refusedWrite = async () => {
    window.__a051AdvancedBoqLocal.priceWrites.push("Unexpected attempted price write");
    return { ok: false as const, error: "Local fixture: price persistence is excluded." };
};
const server: EstimatingServer = {
    saveLine: refusedWrite, updateLine: refusedWrite,
    deleteLine: refusedWrite, saveAdjustments: refusedWrite,
};

createRoot(document.getElementById("app")!).render(
    <EstimateClient
        estimates={structuredClone(fixture.estimates)}
        project={{
            id: PROJECT_ID,
            name: "TEST DATA - Client BoQ job",
            client_name: "TEST DATA - Synthetic client",
            brief_scope: "Strip and refelt a garage roof",
            brief_trade_sections: ["Roofing", "Rainwater goods"],
        }}
        server={server}
        loadAdvancedData={async () => ({ ok: true, data: { orgId: "a051-advanced-boq-org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] } })}
    />,
);
