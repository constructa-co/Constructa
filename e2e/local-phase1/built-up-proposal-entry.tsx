/**
 * Local offline fixture: optional built-up price -> programme -> proposal -> draft PDF.
 *
 * REAL EstimateClient, lazy AdvancedEstimate, BuildUpPanel, SimpleProgrammeClient,
 * ReviewSendClient, frozen snapshot/document builders and jsPDF renderer.
 * Starts from one synthetic saved line (10 m² at £50.00). Everything after
 * that comes from what the user enters and what the MOCK transport acknowledges:
 *  - costs `./actions` (compiler `build-up-actions` MOCK module) answer from the
 *    spec's script. An acknowledged resource or rate is written to the in-memory
 *    MOCK store exactly as returned; the rate acknowledgement is derived from the
 *    submitted (line, rate, quantity) arguments with the same quantity x rate
 *    expression the real action writes. Nothing downstream is reseeded;
 *  - programme/inclusion saves, routing, proposal draft save are MOCK; publish,
 *    retry, upload, history and AI refuse.
 * No server, account, database, resource library, publication or provider.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate, EstimateLineComponent } from "../../src/app/dashboard/projects/costs/types";
import SimpleProgrammeClient from "../../src/app/dashboard/projects/schedule/simple-programme-client";
import ReviewSendClient, { type ReviewServer } from "../../src/app/dashboard/projects/proposal/review-send-client";
import type { EstimatingServer } from "../../src/lib/simple-estimate";
import type { SaveProgrammeInclusion } from "../../src/app/dashboard/projects/schedule/inclusion-actions";
import { buildProgrammePhases, type SaveProgramme, type SimpleProgrammeInput } from "../../src/lib/simple-programme";
import { withProgrammeInclusion } from "../../src/lib/programme-inclusion";
import type { ReviewContext, ReviewProject } from "../../src/lib/proposal-review";

type View = "pricing" | "programme" | "proposal";
type ActionAnswer = "ack" | "refuse";
/** The contract the compiler's `build-up-actions` MOCK module calls. */
interface BuildUpActions {
    actionCalls: { name: string; args: unknown[] }[];
    script: { addComponent: ActionAnswer[]; applyRate: ActionAnswer[] };
    answer: (name: string, args: unknown[]) => Promise<unknown>;
}
export interface LocalBuiltUpProposalFixture {
    view: View;
    /** The MOCK persisted estimate: baseline plus acknowledged writes only. */
    estimates: Estimate[];
    navigation: string[];
    unexpected: string[];
    simpleServerCalls: string[];
    programmeSaves: SimpleProgrammeInput[];
    inclusionSaves: boolean[];
    proposalDraftSaves: number;
    publicationsAttempted: number;
    /** The estimate exactly as handed to the proposal page. */
    proposalEstimate: Estimate | null;
    projectRow: ReviewProject;
    router: { refresh(): void; push(path: string): void; replace(path: string): void; prefetch(): void; back(): void; forward(): void };
}
declare global {
    interface Window { __builtUpProposalLocal: LocalBuiltUpProposalFixture; __builtUpProposalActions: BuildUpActions }
}

const FIXED_NOW = "2026-10-23T12:00:00.000Z";
const PROJECT_ID = "local-built-up-proposal-job";
const ESTIMATE_ID = "local-built-up-proposal-estimate";
const LINE_ID = "local-built-up-proposal-line";
const programmePath = `/dashboard/projects/schedule?projectId=${encodeURIComponent(PROJECT_ID)}`;
const proposalPath = `/dashboard/projects/proposal?projectId=${encodeURIComponent(PROJECT_ID)}`;
const paymentSchedule = [{ id: "pay-1", stage: "On completion", description: "When the driveway is finished", percentage: 100 }];

// about:blank has no storage origin; EstimateClient remembers its tab in sessionStorage.
const sessionValues = new Map<string, string>();
Object.defineProperty(window, "sessionStorage", { value: {
    get length() { return sessionValues.size; },
    clear: () => sessionValues.clear(),
    key: (index: number) => [...sessionValues.keys()][index] ?? null,
    getItem: (key: string) => sessionValues.get(key) ?? null,
    setItem: (key: string, value: string) => { sessionValues.set(String(key), String(value)); },
    removeItem: (key: string) => { sessionValues.delete(key); },
} satisfies Storage });

const root = createRoot(document.getElementById("app")!);

const fixture: LocalBuiltUpProposalFixture = {
    view: "pricing",
    estimates: [{
        id: ESTIMATE_ID, project_id: PROJECT_ID, version_name: "Estimate v1",
        prelims_pct: 0, overhead_pct: 0, risk_pct: 0, profit_pct: 0, discount_pct: 0, discount_reason: "",
        total_cost: 500, is_active: true,
        estimate_lines: [{
            id: LINE_ID, estimate_id: ESTIMATE_ID, description: "Lay block paving", quantity: 10, unit: "m²",
            unit_rate: 50, line_total: 500, trade_section: "General", line_type: "general", pricing_mode: "simple",
            estimate_line_components: [],
        }],
    }],
    navigation: [],
    unexpected: [],
    simpleServerCalls: [],
    programmeSaves: [],
    inclusionSaves: [],
    proposalDraftSaves: 0,
    publicationsAttempted: 0,
    proposalEstimate: null,
    projectRow: {
        id: PROJECT_ID, name: "TEST DATA - Driveway", client_name: "Synthetic client",
        brief_scope: "Lay a block paved driveway.", payment_schedule: paymentSchedule,
        programme_phases: [], start_date: null,
    },
    router: {
        refresh: () => {},
        push: path => routePush(path),
        replace: path => unexpected(`Unexpected fixture replace: ${path}`),
        prefetch: () => {},
        back: () => unexpected("Unexpected fixture back"),
        forward: () => unexpected("Unexpected fixture forward"),
    },
};
window.__builtUpProposalLocal = fixture;

