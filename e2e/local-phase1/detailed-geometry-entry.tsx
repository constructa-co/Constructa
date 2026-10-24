/**
 * Local offline fixture: the actual detailed programme planner's week grid and
 * bars, drawn by the actual compiled Tailwind stylesheet.
 *
 * REAL ClientSchedulePage (axis, week headers, grid lines, dated bar spans,
 * duration fills, start ticks, move and resize targets), mounted directly over
 * a saved programme. Synthetic saved phases on the existing five-day basis,
 * starting Monday 2 Nov 2026, each with a one-working-day stage:
 *  - "short": three stages inside the minimum four-week axis;
 *  - "long": a 60-working-day stage and a later one-day stage, so the axis
 *    groups its week columns.
 * MOCK transport, all explicit:
 *  - the planner's own `./actions` (compiler `planner-actions-mock`) record any
 *    call and refuse, so a hidden save or estimate read is visible;
 *  - localStorage is an in-memory stand-in holding the planner's working week:
 *    5 days, explicit synthetic input (the app default is unchanged).
 * No server, account, database, provider or save.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import ClientSchedulePage from "../../src/app/dashboard/projects/schedule/client-page";
import type { PlannerPhase } from "../../src/lib/planner-phases";

type Plan = "short" | "long";
export interface LocalDetailedGeometryFixture {
    plan: Plan;
    /** Calls reaching the detailed planner's own server actions (all refused). */
    plannerCalls: { name: string; args: unknown[] }[];
}
declare global {
    interface Window { __detailedGeometryOptions?: { plan: Plan }; __detailedGeometryLocal: LocalDetailedGeometryFixture }
}

const PROJECT_ID = "local-detailed-geometry-job";
const START_DATE = "2026-11-02"; // a Monday

// about:blank has no storage origin. The planner reads its working week from
// localStorage; this in-memory stand-in holds an explicit 5-day week only.
const storedValues = new Map<string, string>([[`prog_dpw_${PROJECT_ID}`, "5"]]);
Object.defineProperty(window, "localStorage", { value: {
    get length() { return storedValues.size; },
    clear: () => storedValues.clear(),
    key: (index: number) => [...storedValues.keys()][index] ?? null,
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => { storedValues.set(String(key), String(value)); },
    removeItem: (key: string) => { storedValues.delete(key); },
} satisfies Storage });

const phase = (name: string, workingDays: number, startOffset: number): PlannerPhase =>
    ({ name, calculatedDays: workingDays, manualDays: null, manhours: 0, startOffset });

// Offsets are calendar days from the Monday start; lengths are working days.
const PLANS: Record<Plan, PlannerPhase[]> = {
    short: [
        phase("TEST DATA - Strip out", 1, 0),   // Mon 2 Nov
        phase("TEST DATA - Install", 7, 7),     // Mon 9 Nov to Tue 17 Nov
        phase("TEST DATA - Finish", 3, 16),     // Wed 18 Nov to Fri 20 Nov
    ],
    long: [
        phase("TEST DATA - Groundworks", 60, 0), // Mon 2 Nov to Fri 22 Jan
        phase("TEST DATA - Handover clean", 1, 93), // Wed 3 Feb
    ],
};

const plan: Plan = window.__detailedGeometryOptions?.plan ?? "short";
const fixture: LocalDetailedGeometryFixture = { plan, plannerCalls: [] };
window.__detailedGeometryLocal = fixture;

createRoot(document.getElementById("app")!).render(
    <ClientSchedulePage
        projectId={PROJECT_ID}
        estimate={null}
        project={{ id: PROJECT_ID, name: "TEST DATA - Detailed geometry", start_date: START_DATE, programme_phases: PLANS[plan] }}
    />,
);
