/**
 * Joined offline fixture (unseeded pricing): company setup -> readiness ->
 * first job -> Brief -> empty EstimateClient -> MOCK-acknowledged first price
 * line -> programme -> proposal review -> draft PDF.
 *
 * REAL components, validators, parsers, programme/proposal builders and jsPDF
 * renderer. MOCK transport: setup saves, job creation RPC, brief/programme
 * saves, deliberate MOCK price-line acknowledgement (in-memory only), Next
 * routing, theme and sessionStorage. No pre-seeded estimate lines.
 *
 * Client response UI may render in the proposal preview; acceptance,
 * publication, delivery and Won are never exercised.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import OnboardingClient from "../../src/app/onboarding/onboarding-client";
import ReadinessClient from "../../src/app/dashboard/settings/profile/readiness/readiness-client";
import { FirstSessionFrame } from "../../src/components/first-session-frame";
import NewProjectForm from "../../src/app/dashboard/projects/new/new-project-form";
import BriefClient from "../../src/app/dashboard/projects/brief/brief-client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
import type { Estimate, EstimateLine } from "../../src/app/dashboard/projects/costs/types";
import SimpleProgrammeClient from "../../src/app/dashboard/projects/schedule/simple-programme-client";
import ReviewSendClient, { type ReviewServer } from "../../src/app/dashboard/projects/proposal/review-send-client";
import { buildCompanyReadiness } from "../../src/lib/company-readiness";
import {
    NEW_PROJECT_PATH,
    buildSetupPatch,
    resolvePostSetupPath,
    type SetupProfileSnapshot,
    type SetupStepInput,
} from "../../src/lib/first-session";
import {
    briefPathForProject,
    buildBlankProjectGraph,
    parseBlankProjectInput,
    resolveBlankProjectCreation,
    type BlankProjectGraph,
    type CreateBlankProjectResult,
} from "../../src/lib/blank-project";
import { pricingPathForProject, type BriefSavePayload } from "../../src/lib/guided-brief";
import { getPrecontractEditLockReason } from "../../src/lib/project-editability";
import {
    SIMPLE_LINE_SECTION,
    lineTotal,
    type EstimatingServer,
    type SavePriceLineRequest,
    type SavePriceLineResult,
} from "../../src/lib/simple-estimate";
import type { SaveProgrammeInclusion } from "../../src/app/dashboard/projects/schedule/inclusion-actions";
import { buildProgrammePhases, type SaveProgramme, type SimpleProgrammeInput } from "../../src/lib/simple-programme";
import { withProgrammeInclusion } from "../../src/lib/programme-inclusion";
import type { ReviewContext, ReviewProject } from "../../src/lib/proposal-review";

type BriefProject = Parameters<typeof BriefClient>[0]["project"];
export type JourneyView =
    | "onboarding"
    | "readiness"
    | "new-job"
    | "brief"
    | "pricing"
    | "programme"
    | "proposal";

export interface LocalUnseededJourneyFixture {
    view: JourneyView;
    companyRoute: "/onboarding" | "readiness";
    profile: SetupProfileSnapshot;
    setupCalls: SetupStepInput[];
    setupNavigation: string[];
    setupNextSave: "acknowledged" | "refused";
    attempts: Array<Record<string, string>>;
    rpcCalls: Array<{ graph: BlankProjectGraph; outcome: "created" | "refused" }>;
    createResults: CreateBlankProjectResult[];
    nextCreate: "success" | "refused";
    jobId: string | null;
    project: BriefProject | null;
    lockReason: string | null;
    briefSaves: Array<{ projectId: string; payload: BriefSavePayload }>;
    navigation: string[];
    unexpected: string[];
    priceWrites: string[];
    estimates: Estimate[];
    priceSaveAttempts: SavePriceLineRequest[];
    priceSaveAcknowledgements: number;
    nextPriceSave: "acknowledged" | "refused";
    programmeSaves: SimpleProgrammeInput[];
    inclusionSaves: boolean[];
    proposalDraftSaves: number;
    publicationsAttempted: number;
    proposalContext: { startDate: string | null; phases: unknown[] | null } | null;
    routerRefreshes: number;
    programmeNextSave: "success" | "refused";
    projectRow: ReviewProject;
    router: {
        refresh(): void;
        push(path: string): void;
        replace(path: string): void;
        prefetch(): void;
        back(): void;
        forward(): void;
    };
}

declare global { interface Window { __unseededJourneyLocal: LocalUnseededJourneyFixture } }

const FIXED_NOW = "2026-10-23T12:00:00.000Z";
const completionPath = resolvePostSetupPath(0, "/dashboard", true);

const emptyEstimateShell = (projectId: string, estimateId: string): Estimate => ({
    id: estimateId,
    project_id: projectId,
    version_name: "Estimate v1",
    prelims_pct: 0,
    overhead_pct: 0,
    risk_pct: 0,
    profit_pct: 0,
    discount_pct: 0,
    discount_reason: "",
    total_cost: 0,
    is_active: true,
    estimate_lines: [],
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

const defaultPaymentSchedule = [{ id: "pay-1", stage: "On completion", description: "When the room is handed over", percentage: 100 }];

if (typeof crypto.randomUUID !== "function") {
    Object.defineProperty(crypto, "randomUUID", { value: () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } });
}

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

const mockSaveLine = async (request: SavePriceLineRequest): Promise<SavePriceLineResult> => {
    fixture.priceSaveAttempts.push(structuredClone(request));
    if (fixture.nextPriceSave === "refused") {
        fixture.nextPriceSave = "acknowledged";
        return { ok: false, error: "Local fixture: price save not acknowledged." };
    }
    const estimateId = request.estimateId ?? request.newEstimateId;
    const saved = savedLineFromRequest(request, estimateId);
    const existing = fixture.estimates.find(e => e.id === estimateId) ?? null;
    if (!existing) {
        const created = { ...emptyEstimateShell(fixture.jobId ?? request.projectId, estimateId), estimate_lines: [saved], total_cost: saved.line_total };
        fixture.estimates = [created];
        fixture.priceSaveAcknowledgements += 1;
        return { ok: true, estimateId, createdEstimate: created, line: saved };
    }
    const lines = [...existing.estimate_lines.filter(l => l.id !== saved.id), saved];
    const total_cost = lines.reduce((sum, line) => sum + (Number(line.line_total) || 0), 0);
    const updated = { ...existing, estimate_lines: lines, total_cost };
    fixture.estimates = fixture.estimates.map(e => (e.id === estimateId ? updated : e));
    fixture.priceSaveAcknowledgements += 1;
    return { ok: true, estimateId, createdEstimate: null, line: saved };
};

const refusedUnexpectedPriceWrite = async () => {
    fixture.priceWrites.push("Unexpected attempted price write");
    return { ok: false as const, error: "Local fixture: price persistence is excluded." };
};

const estimatingServer: EstimatingServer = {
    saveLine: mockSaveLine,
    updateLine: refusedUnexpectedPriceWrite,
    deleteLine: refusedUnexpectedPriceWrite,
    saveAdjustments: refusedUnexpectedPriceWrite,
};

const unexpected = (message: string): never => {
    fixture.unexpected.push(message);
    throw Error(message);
};

const proposalPath = (id: string) => `/dashboard/projects/proposal?projectId=${encodeURIComponent(id)}`;
const programmePath = (id: string) => `/dashboard/projects/schedule?projectId=${encodeURIComponent(id)}`;

const fixture: LocalUnseededJourneyFixture = {
    view: "onboarding",
    companyRoute: "/onboarding",
    profile: {},
    setupCalls: [],
    setupNavigation: [],
    setupNextSave: "acknowledged",
    attempts: [],
    rpcCalls: [],
    createResults: [],
    nextCreate: "success",
    jobId: null,
    project: null,
    lockReason: null,
    briefSaves: [],
    navigation: [],
    unexpected: [],
    priceWrites: [],
    estimates: [],
    priceSaveAttempts: [],
    priceSaveAcknowledgements: 0,
    nextPriceSave: "acknowledged",
    programmeSaves: [],
    inclusionSaves: [],
    proposalDraftSaves: 0,
    publicationsAttempted: 0,
    proposalContext: null,
    routerRefreshes: 0,
    programmeNextSave: "success",
    projectRow: {
        id: "pending",
        name: "",
        client_name: "",
        brief_scope: "",
        payment_schedule: defaultPaymentSchedule,
        programme_phases: [],
        start_date: null,
    },
    router: {
        refresh: () => {
            fixture.routerRefreshes += 1;
            if (fixture.view === "onboarding") fixture.setupNavigation.push("refresh");
        },
        push: path => routePush(path),
        replace: path => unexpected(`Unexpected fixture replace: ${path}`),
        prefetch: () => {},
        back: () => unexpected("Unexpected fixture back"),
        forward: () => unexpected("Unexpected fixture forward"),
    },
};
window.__unseededJourneyLocal = fixture;

const activeEstimate = (): Estimate => {
    const estimate = fixture.estimates[0];
    if (!estimate || !estimate.estimate_lines.length) unexpected("Expected a MOCK-acknowledged estimate with at least one line");
    return estimate;
};

async function saveSetupStep(input: SetupStepInput) {
    fixture.setupCalls.push(input);
    const built = buildSetupPatch(input);
    if (!built.ok) return { error: built.error };
    if (fixture.setupNextSave === "refused") {
        fixture.setupNextSave = "acknowledged";
        return { error: "Local fixture: save not acknowledged." };
    }
    fixture.profile = { ...fixture.profile, ...built.patch };
    return { ok: true };
}

function renderOnboarding() {
    fixture.view = "onboarding";
    fixture.companyRoute = "/onboarding";
    root.render(
        <FirstSessionFrame signOut>
            <OnboardingClient initialStep="trade" initialBusinessType="" initialCompanyName="" initialFullName=""
                completionPath={completionPath} exitPath={null} saveStep={saveSetupStep} />
        </FirstSessionFrame>,
    );
}

function renderReadiness() {
    fixture.view = "readiness";
    fixture.companyRoute = "readiness";
    root.render(<ReadinessClient readiness={buildCompanyReadiness(fixture.profile)} hasProjects={false} />);
}

function renderNewJob() {
    fixture.view = "new-job";
    root.render(<NewProjectForm isFirstProject={true} createProject={createProject} />);
}

const createProject = async (formData: FormData): Promise<CreateBlankProjectResult> => {
    const raw: Record<string, string> = {};
    formData.forEach((value, key) => { raw[key] = String(value); });
    fixture.attempts.push(raw);
    const parsed = parseBlankProjectInput(raw);
    if (!parsed.ok) {
        const invalid = { success: false as const, error: parsed.error, fieldErrors: parsed.fieldErrors };
        fixture.createResults.push(invalid);
        return invalid;
    }
    const graph = buildBlankProjectGraph(parsed.input);
    const refuse = fixture.nextCreate === "refused";
    fixture.nextCreate = "success";
    fixture.rpcCalls.push({ graph: structuredClone(graph), outcome: refuse ? "refused" : "created" });
    const result = refuse
        ? resolveBlankProjectCreation(null, { message: "Local fixture: creation not acknowledged." })
        : resolveBlankProjectCreation([{ project_id: graph.requestId }], null);
    if (result.success) fixture.jobId = result.projectId;
    fixture.createResults.push(result);
    return result;
};

const createdGraph = (): BlankProjectGraph => {
    const created = fixture.rpcCalls.filter(call => call.outcome === "created");
    if (created.length !== 1 || created[0].graph.requestId !== fixture.jobId) unexpected("Expected exactly one created job");
    return created[0].graph;
};

const briefProjectFromGraph = (id: string, graph: BlankProjectGraph): BriefProject => {
    const row: Record<string, unknown> = graph.project;
    return {
        id,
        name: (row.name as string) || "",
        client_name: (row.client_name as string) || "",
        site_address: (row.site_address as string) || (row.address as string) || "",
        postcode: (row.postcode as string) || "",
        potential_value: (row.potential_value as number | null) ?? null,
        start_date: (row.start_date as string) || "",
        brief_scope: (row.brief_scope as string) || "",
        brief_trade_sections: (row.brief_trade_sections as string[]) || [],
        client_type: (row.client_type as string) || "domestic",
        lat: (row.lat as number | null) ?? null,
        lng: (row.lng as number | null) ?? null,
        region: (row.region as string) || "",
        brief_completed: (row.brief_completed as boolean) || false,
    };
};

function syncReviewProjectFromBrief() {
    const project = fixture.project!;
    fixture.projectRow = {
        id: project.id,
        name: project.name,
        client_name: project.client_name,
        brief_scope: project.brief_scope ?? "",
        payment_schedule: defaultPaymentSchedule,
        programme_phases: fixture.projectRow.programme_phases ?? [],
        start_date: project.start_date || null,
    };
}

function renderBrief(id: string) {
    const graph = createdGraph();
    fixture.project = briefProjectFromGraph(id, graph);
    fixture.lockReason = getPrecontractEditLockReason(graph.project);
    fixture.view = "brief";
    root.render(<BriefClient key={id} project={fixture.project} lockReason={fixture.lockReason}
        ask={async () => { throw Error("No AI transport in the fixture"); }}
        save={async (projectId, payload) => {
            fixture.briefSaves.push({ projectId, payload: structuredClone(payload) });
            if (projectId !== fixture.jobId) unexpected("Brief saved against a different job");
            fixture.project = { ...fixture.project!, ...payload, start_date: payload.start_date ?? "" };
            syncReviewProjectFromBrief();
            return { success: true };
        }} />);
}

function renderPricing(id: string) {
    const project = fixture.project!;
    fixture.view = "pricing";
    const estimates = fixture.estimates.length ? fixture.estimates : [];
    root.render(<EstimateClient key={`${id}-${estimates.length}-${estimates[0]?.estimate_lines.length ?? 0}`} estimates={estimates}
        project={{
            id: project.id, name: project.name, client_name: project.client_name,
            brief_scope: project.brief_scope ?? "", brief_trade_sections: project.brief_trade_sections,
            payment_schedule: defaultPaymentSchedule,
        }}
        server={estimatingServer}
        loadAdvancedData={async () => ({ ok: false, error: "Advanced tools are outside this fixture." })} />);
}

const saveProgramme: SaveProgramme = async (input) => {
    fixture.programmeSaves.push(structuredClone(input));
    if (fixture.programmeNextSave === "refused") {
        fixture.programmeNextSave = "success";
        return { success: false, error: "Local fixture: programme save not acknowledged." };
    }
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

function renderProgramme(id: string) {
    if (fixture.jobId !== id) unexpected("Programme opened for a different job");
    syncReviewProjectFromBrief();
    fixture.view = "programme";
    root.render(<SimpleProgrammeClient
        project={fixture.projectRow}
        lockReason={null}
        estimate={null}
        save={saveProgramme}
        saveInclusion={saveInclusion}
    />);
}

function renderProposal() {
    const id = fixture.jobId ?? unexpected("Proposal before job");
    const context: ReviewContext = {
        project: fixture.projectRow,
        profile: {
            company_name: fixture.profile.company_name ?? "Example Local Builder",
            phone: "01632 960000",
            capability_statement: "A local firm doing careful work.",
        },
        estimate: activeEstimate(),
        nextVersion: 1,
    };
    fixture.proposalContext = {
        startDate: fixture.projectRow.start_date ?? null,
        phases: structuredClone(fixture.projectRow.programme_phases ?? null),
    };
    fixture.view = "proposal";
    root.render(<ReviewSendClient
        context={context}
        caseStudies={[]}
        lockReason={null}
        estimateIssue={null}
        publications={[]}
        server={reviewServer}
        now={FIXED_NOW}
    />);
}

function routePush(path: string) {
    if (fixture.view === "onboarding" && path === completionPath) {
        fixture.setupNavigation.push(path);
        fixture.view = "readiness";
        renderReadiness();
        return;
    }
    const id = fixture.jobId;
    if (fixture.view === "new-job" && id && path === briefPathForProject(id)) {
        fixture.navigation.push(path);
        renderBrief(id);
        return;
    }
    if (fixture.view === "brief" && id && path === pricingPathForProject(id)) {
        fixture.navigation.push(path);
        renderPricing(id);
        return;
    }
    if (fixture.view === "programme" && id && path === proposalPath(id)) {
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
    if (!href) return;
    if (fixture.view === "readiness" && href === NEW_PROJECT_PATH) {
        event.preventDefault();
        fixture.navigation.push(href);
        renderNewJob();
        return;
    }
    const id = fixture.jobId;
    if (fixture.view === "pricing" && id && href === programmePath(id)) {
        event.preventDefault();
        fixture.navigation.push(href);
        renderProgramme(id);
        return;
    }
    if (id && href === proposalPath(id)) {
        event.preventDefault();
        fixture.router.push(href);
    }
});

renderOnboarding();
