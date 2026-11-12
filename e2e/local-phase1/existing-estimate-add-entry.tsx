/**
 * Local offline fixture: add a NEW simple price line to an EXISTING estimate that
 * already has saved lines (distinct from empty-estimate first line).
 *
 * REAL EstimateClient, reducer, validators and running-total maths.
 * MOCK EstimatingServer saveLine only: script refuse/ack; acknowledgement appends
 * from submitted args onto the existing estimate id. updateLine/deleteLine refuse.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate, EstimateLine } from "../../src/app/dashboard/projects/costs/types";
import {
    SIMPLE_LINE_SECTION,
    lineTotal,
    type EstimatingServer,
    type SavePriceLineRequest,
    type SavePriceLineResult,
} from "../../src/lib/simple-estimate";

export type TransportAnswer = "ack" | "refuse";

export interface LocalExistingEstimateAddFixture {
    estimates: Estimate[];
    script: { saveLine: TransportAnswer[] };
    priceSaveAttempts: SavePriceLineRequest[];
    priceSaveAcknowledgements: number;
    unexpectedWrites: string[];
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __existingEstimateAddLocal: LocalExistingEstimateAddFixture;
    }
}

const PROJECT_ID = "local-existing-estimate-add-job";
const ESTIMATE_ID = "local-existing-estimate-add-estimate";

const sessionValues = new Map<string, string>();
Object.defineProperty(window, "sessionStorage", {
    value: {
        get length() { return sessionValues.size; },
        clear: () => sessionValues.clear(),
        key: (index: number) => [...sessionValues.keys()][index] ?? null,
        getItem: (key: string) => sessionValues.get(key) ?? null,
        setItem: (key: string, value: string) => { sessionValues.set(String(key), String(value)); },
        removeItem: (key: string) => { sessionValues.delete(key); },
    } satisfies Storage,
});

const savedLineFromRequest = (request: SavePriceLineRequest, estimateId: string): EstimateLine => {
    const total = lineTotal(request.line.quantity, request.line.unit_rate);
    return {
        id: request.lineId,
        estimate_id: estimateId,
        description: request.line.description,
        quantity: request.line.quantity,
        unit: request.line.unit,
        unit_rate: request.line.unit_rate,
        line_total: total,
        trade_section: request.activity?.trim() || SIMPLE_LINE_SECTION,
        line_type: "general",
        pricing_mode: "simple",
        estimate_line_components: [],
    };
};

const line = (
    id: string,
    description: string,
    trade_section: string,
    quantity: number,
    unit: string,
    unit_rate: number,
): EstimateLine => ({
    id,
    estimate_id: ESTIMATE_ID,
    description,
    quantity,
    unit,
    unit_rate,
    line_total: lineTotal(quantity, unit_rate),
    trade_section,
    line_type: "general",
    pricing_mode: "simple",
    estimate_line_components: [],
});

const fixture: LocalExistingEstimateAddFixture = {
    estimates: [{
        id: ESTIMATE_ID,
        project_id: PROJECT_ID,
        version_name: "Estimate v1",
        prelims_pct: 0,
        overhead_pct: 0,
        risk_pct: 0,
        profit_pct: 0,
        discount_pct: 0,
        discount_reason: "",
        total_cost: 180,
        is_active: true,
        estimate_lines: [
            line("line-retained-excavation", "TEST DATA - Retained excavation", "Groundworks", 10, "m2", 10),
            line("line-retained-fascia", "TEST DATA - Retained fascia", "Roofing", 2, "nr", 40),
        ],
    }],
    script: { saveLine: [] },
    priceSaveAttempts: [],
    priceSaveAcknowledgements: 0,
    unexpectedWrites: [],
    router: {
        push: href => { throw new Error(`Local existing-estimate-add fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__existingEstimateAddLocal = fixture;

const refuseUnexpected = (label: string) => async () => {
    fixture.unexpectedWrites.push(label);
    return { ok: false as const, error: "Local fixture: unexpected simple-price write." };
};

const mockSaveLine = async (request: SavePriceLineRequest): Promise<SavePriceLineResult> => {
    fixture.priceSaveAttempts.push(structuredClone(request));
    const next = fixture.script.saveLine.shift() ?? "refuse";
    if (next === "refuse") {
        return { ok: false, error: "Local fixture: price save not acknowledged." };
    }
    if (!request.estimateId || request.estimateId !== ESTIMATE_ID) {
        return { ok: false, error: "Local fixture: add must target the existing estimate id." };
    }
    const existing = fixture.estimates.find(e => e.id === request.estimateId);
    if (!existing || existing.estimate_lines.length < 2) {
        return { ok: false, error: "Local fixture: expected an existing estimate with retained lines." };
    }
    const saved = savedLineFromRequest(request, request.estimateId);
    const estimate_lines = [...existing.estimate_lines.filter(l => l.id !== saved.id), saved];
    const total_cost = estimate_lines.reduce((sum, row) => sum + (Number(row.line_total) || 0), 0);
    const updated = { ...existing, estimate_lines, total_cost };
    fixture.estimates = fixture.estimates.map(e => (e.id === request.estimateId ? updated : e));
    fixture.priceSaveAcknowledgements += 1;
    return { ok: true, estimateId: request.estimateId, createdEstimate: null, line: saved };
};

const server: EstimatingServer = {
    saveLine: mockSaveLine,
    updateLine: refuseUnexpected("updateLine"),
    deleteLine: refuseUnexpected("deleteLine"),
    saveAdjustments: refuseUnexpected("saveAdjustments"),
};

createRoot(document.getElementById("app")!).render(
    <EstimateClient
        estimates={structuredClone(fixture.estimates)}
        project={{
            id: PROJECT_ID,
            name: "TEST DATA - Add to existing estimate",
            client_name: "TEST DATA - Synthetic client",
            brief_scope: "Excavation and fascia works with an extra line to add.",
            brief_trade_sections: ["Groundworks", "Roofing", "Rainwater"],
            payment_schedule: [{ id: "pay-1", stage: "On completion", description: "When works finish", percentage: 100 }],
        }}
        server={server}
        loadAdvancedData={async () => ({ ok: false, error: "Advanced tools are outside this fixture." })}
    />,
);
