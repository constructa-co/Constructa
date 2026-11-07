/**
 * Local offline fixture: edit quantity/rate on EXISTING simple price lines and
 * remove a supported line inside the real EstimateClient workspace.
 *
 * REAL EstimateClient, reducer, validators and running-total maths.
 * MOCK EstimatingServer transport only: updateLine and deleteLine answer from an
 * explicit script; acknowledgements write submitted args into the labelled
 * in-memory estimate store. saveLine and saveAdjustments refuse if called.
 * Advanced estimating, BoQ import and video are excluded (lazy stub).
 */

import React from "react";
import { createRoot } from "react-dom/client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate } from "../../src/app/dashboard/projects/costs/types";
import {
    lineTotal,
    type EstimatingServer,
    type PriceLineInput,
} from "../../src/lib/simple-estimate";

export type TransportAnswer = "ack" | "refuse";

export interface UpdateAttempt {
    estimateId: string;
    lineId: string;
    line: PriceLineInput;
}

export interface LocalExistingPriceNativeFixture {
    estimates: Estimate[];
    script: { update: TransportAnswer[]; delete: TransportAnswer[] };
    updateAttempts: UpdateAttempt[];
    deleteAttempts: Array<{ estimateId: string; lineId: string }>;
    updateAcknowledgements: number;
    deleteAcknowledgements: number;
    saveLineCalls: number;
    unexpectedWrites: string[];
    router: { push: (href: string) => void; refresh: () => void };
}

declare global {
    interface Window {
        __existingPriceNativeLocal: LocalExistingPriceNativeFixture;
    }
}

const PROJECT_ID = "local-existing-price-job";
const ESTIMATE_ID = "local-existing-price-estimate";

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
    line_total: lineTotal(quantity, unit_rate),
    trade_section,
    line_type: "general",
    pricing_mode: "simple",
    estimate_line_components: [],
});

const fixture: LocalExistingPriceNativeFixture = {
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
            line("line-roof-tiles", "TEST DATA - Roof tiles", "Groundworks", 2, "nr", 50),
            line("line-gutter-run", "TEST DATA - Gutter run", "Roofing", 1, "nr", 80),
        ],
    }],
    script: { update: [], delete: [] },
    updateAttempts: [],
    deleteAttempts: [],
    updateAcknowledgements: 0,
    deleteAcknowledgements: 0,
    saveLineCalls: 0,
    unexpectedWrites: [],
    router: {
        push: href => { throw new Error(`Local existing-price fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__existingPriceNativeLocal = fixture;

const refuseUnexpected = (label: string) => async () => {
    fixture.unexpectedWrites.push(label);
    return { ok: false as const, error: "Local fixture: unexpected simple-price write." };
};

const applyUpdate = (estimateId: string, lineId: string, input: PriceLineInput) => {
    const total = lineTotal(input.quantity, input.unit_rate);
    fixture.estimates = fixture.estimates.map(estimate => {
        if (estimate.id !== estimateId) return estimate;
        const estimate_lines = estimate.estimate_lines.map(row =>
            row.id === lineId
                ? { ...row, description: input.description, quantity: input.quantity, unit: input.unit, unit_rate: input.unit_rate, line_total: total }
                : row,
        );
        const total_cost = estimate_lines.reduce((sum, row) => sum + (Number(row.line_total) || 0), 0);
        return { ...estimate, estimate_lines, total_cost };
    });
    return total;
};

const server: EstimatingServer = {
    saveLine: async () => {
        fixture.saveLineCalls += 1;
        return refuseUnexpected("saveLine")();
    },
    updateLine: async (estimateId, lineId, input) => {
        fixture.updateAttempts.push({ estimateId, lineId, line: structuredClone(input) });
        const next = fixture.script.update.shift() ?? "refuse";
        if (next === "refuse") {
            return { ok: false, error: "Local fixture: price update not acknowledged." };
        }
        const existing = fixture.estimates.find(e => e.id === estimateId)?.estimate_lines.find(l => l.id === lineId);
        if (!existing) return { ok: false, error: "Local fixture: line missing from store." };
        const line_total = applyUpdate(estimateId, lineId, input);
        fixture.updateAcknowledgements += 1;
        return {
            ok: true,
            line: {
                id: lineId,
                description: input.description,
                quantity: input.quantity,
                unit: input.unit,
                unit_rate: input.unit_rate,
                line_total,
            },
        };
    },
    deleteLine: async (estimateId, lineId) => {
        fixture.deleteAttempts.push({ estimateId, lineId });
        const next = fixture.script.delete.shift() ?? "refuse";
        if (next === "refuse") {
            return { ok: false, error: "Local fixture: line delete not acknowledged." };
        }
        fixture.estimates = fixture.estimates.map(estimate => {
            if (estimate.id !== estimateId) return estimate;
            const estimate_lines = estimate.estimate_lines.filter(row => row.id !== lineId);
            const total_cost = estimate_lines.reduce((sum, row) => sum + (Number(row.line_total) || 0), 0);
            return { ...estimate, estimate_lines, total_cost };
        });
        fixture.deleteAcknowledgements += 1;
        return { ok: true };
    },
    saveAdjustments: refuseUnexpected("saveAdjustments"),
};

createRoot(document.getElementById("app")!).render(
    <EstimateClient
        estimates={structuredClone(fixture.estimates)}
        project={{
            id: PROJECT_ID,
            name: "TEST DATA - Existing simple lines",
            client_name: "TEST DATA - Synthetic client",
            brief_scope: "Renew roof tiles and replace a gutter run.",
            brief_trade_sections: ["Groundworks", "Roofing"],
            payment_schedule: [{ id: "pay-1", stage: "On completion", description: "When works finish", percentage: 100 }],
        }}
        server={server}
        loadAdvancedData={async () => ({ ok: false, error: "Advanced tools are outside this fixture." })}
    />,
);
