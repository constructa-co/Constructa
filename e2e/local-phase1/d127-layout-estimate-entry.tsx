/**
 * D127 local offline fixture: the actual estimating screen (EstimateClient,
 * activity breakdown, Running total and in-view total) over a LONG saved
 * estimate, for before/after layout captures at 375 and 1440.
 *
 * REAL EstimateClient under the actual ThemeProvider, styled by the actual
 * compiled Tailwind stylesheet plus the actual CSS modules (as the A003 leg).
 * The saved estimate has 64 ordinary simple lines in 8 activities with the
 * default adjustment percentages. All figures come from the app's own price
 * summary; the fixture states only quantities and rates.
 * MOCK transport, all explicit: simple-price saves and build-up actions refuse.
 * No server, account, database, provider or save. All data is TEST DATA.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "../../src/lib/theme-context";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate, EstimateLine } from "../../src/app/dashboard/projects/costs/types";
import type { EstimatingServer } from "../../src/lib/simple-estimate";

export interface LocalD127EstimateFixture {
    lineCount: number;
    simpleServerCalls: string[];
    router: { push: (href: string) => void; refresh: () => void };
}
declare global {
    interface Window { __d127EstimateLocal: LocalD127EstimateFixture }
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

const PROJECT_ID = "local-d127-long-estimate";
const ESTIMATE_ID = "local-d127-long-estimate-v1";

const SECTIONS: Array<[string, Array<[string, number, string, number]>]> = [
    ["Strip-out", [["Remove ceiling tiles and grid", 420, "m²", 6.5], ["Remove partitions", 96, "m", 22], ["Remove floor coverings", 420, "m²", 4.75], ["Skip hire and disposal", 6, "nr", 310], ["Protect retained finishes", 1, "item", 650], ["Cap off redundant services", 1, "item", 480], ["Remove sanitaryware", 8, "nr", 45], ["Clear site of debris", 1, "item", 300]]],
    ["Partitions", [["Metal stud partition, 100 mm", 140, "m²", 48], ["Acoustic insulation to partitions", 140, "m²", 9.5], ["Plasterboard, two layers each side", 140, "m²", 31], ["Door openings formed", 14, "nr", 120], ["Bulkhead framing", 36, "m", 42], ["Deflection head", 64, "m", 14], ["Corner beads", 120, "m", 3.2], ["Tape and joint", 280, "m²", 6]]],
    ["Ceilings", [["Suspended grid ceiling", 420, "m²", 24], ["Ceiling tiles, 600 x 600", 420, "m²", 11], ["MF plasterboard ceiling", 60, "m²", 38], ["Access hatches", 6, "nr", 95], ["Perimeter trim", 180, "m", 4.5], ["Ceiling insulation", 120, "m²", 7.5], ["Bulkhead plasterboard", 36, "m", 28], ["Shadow gap detail", 40, "m", 16]]],
    ["Doors", [["Internal door set, fire rated", 10, "nr", 640], ["Internal door set, standard", 4, "nr", 420], ["Ironmongery set", 14, "nr", 165], ["Door closers", 10, "nr", 85], ["Vision panels", 6, "nr", 140], ["Signage", 14, "nr", 22], ["Door stops", 14, "nr", 12], ["Kick plates", 10, "nr", 38]]],
    ["Electrical", [["LED panel, 600 x 600", 72, "nr", 68], ["Emergency luminaire", 18, "nr", 112], ["Twin socket outlet", 64, "nr", 58], ["Data outlet, two port", 48, "nr", 74], ["Lighting control", 1, "item", 2400], ["Distribution board", 1, "nr", 2800], ["Containment", 260, "m", 14], ["Test and certify", 1, "item", 950]]],
    ["Mechanical", [["Fan coil unit", 8, "nr", 1450], ["Ductwork, galvanised", 120, "m", 52], ["Grilles and diffusers", 32, "nr", 88], ["Extract fan", 4, "nr", 420], ["Pipework, insulated", 160, "m", 36], ["Controls", 1, "item", 3200], ["Commissioning", 1, "item", 1100], ["Builder’s work holes", 24, "nr", 45]]],
    ["Decorations", [["Mist coat and two coats to walls", 620, "m²", 6.8], ["Ceiling paint", 60, "m²", 7.2], ["Gloss to door frames", 14, "nr", 48], ["Feature wall", 40, "m²", 14], ["Protective wall guard", 30, "m", 32], ["Making good", 1, "item", 600], ["Final clean", 420, "m²", 1.8], ["Touch up after snagging", 1, "item", 350]]],
    ["Floor finishes", [["Carpet tiles", 360, "m²", 26], ["Vinyl sheet to wet areas", 60, "m²", 42], ["Latex screed", 420, "m²", 9], ["Skirting", 260, "m", 11], ["Entrance matting", 8, "m²", 140], ["Threshold strips", 14, "nr", 24], ["Stair nosings", 30, "m", 36], ["Floor protection", 420, "m²", 2.2]]],
];

let n = 0;
const lines: EstimateLine[] = SECTIONS.flatMap(([section, items]) => items.map(([description, quantity, unit, rate]) => {
    n += 1;
    return {
        id: `local-d127-line-${n}`, estimate_id: ESTIMATE_ID, description: `TEST DATA - ${description}`,
        quantity, unit, unit_rate: rate, line_total: Math.round(quantity * rate * 100) / 100,
        trade_section: section, line_type: "general", pricing_mode: "simple", estimate_line_components: [],
    } as EstimateLine;
}));

const estimates: Estimate[] = [{
    id: ESTIMATE_ID, project_id: PROJECT_ID, version_name: "Estimate v1",
    prelims_pct: 10, overhead_pct: 10, risk_pct: 5, profit_pct: 15, discount_pct: 0, discount_reason: "",
    total_cost: lines.reduce((sum, line) => sum + (line.line_total ?? 0), 0), is_active: true,
    estimate_lines: lines,
}];

const fixture: LocalD127EstimateFixture = {
    lineCount: lines.length,
    simpleServerCalls: [],
    router: {
        push: (href) => { throw new Error(`Local D127 fixture does not navigate: ${href}`); },
        refresh: () => undefined,
    },
};
window.__d127EstimateLocal = fixture;

const refusingActions = {
    actionCalls: [] as { name: string; args: unknown[] }[],
    async answer(name: string) { throw new Error(`Local D127 fixture does not answer ${name}`); },
};
// The shared compiler MOCK module calls this name.
(window as unknown as { __buildUpLocal: typeof refusingActions }).__buildUpLocal = refusingActions;

const refuseSimple = (name: string) => async () => {
    fixture.simpleServerCalls.push(name);
    return { ok: false as const, success: false as const, error: "Local fixture: price saves are outside this leg." };
};
const server = {
    saveLine: refuseSimple("saveLine"),
    updateLine: refuseSimple("updateLine"),
    deleteLine: refuseSimple("deleteLine"),
    saveAdjustments: refuseSimple("saveAdjustments"),
} as unknown as EstimatingServer;

createRoot(document.getElementById("app")!).render(
    <ThemeProvider initialTheme="system-c">
        <EstimateClient
            estimates={estimates}
            project={{ id: PROJECT_ID, name: "TEST DATA - Long estimate", client_name: "TEST DATA - Synthetic client", brief_scope: "Office floor fit-out." }}
            server={server}
            loadAdvancedData={async () => ({ ok: true, data: { orgId: "local-d127-org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] } })}
        />
    </ThemeProvider>,
);
