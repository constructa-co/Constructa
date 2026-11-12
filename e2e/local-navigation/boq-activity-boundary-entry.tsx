import React from "react";
import { createRoot } from "react-dom/client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate, EstimateLine } from "../../src/app/dashboard/projects/costs/types";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

// 2215 A051 boundary: the ACTUAL EstimateClient mounted with an actual
// client-BoQ estimate. Native proof that the client-BoQ rows keep their
// structure, groups and prices while every simple-workspace activity edit
// control is ABSENT by design (isSimpleEditable -> false for the whole
// client-BoQ estimate), and that an ordinary estimate remains separately
// editable. No hidden control is bypassed and no server gate is exercised —
// unsupported client-BoQ assignment stays unsupported.

export interface BoqBoundaryFixture {
    priceWrites: string[];
    navigation: string[];
    project: { id: string; name: string; client_name: string; brief_scope: string; brief_trade_sections: string[] };
    estimates: Estimate[];
}

declare global {
    interface Window { __boqBoundaryLocal: BoqBoundaryFixture }
}

// about:blank has no storage origin. Keep the tab-memory the estimating
// workspace reads in explicit memory; it does not exercise durable persistence.
const sessionValues = new Map<string, string>();
Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: {
        get length() { return sessionValues.size; },
        clear: () => sessionValues.clear(),
        key: (index: number) => [...sessionValues.keys()][index] ?? null,
        getItem: (key: string) => sessionValues.get(String(key)) ?? null,
        setItem: (key: string, value: string) => { sessionValues.set(String(key), String(value)); },
        removeItem: (key: string) => { sessionValues.delete(String(key)); },
    } satisfies Storage,
});

// Existing getRandomValues/v4 bridge (e2e/local-phase1/first-job-entry): only
// used when the browser build lacks randomUUID.
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

function boqLine(id: string, description: string, tradeSection: string, quantity: number, unit: string, rate: number): EstimateLine {
    const total = Math.round(quantity * rate * 100) / 100;
    return {
        id, estimate_id: "est-boq", description, quantity, unit, unit_rate: rate,
        line_total: total, trade_section: tradeSection, line_type: "labour",
        cost_library_item_id: null, mom_item_code: null, notes: null,
        pricing_mode: "simple", estimate_line_components: [], client_ref: null,
    };
}

const estimates: Estimate[] = [
    {
        id: "est-boq", project_id: "job-1", version_name: "Client BoQ v1",
        overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0,
        discount_pct: 0, discount_reason: "", total_cost: 2290,
        is_active: true, is_client_boq: true, client_boq_filename: "client-boq.pdf",
        estimate_lines: [
            boqLine("boq-line-1", "Strip existing roof coverings", "Roofing", 40, "m2", 18.5),
            boqLine("boq-line-2", "Supply and lay new felt roofing system", "Roofing", 40, "m2", 32.25),
            boqLine("boq-line-3", "Replace guttering and downpipes", "Rainwater goods", 10, "m", 26),
        ],
    },
    {
        id: "est-simple", project_id: "job-1", version_name: "Contractor estimate",
        overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0,
        discount_pct: 0, discount_reason: "", total_cost: 150,
        is_active: false, is_client_boq: false, client_boq_filename: null,
        estimate_lines: [
            boqLine("simple-line-1", "General builder attendance", "General", 1, "item", 150),
        ],
    },
];
// The ordinary line belongs to its own estimate.
estimates[1].estimate_lines[0].estimate_id = "est-simple";

const fixture: BoqBoundaryFixture = {
    priceWrites: [],
    navigation: [],
    project: {
        id: "job-1", name: "Synthetic job one", client_name: "Synthetic client",
        brief_scope: "Strip and refelt a garage roof", brief_trade_sections: ["Roofing"],
    },
    estimates,
};
window.__boqBoundaryLocal = fixture;

// Explicit mock: every real price write is refused and recorded. The boundary
// case never needs a successful save; nothing may reach a server action.
const refusedWrite = async () => {
    window.__boqBoundaryLocal.priceWrites.push("Unexpected attempted price write");
    return { ok: false as const, error: "Local fixture: price persistence is excluded." };
};
const server: EstimatingServer = {
    saveLine: refusedWrite, updateLine: refusedWrite,
    deleteLine: refusedWrite, saveAdjustments: refusedWrite,
};

const root = createRoot(document.getElementById("app")!);
root.render(
    <EstimateClient
        estimates={fixture.estimates}
        project={fixture.project}
        server={server}
        loadAdvancedData={async () => ({ ok: false, error: "Advanced estimating is outside this fixture." })}
    />,
);
