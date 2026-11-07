/**
 * Local offline fixture: keyboard-driven inline new-line entry on an estimate that
 * already has saved rows (Save-and-add-next / Ctrl|Command+Enter).
 *
 * REAL EstimateClient table inline editor and keyboard handlers.
 * MOCK saveLine append-only from submitted args on existing estimateId.
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

export interface LocalKeyboardPriceFixture {
    estimates: Estimate[];
    priceSaveAttempts: SavePriceLineRequest[];
    priceSaveAcknowledgements: number;
    unexpectedWrites: string[];
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __keyboardPriceLocal: LocalKeyboardPriceFixture;
    }
}

const PROJECT_ID = "local-keyboard-price-job";
const ESTIMATE_ID = "local-keyboard-price-estimate";

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

const fixture: LocalKeyboardPriceFixture = {
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
            line("line-keyboard-retained-a", "TEST DATA - Keyboard retained A", "Groundworks", 10, "m2", 10),
            line("line-keyboard-retained-b", "TEST DATA - Keyboard retained B", "Roofing", 2, "nr", 40),
        ],
    }],
    priceSaveAttempts: [],
    priceSaveAcknowledgements: 0,
    unexpectedWrites: [],
    router: {
        push: href => { throw new Error(`Local keyboard-price fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__keyboardPriceLocal = fixture;

const refuseUnexpected = (label: string) => async () => {
    fixture.unexpectedWrites.push(label);
    return { ok: false as const, error: "Local fixture: unexpected simple-price write." };
};

const mockSaveLine = async (request: SavePriceLineRequest): Promise<SavePriceLineResult> => {
    fixture.priceSaveAttempts.push(structuredClone(request));
    if (!request.estimateId || request.estimateId !== ESTIMATE_ID) {
        return { ok: false, error: "Local fixture: save must target the existing estimate id." };
    }
    const existing = fixture.estimates.find(e => e.id === request.estimateId);
    if (!existing) return { ok: false, error: "Local fixture: estimate missing." };
    const saved = savedLineFromRequest(request, request.estimateId);
    const estimate_lines = [...existing.estimate_lines.filter(l => l.id !== saved.id), saved];
    const total_cost = estimate_lines.reduce((sum, row) => sum + (Number(row.line_total) || 0), 0);
    fixture.estimates = fixture.estimates.map(e => (e.id === request.estimateId ? { ...existing, estimate_lines, total_cost } : e));
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
            name: "TEST DATA - Keyboard price workspace",
            client_name: "TEST DATA - Synthetic client",
            brief_scope: "Retained lines with keyboard add-next entry.",
            brief_trade_sections: ["Groundworks", "Roofing"],
            payment_schedule: [{ id: "pay-1", stage: "On completion", description: "When works finish", percentage: 100 }],
        }}
        server={server}
        loadAdvancedData={async () => ({ ok: false, error: "Advanced tools are outside this fixture." })}
    />,
);
