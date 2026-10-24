/**
 * Local offline fixture: Rob's reported three-stage calendar example, from the
 * actual simple programme editor, through its MOCK-acknowledged saved phases,
 * into the actual detailed planner and the actual proposal / draft PDF.
 *
 * REAL SimpleProgrammeClient (validation, stage editor, save controller),
 * buildProgrammePhases, lazy ClientSchedulePage (detailed planner), and
 * ReviewSendClient with its frozen snapshot, document and jsPDF renderer.
 * Synthetic starting state: a job whose saved start date is Sunday 18 Oct 2026
 * (as in the report) with no programme yet, and one saved estimate line.
 * MOCK transport, all explicit:
 *  - programme save records the submitted input and stores the phases built by
 *    the real buildProgrammePhases; then the page re-renders with that saved row,
 *    as the real action's revalidatePath does;
 *  - the detailed planner's own `./actions` (compiler `planner-actions-mock`)
 *    record any call and refuse, so a hidden autosave or estimate read is visible;
 *  - routing, the proposal draft save and refresh are MOCK; publish/retry/upload/AI refuse;
 *  - localStorage is an in-memory stand-in holding the planner's working week:
 *    5 days, explicit synthetic input (the app default is unchanged).
 * No server, account, database, publication or provider.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import SimpleProgrammeClient from "../../src/app/dashboard/projects/schedule/simple-programme-client";
import ReviewSendClient, { type ReviewServer } from "../../src/app/dashboard/projects/proposal/review-send-client";
import type { SaveProgrammeInclusion } from "../../src/app/dashboard/projects/schedule/inclusion-actions";
import { buildProgrammePhases, type SaveProgramme, type SimpleProgrammeInput } from "../../src/lib/simple-programme";
import { withProgrammeInclusion } from "../../src/lib/programme-inclusion";
import type { ReviewContext, ReviewProject } from "../../src/lib/proposal-review";

type View = "programme" | "proposal";
export interface LocalReportedCalendarFixture {
    view: View;
    projectRow: ReviewProject;
    programmeSaves: SimpleProgrammeInput[];
    inclusionSaves: boolean[];
    /** Calls reaching the detailed planner's own server actions (all refused). */
    plannerCalls: { name: string; args: unknown[] }[];
    refreshes: number;
    navigation: string[];
    unexpected: string[];
    proposalDraftSaves: number;
    publicationsAttempted: number;
    proposalContext: { startDate: string | null; phases: unknown[] | null } | null;
    router: { refresh(): void; push(path: string): void; replace(path: string): void; prefetch(): void; back(): void; forward(): void };
}
declare global {
    interface Window { __reportedCalendarLocal: LocalReportedCalendarFixture }
}

const PROJECT_ID = "local-reported-calendar-job";
const FIXED_NOW = "2026-10-12T12:00:00.000Z";
const proposalPath = `/dashboard/projects/proposal?projectId=${encodeURIComponent(PROJECT_ID)}`;

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

const root = createRoot(document.getElementById("app")!);

const fixture: LocalReportedCalendarFixture = {
    view: "programme",
    projectRow: {
        id: PROJECT_ID, name: "TEST DATA - Reported calendar example", client_name: "TEST DATA - Synthetic client",
        brief_scope: "Strip out, install and finish a kitchen.",
        payment_schedule: [{ id: "pay-1", stage: "On completion", description: "When the work is finished", percentage: 100 }],
        programme_phases: [],
        start_date: "2026-10-18",
    },
    programmeSaves: [],
    inclusionSaves: [],
    plannerCalls: [],
    refreshes: 0,
    navigation: [],
    unexpected: [],
    proposalDraftSaves: 0,
    publicationsAttempted: 0,
    proposalContext: null,
    router: {
        refresh: () => { fixture.refreshes += 1; if (fixture.view === "programme") renderProgramme(); },
        push: path => routePush(path),
        replace: path => unexpected(`Unexpected fixture replace: ${path}`),
        prefetch: () => {},
        back: () => unexpected("Unexpected fixture back"),
        forward: () => unexpected("Unexpected fixture forward"),
    },
};
window.__reportedCalendarLocal = fixture;

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
    setTimeout(() => { if (fixture.view === "programme") renderProgramme(); }, 0);
    return { success: true };
};

const saveInclusion: SaveProgrammeInclusion = async (include) => {
    fixture.inclusionSaves.push(include);
    const programmePhases = withProgrammeInclusion(fixture.projectRow.programme_phases, include);
    fixture.projectRow = { ...fixture.projectRow, programme_phases: programmePhases };
    return { success: true, programmePhases };
};

function renderProgramme() {
    fixture.view = "programme";
    root.render(<SimpleProgrammeClient project={fixture.projectRow} lockReason={null} estimate={null}
        save={saveProgramme} saveInclusion={saveInclusion} />);
}

const reviewServer: ReviewServer = {
    save: async () => { fixture.proposalDraftSaves += 1; return { success: true }; },
    ask: async () => { throw new Error("No AI transport in the fixture"); },
    publish: async () => {
        fixture.publicationsAttempted += 1;
        return { success: false, error: "Local fixture: publishing is excluded." };
    },
    retry: async () => ({ success: false, error: "Local fixture: delivery retry is excluded." }),
    upload: async () => ({ error: "Local fixture: photo upload is excluded." }),
    loadPublication: async () => ({ success: false, error: "Local fixture: there are no published versions." }),
};

function renderProposal() {
    fixture.proposalContext = {
        startDate: fixture.projectRow.start_date ?? null,
        phases: structuredClone(fixture.projectRow.programme_phases ?? null),
    };
    const context: ReviewContext = {
        project: fixture.projectRow,
        profile: { company_name: "TEST DATA - Building Ltd", phone: "01632 960000", capability_statement: "A local firm doing careful work." },
        estimate: {
            id: "local-reported-calendar-estimate", version_name: "Estimate v1",
            prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0,
            estimate_lines: [{ id: "line-1", trade_section: "General", description: "Kitchen strip out, install and finishing", quantity: 1, unit: "item", line_total: 9000 }],
        },
        nextVersion: 1,
    };
    fixture.view = "proposal";
    root.render(<ReviewSendClient context={context} caseStudies={[]} lockReason={null} estimateIssue={null}
        publications={[]} server={reviewServer} now={FIXED_NOW} />);
}

function routePush(path: string) {
    if (fixture.view === "programme" && path === proposalPath) {
        fixture.navigation.push(path);
        renderProposal();
        return;
    }
    unexpected(`Unexpected fixture destination: ${path}`);
}

renderProgramme();
