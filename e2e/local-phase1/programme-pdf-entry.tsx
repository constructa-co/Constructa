/**
 * Local offline fixture: programme editor -> confirmed mocked save ->
 * frozen proposal snapshot/document -> draft PDF.
 *
 * REAL components, REAL state/controllers, REAL frozen-snapshot/document/PDF
 * builders. Simulated (mocked) transport only:
 *  - the programme save stand-in records the exact SimpleProgrammeInput the
 *    editor builds, then applies the same buildProgrammePhases the real
 *    server action applies, so the phases the proposal freezes are the ones
 *    the editor confirmed;
 *  - the inclusion stand-in applies the real withProgrammeInclusion marker;
 *  - proposal draft save / publish / retry / wording / upload / history are
 *    refused or recorded, never executed against anything;
 *  - Next routing is the fixture router; next/link anchor clicks on the
 *    proposal path are handed to it (stand-in for client-side navigation).
 *
 * Nothing here contacts a server, account, database, network or provider.
 * The detailed planner, as-built tracker, publishing and send are never
 * opened: they are outside this fixture.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import SimpleProgrammeClient from "../../src/app/dashboard/projects/schedule/simple-programme-client";
import ReviewSendClient, { type ReviewServer } from "../../src/app/dashboard/projects/proposal/review-send-client";
import type { SaveProgrammeInclusion } from "../../src/app/dashboard/projects/schedule/inclusion-actions";
import { buildProgrammePhases, type SaveProgramme, type SimpleProgrammeInput } from "../../src/lib/simple-programme";
import { withProgrammeInclusion } from "../../src/lib/programme-inclusion";
import type { ReviewContext, ReviewProject } from "../../src/lib/proposal-review";

export interface LocalProgrammePdfFixture {
    /** What the mock server holds: the saved project, updated on confirmed saves. */
    project: ReviewProject;
    /** Every SimpleProgrammeInput the editor tried to save, in order. */
    saves: SimpleProgrammeInput[];
    /** Every inclusion choice tried through the real inclusion control. */
    inclusionSaves: boolean[];
    proposalDraftSaves: number;
    publicationsAttempted: number;
    navigation: string[];
    routerRefreshes: number;
    nextSave: "success" | "refused";
    /** The project the proposal leg froze its preview from, after navigation. */
    proposalContext: { startDate: string | null; phases: unknown[] | null } | null;
    router: { push: (href: string) => void; refresh: () => void };
}
declare global { interface Window { __programmePdfLocal: LocalProgrammePdfFixture } }

const PROJECT_ID = "local-programme-pdf-job";
const PROPOSAL_PATH = `/dashboard/projects/proposal?projectId=${encodeURIComponent(PROJECT_ID)}`;
/** Fixed preview moment so the frozen issue/valid-until dates are deterministic. */
const FIXED_NOW = "2026-10-23T12:00:00.000Z";

const ESTIMATE = {
    id: "est-local-programme-pdf",
    version_name: "Estimate v1",
    prelims_pct: 0,
    overhead_pct: 0,
    risk_pct: 0,
    profit_pct: 0,
    discount_pct: 0,
    estimate_lines: [
        { id: "line-1", trade_section: "General", description: "Garage conversion, supplied and fitted", quantity: 1, unit: "item", line_total: 480 },
    ],
};

const PROFILE = {
    company_name: "Example Building Ltd",
    phone: "01632 960000",
    capability_statement: "A local firm doing careful work.",
};

const initialProject: ReviewProject = {
    id: PROJECT_ID,
    name: "Garage conversion",
    client_name: "Synthetic client",
    brief_scope: "Take out the garage door, fit a window and finish the room as a study.",
    payment_schedule: [{ id: "pay-1", stage: "On completion", description: "When the room is handed over", percentage: 100 }],
    programme_phases: [],
    start_date: null,
};

const root = createRoot(document.getElementById("app")!);

const fixture: LocalProgrammePdfFixture = {
    project: initialProject,
    saves: [],
    inclusionSaves: [],
    proposalDraftSaves: 0,
    publicationsAttempted: 0,
    navigation: [],
    routerRefreshes: 0,
    nextSave: "success",
    proposalContext: null,
    router: {
        push: (href: string) => {
            if (href !== PROPOSAL_PATH) throw new Error(`Unexpected fixture destination: ${href}`);
            fixture.navigation.push(href);
            renderProposal();
        },
        refresh: () => { fixture.routerRefreshes += 1; },
    },
};
window.__programmePdfLocal = fixture;

// The programme editor's save: record what it built, then apply the same
// phase builder the real server action applies. A refused save changes
// nothing, like a server that never acknowledged it.
const save: SaveProgramme = async (input) => {
    fixture.saves.push(structuredClone(input));
    if (fixture.nextSave === "refused") {
        fixture.nextSave = "success";
        return { success: false, error: "Local fixture: programme save not acknowledged." };
    }
    fixture.project = {
        ...fixture.project,
        start_date: input.timeBasis === "relative" ? null : input.startDate,
        programme_phases: buildProgrammePhases(input, fixture.project.programme_phases),
    };
    return { success: true };
};

// The real inclusion control, with the real marker writer behind it.
const saveInclusion: SaveProgrammeInclusion = async (include) => {
    fixture.inclusionSaves.push(include);
    const programmePhases = withProgrammeInclusion(fixture.project.programme_phases, include);
    fixture.project = { ...fixture.project, programme_phases: programmePhases };
    return { success: true, programmePhases };
};

// The proposal review screen's server surface. Reviewing and the draft PDF
// need none of it; everything else is recorded or refused, never executed.
const server: ReviewServer = {
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

// Stand-in for next/link client-side navigation: an anchor click on this
// job's proposal path is routed through the fixture router instead of the
// browser. Other anchors are never clicked in this fixture.
document.addEventListener("click", (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.getAttribute("href") === PROPOSAL_PATH) {
        event.preventDefault();
        fixture.router.push(PROPOSAL_PATH);
    }
});

function renderEditor() {
    root.render(<SimpleProgrammeClient
        project={fixture.project}
        lockReason={null}
        estimate={null}
        save={save}
        saveInclusion={saveInclusion}
    />);
}

function renderProposal() {
    const context: ReviewContext = {
        project: fixture.project,
        profile: PROFILE,
        estimate: ESTIMATE,
        nextVersion: 1,
    };
    fixture.proposalContext = {
        startDate: fixture.project.start_date ?? null,
        phases: structuredClone(fixture.project.programme_phases ?? null),
    };
    root.render(<ReviewSendClient
        context={context}
        caseStudies={[]}
        lockReason={null}
        estimateIssue={null}
        publications={[]}
        server={server}
        now={FIXED_NOW}
    />);
}

renderEditor();