function unexpected(message: string): never {
    fixture.unexpected.push(message);
    throw Error(message);
}

/** Replace the MOCK persisted line with what an acknowledgement says was stored. */
function persistLine(lineId: string, change: (line: Estimate["estimate_lines"][number]) => Estimate["estimate_lines"][number]) {
    fixture.estimates = fixture.estimates.map(estimate => {
        if (!estimate.estimate_lines.some(line => line.id === lineId)) return estimate;
        const lines = estimate.estimate_lines.map(line => (line.id === lineId ? change(line) : line));
        return { ...estimate, estimate_lines: lines, total_cost: lines.reduce((sum, line) => sum + (Number(line.line_total) || 0), 0) };
    });
}

window.__builtUpProposalActions = {
    actionCalls: [],
    script: { addComponent: [], applyRate: [] },
    async answer(name, args) {
        const script = window.__builtUpProposalActions.script;
        if (name === "addComponentAction") {
            if (script.addComponent.shift() !== "ack") return null;
            const [lineId, data] = args as [string, Record<string, unknown>];
            const row = { ...data, id: `local-component-${window.__builtUpProposalActions.actionCalls.length}`, estimate_line_id: lineId } as unknown as EstimateLineComponent;
            persistLine(lineId, line => ({ ...line, estimate_line_components: [...line.estimate_line_components, row] }));
            return row;
        }
        if (name === "updateLineBuiltUpRateAction") {
            const [lineId, builtUpRate, expectedQuantity] = args as [string, number, number];
            if (script.applyRate.shift() !== "ack") throw new Error("Local fixture: rate not acknowledged.");
            const stored = fixture.estimates.flatMap(estimate => estimate.estimate_lines).find(line => line.id === lineId);
            if (!stored || stored.quantity !== expectedQuantity) throw new Error("Local fixture: priced quantity changed.");
            // Same write expression as the real action: line_total = expectedQuantity * builtUpRate.
            const saved = { unitRate: builtUpRate, quantity: expectedQuantity, lineTotal: expectedQuantity * builtUpRate };
            persistLine(lineId, line => ({ ...line, unit_rate: saved.unitRate, line_total: saved.lineTotal }));
            return saved;
        }
        throw new Error(`Local built-up proposal fixture does not answer ${name}`);
    },
};

// The shared compiler transport uses its existing runtime key; the scenario's
// typed global stays distinct from the standalone build-up fixture contract.
(window as unknown as { __buildUpLocal: BuildUpActions }).__buildUpLocal = window.__builtUpProposalActions;

const refuseSimple = (name: string) => async () => {
    fixture.simpleServerCalls.push(name);
    return { ok: false as const, success: false as const, error: "Local fixture: simple price saves are outside this leg." };
};
const estimatingServer = {
    saveLine: refuseSimple("saveLine"),
    updateLine: refuseSimple("updateLine"),
    deleteLine: refuseSimple("deleteLine"),
    saveAdjustments: refuseSimple("saveAdjustments"),
} as unknown as EstimatingServer;

function renderPricing() {
    fixture.view = "pricing";
    root.render(<EstimateClient
        estimates={structuredClone(fixture.estimates)}
        project={{
            id: PROJECT_ID, name: "TEST DATA - Driveway", client_name: "Synthetic client",
            brief_scope: fixture.projectRow.brief_scope ?? "", payment_schedule: paymentSchedule,
        }}
        server={estimatingServer}
        loadAdvancedData={async () => ({ ok: true, data: { orgId: "local-built-up-org", costLibrary: [], rateBuildups: [], labourRates: [], preferredTrades: [] } })}
    />);
}

const saveProgramme: SaveProgramme = async (input) => {
    fixture.programmeSaves.push(structuredClone(input));
    fixture.projectRow = {
        ...fixture.projectRow,
        start_date: input.timeBasis === "relative" ? null : input.startDate,
        programme_phases: buildProgrammePhases(input, fixture.projectRow.programme_phases),
    };
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
    // The proposal page reads the stored estimate, as the real page does after navigation.
    const estimate = structuredClone(fixture.estimates[0] ?? unexpected("Proposal without an estimate"));
    fixture.proposalEstimate = structuredClone(estimate);
    const context: ReviewContext = {
        project: fixture.projectRow,
        profile: { company_name: "Example Local Builder", phone: "01632 960000", capability_statement: "A local firm doing careful work." },
        estimate,
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

document.addEventListener("click", (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const href = anchor.getAttribute("href");
    if (fixture.view === "pricing" && href === programmePath) {
        event.preventDefault();
        fixture.navigation.push(href);
        renderProgramme();
    }
});

renderPricing();
