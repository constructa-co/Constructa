/**
 * D127 local offline fixture: the actual detailed programme planner over a
 * DENSE saved programme (48 stages, about 30 weeks), for before/after layout
 * captures at 375 and 1440.
 *
 * REAL ClientSchedulePage mounted directly over synthetic saved phases, as the
 * A059 detailed-geometry fixture does. Saved "Starts after" links and labour
 * hours are present so existing columns render with data.
 * MOCK transport, all explicit:
 *  - the planner's own `./actions` (compiler `planner-actions-mock`) record any
 *    call and refuse;
 *  - localStorage is an in-memory stand-in holding an explicit 5-day week;
 *    sessionStorage is an empty in-memory stand-in.
 * No server, account, database, provider or save. All data is TEST DATA.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import ClientSchedulePage from "../../src/app/dashboard/projects/schedule/client-page";
import type { PlannerPhase } from "../../src/lib/planner-phases";

export interface LocalD127ProgrammeFixture {
    stageCount: number;
    plannerCalls: { name: string; args: unknown[] }[];
}
declare global {
    interface Window { __d127ProgrammeLocal: LocalD127ProgrammeFixture }
}

const PROJECT_ID = "local-d127-dense-programme";

const storedValues = new Map<string, string>([[`prog_dpw_${PROJECT_ID}`, "5"]]);
Object.defineProperty(window, "localStorage", { value: {
    get length() { return storedValues.size; },
    clear: () => storedValues.clear(),
    key: (index: number) => [...storedValues.keys()][index] ?? null,
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => { storedValues.set(String(key), String(value)); },
    removeItem: (key: string) => { storedValues.delete(key); },
} satisfies Storage });
// The planner's unsaved-draft store reads sessionStorage; about:blank has no
// storage origin, so this is an empty in-memory stand-in (no draft is seeded).
const sessionValues = new Map<string, string>();
Object.defineProperty(window, "sessionStorage", { configurable: true, value: {
    get length() { return sessionValues.size; },
    clear: () => sessionValues.clear(),
    key: (index: number) => [...sessionValues.keys()][index] ?? null,
    getItem: (key: string) => sessionValues.get(String(key)) ?? null,
    setItem: (key: string, value: string) => { sessionValues.set(String(key), String(value)); },
    removeItem: (key: string) => { sessionValues.delete(String(key)); },
} satisfies Storage });

// Six areas, eight trades each: 48 stages. Each area starts two weeks after the
// previous one; within an area each trade follows the one before it. Offsets are
// calendar days from the Monday start and lengths are working days (5-day week),
// so every stage starts on a Monday.
const AREAS = ["Ground floor", "First floor", "Second floor", "Third floor", "Core and stairs", "Roof plant"];
const TRADES: Array<[string, number, number]> = [
    ["strip-out", 5, 120], ["structural openings", 5, 160], ["first fix M&E", 10, 320], ["partitions", 10, 360],
    ["second fix M&E", 5, 200], ["ceilings", 5, 180], ["decorations", 5, 140], ["floor finishes", 5, 120],
];
const phases: PlannerPhase[] = [];
AREAS.forEach((area, a) => {
    let offset = a * 14;
    TRADES.forEach(([trade, days, hours], t) => {
        const index = phases.length;
        phases.push({
            name: `TEST DATA - ${area} ${trade}`,
            calculatedDays: days,
            manualDays: null,
            manhours: hours,
            startOffset: offset,
            ...(t > 0 ? { dependsOn: [index - 1] } : {}),
        } as PlannerPhase);
        offset += (days / 5) * 7;
    });
});

const fixture: LocalD127ProgrammeFixture = { stageCount: phases.length, plannerCalls: [] };
window.__d127ProgrammeLocal = fixture;

createRoot(document.getElementById("app")!).render(
    <ClientSchedulePage
        projectId={PROJECT_ID}
        estimate={null}
        project={{
            id: PROJECT_ID,
            name: "TEST DATA - Dense programme",
            start_date: "2027-01-04", // a Monday
            programme_phases: phases,
        }}
        plannerDraftViewerScope="e2e-local-viewer"
    />,
);
