/**
 * Local offline fixture: a saved dated programme opens as the simple mini-Gantt,
 * and the detailed planner is a deliberate, optional step from it.
 *
 * REAL SimpleProgrammeClient (mini-Gantt, stage editor, save controller, the
 * existing unsaved-change refusal and the toggle), and the actual lazy
 * ClientSchedulePage it opens. The saved row is built once by the real
 * buildProgrammePhases from explicit stages; nothing downstream is reseeded.
 * MOCK transport, all explicit:
 *  - programme save records the submitted input and stores the real builder's
 *    phases, then re-renders with the saved row (as the real revalidatePath does);
 *  - router.refresh, which the client calls when the planner closes, re-renders
 *    from the saved row;
 *  - the planner's own `./actions` (compiler `planner-actions-mock`) record any
 *    call and refuse;
 *  - localStorage is an in-memory stand-in holding an explicit 5-day planner week.
 * No server, account, database or provider.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import SimpleProgrammeClient from "../../src/app/dashboard/projects/schedule/simple-programme-client";
import type { SaveProgrammeInclusion } from "../../src/app/dashboard/projects/schedule/inclusion-actions";
import { buildProgrammePhases, type SaveProgramme, type SimpleProgrammeInput } from "../../src/lib/simple-programme";
import { withProgrammeInclusion } from "../../src/lib/programme-inclusion";
import type { ReviewProject } from "../../src/lib/proposal-review";

export interface LocalProgrammeModeFixture {
    projectRow: ReviewProject;
    programmeSaves: SimpleProgrammeInput[];
    inclusionSaves: boolean[];
    /** Calls reaching the detailed planner's own server actions (all refused). */
    plannerCalls: { name: string; args: unknown[] }[];
    refreshes: number;
    unexpected: string[];
    router: { refresh(): void; push(path: string): void; replace(path: string): void; prefetch(): void; back(): void; forward(): void };
}
declare global {
    interface Window { __programmeModeLocal: LocalProgrammeModeFixture }
}

const PROJECT_ID = "local-programme-mode-job";
const MONDAY = "2026-10-19";

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

// The saved programme: three one-week stages from Monday 19 Oct, built by the real builder.
const SAVED_INPUT: SimpleProgrammeInput = {
    startDate: MONDAY,
    stages: ["Demo", "Install", "Finishing works"].map(name => ({ name, workingDays: 5, unit: "weeks" as const, source: null })),
};

const root = createRoot(document.getElementById("app")!);

const fixture: LocalProgrammeModeFixture = {
    projectRow: {
        id: PROJECT_ID, name: "TEST DATA - Programme mode", client_name: "TEST DATA - Synthetic client",
        brief_scope: "Strip out, install and finish a kitchen.",
        payment_schedule: [{ id: "pay-1", stage: "On completion", description: "When the work is finished", percentage: 100 }],
        programme_phases: buildProgrammePhases(SAVED_INPUT, []),
        start_date: MONDAY,
    },
    programmeSaves: [],
    inclusionSaves: [],
    plannerCalls: [],
    refreshes: 0,
    unexpected: [],
    router: {
        refresh: () => { fixture.refreshes += 1; renderProgramme(); },
        push: path => unexpected(`Unexpected fixture destination: ${path}`),
        replace: path => unexpected(`Unexpected fixture replace: ${path}`),
        prefetch: () => {},
        back: () => unexpected("Unexpected fixture back"),
        forward: () => unexpected("Unexpected fixture forward"),
    },
};
window.__programmeModeLocal = fixture;

function unexpected(message: string): never {
    fixture.unexpected.push(message);
    throw Error(message);
}

const saveProgramme: SaveProgramme = async (input) => {
    fixture.programmeSaves.push(structuredClone(input));
    fixture.projectRow = {
        ...fixture.projectRow,
        start_date: input.timeBasis === "relative" ? null : input.startDate,
        programme_phases: buildProgrammePhases(input, fixture.projectRow.programme_phases),
    };
    // The real action revalidates the schedule page; the page then shows the saved row.
    setTimeout(renderProgramme, 0);
    return { success: true };
};

const saveInclusion: SaveProgrammeInclusion = async (include) => {
    fixture.inclusionSaves.push(include);
    const programmePhases = withProgrammeInclusion(fixture.projectRow.programme_phases, include);
    fixture.projectRow = { ...fixture.projectRow, programme_phases: programmePhases };
    return { success: true, programmePhases };
};

function renderProgramme() {
    root.render(<SimpleProgrammeClient project={fixture.projectRow} lockReason={null} estimate={null}
        save={saveProgramme} saveInclusion={saveInclusion} />);
}

renderProgramme();
