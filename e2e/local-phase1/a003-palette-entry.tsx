/**
 * Local offline fixture: the actual estimating controls named in A003 (selected
 * pricing mode, Next: Programme, Advanced estimating build-up selection and
 * Apply) under the actual ThemeProvider, styled by the actual compiled Tailwind
 * stylesheet plus the actual CSS modules.
 *
 * REAL ThemeProvider, EstimateClient, LineForm, lazy AdvancedEstimate and
 * BuildUpPanel. MOCK transport, all explicit:
 *  - EstimateClient's simple-price server refuses (no save is expected);
 *  - loadAdvancedData answers with synthetic empty reference data;
 *  - the costs `./actions` (compiler `build-up-actions`) record calls and answer
 *    only from the spec's script: a resource add is acknowledged by echoing the
 *    submitted row; Apply rate is refused.
 *  - localStorage and sessionStorage are in-memory stand-ins (about:blank has none);
 *    the theme comes from the provider's initialTheme, as the dashboard layout passes it.
 * No server, account, database, resource library or provider.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../src/lib/theme-context";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate } from "../../src/app/dashboard/projects/costs/types";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

type Theme = "system-c" | "dark";
interface PaletteActions {
    actionCalls: { name: string; args: unknown[] }[];
    script: { addComponent: Array<"ack" | "refuse">; applyRate: Array<"refuse"> };
    answer: (name: string, args: unknown[]) => Promise<unknown>;
}
export interface LocalA003PaletteFixture {
    simpleServerCalls: string[];
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window { __a003PaletteOptions?: { theme: Theme }; __a003PaletteLocal: LocalA003PaletteFixture; __a003PaletteActions: PaletteActions }
}

const memoryStorage = (): Storage => {
    const values = new Map<string, string>();
    return {
        get length() { return values.size; },
        clear: () => values.clear(),
        key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(String(key), String(value)); },
        removeItem: (key: string) => { values.delete(key); },
    };
};
Object.defineProperty(window, "localStorage", { value: memoryStorage() });
Object.defineProperty(window, "sessionStorage", { value: memoryStorage() });

const PROJECT_ID = "local-a003-palette-job";
const ESTIMATE_ID = "local-a003-palette-estimate";
const estimates: Estimate[] = [{
    id: ESTIMATE_ID, project_id: PROJECT_ID, version_name: "Estimate v1",
    prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0, discount_reason: "",
    total_cost: 500, is_active: true,
    estimate_lines: [{
        id: "local-a003-palette-line", estimate_id: ESTIMATE_ID, description: "Lay block paving", quantity: 10, unit: "m²",
        unit_rate: 50, line_total: 500, trade_section: "General", line_type: "general", pricing_mode: "simple",
        estimate_line_components: [],
    }],
}];

const fixture: LocalA003PaletteFixture = {
    simpleServerCalls: [],
    router: {
        push: (href) => { throw new Error(`Local palette fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__a003PaletteLocal = fixture;

const actions: PaletteActions = {
    actionCalls: [],
    script: { addComponent: [], applyRate: [] },
    async answer(name, args) {
        if (name === "addComponentAction") {
            if (actions.script.addComponent.shift() !== "ack") return null;
            const [lineId, data] = args as [string, Record<string, unknown>];
            return { ...data, id: `local-palette-component-${actions.actionCalls.length}`, estimate_line_id: lineId };
        }
        if (name === "updateLineBuiltUpRateAction") {
            actions.script.applyRate.shift();
            throw new Error("Local fixture: rate not acknowledged.");
        }
        throw new Error(`Local palette fixture does not answer ${name}`);
    },
};
window.__a003PaletteActions = actions;
// The shared compiler MOCK module calls this name; it is the same typed object.
(window as unknown as { __buildUpLocal: PaletteActions }).__buildUpLocal = actions;

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
    <ThemeProvider initialTheme={window.__a003PaletteOptions?.theme ?? "system-c"}>
        <EstimateClient
            estimates={estimates}
            project={{ id: PROJECT_ID, name: "TEST DATA - Palette", client_name: "TEST DATA - Synthetic client", brief_scope: "Lay a block paved driveway." }}
            server={server}
            loadAdvancedData={async () => ({ ok: true, data: { orgId: "local-a003-palette-org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] } })}
        />
    </ThemeProvider>,
);
