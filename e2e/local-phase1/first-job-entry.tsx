import React from "react";
import { createRoot } from "react-dom/client";
import NewProjectForm from "../../src/app/dashboard/projects/new/new-project-form";
import BriefClient from "../../src/app/dashboard/projects/brief/brief-client";
import EstimateClient from "../../src/app/dashboard/projects/costs/estimate-client";
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
import type { EstimatingServer } from "../../src/lib/simple-estimate";

type BriefProject = Parameters<typeof BriefClient>[0]["project"];
export type View = "new-job" | "brief" | "pricing";
export interface LocalFirstJobFixture {
    view: View;
    /** Exactly what NewProjectForm submitted, one entry per create call. */
    attempts: Array<Record<string, string>>;
    /** The graph the existing parse/build modules produced for each mocked RPC call. */
    rpcCalls: Array<{ graph: BlankProjectGraph; outcome: "created" | "refused" }>;
    results: CreateBlankProjectResult[];
    nextCreate: "success" | "refused";
    jobId: string | null;
    project: BriefProject | null;
    lockReason: string | null;
    briefSaves: Array<{ projectId: string; payload: BriefSavePayload }>;
    navigation: string[];
    unexpected: string[];
    priceWrites: string[];
    router: { push: (href: string) => void; replace: (href: string) => void; refresh: () => void; prefetch: () => void; back: () => void; forward: () => void };
}
declare global { interface Window { __firstJobLocal: LocalFirstJobFixture } }

// about:blank is not a secure origin. Adapt only its missing UUID API using
// the existing client-id helper's getRandomValues/v4 algorithm, not a fixed ID.
if (typeof crypto.randomUUID !== "function") {
    Object.defineProperty(crypto, "randomUUID", { value: () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    } });
}

// about:blank has no storage origin. Keep this fixture's storage ephemeral;
// it does not exercise the application's browser or durable persistence.
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
const refusedPriceWrite = async () => {
    window.__firstJobLocal.priceWrites.push("Unexpected attempted price write");
    return { ok: false as const, error: "Local fixture: price persistence is excluded." };
};
const server: EstimatingServer = {
    saveLine: refusedPriceWrite, updateLine: refusedPriceWrite,
    deleteLine: refusedPriceWrite, saveAdjustments: refusedPriceWrite,
};
const unexpected = (message: string): never => {
    fixture.unexpected.push(message);
    throw Error(message);
};

// Stands in for the createBlankProjectAction server action: the same
// parse -> build -> RPC -> resolve chain, with only the RPC reply mocked.
// The mocked RPC answers with the form's own requestId as the project id.
const createProject = async (formData: FormData): Promise<CreateBlankProjectResult> => {
    const raw: Record<string, string> = {};
    formData.forEach((value, key) => { raw[key] = String(value); });
    fixture.attempts.push(raw);
    const parsed = parseBlankProjectInput(raw);
    if (!parsed.ok) {
        const invalid = { success: false as const, error: parsed.error, fieldErrors: parsed.fieldErrors };
        fixture.results.push(invalid);
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
    fixture.results.push(result);
    return result;
};

const createdGraph = (): BlankProjectGraph => {
    const created = fixture.rpcCalls.filter(call => call.outcome === "created");
    if (created.length !== 1 || created[0].graph.requestId !== fixture.jobId) unexpected("Expected exactly one created job");
    return created[0].graph;
};

// Mirrors the Brief page's projection of a project row. The row is the created
// graph's project, so anything the graph leaves out falls back exactly as the
// page does. The page's private postcode extraction is not run (see REPORT.md).
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

const renderBrief = (id: string) => {
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
            return { success: true };
        }} />);
};

// Pricing receives the project as the Brief save left it, as the costs page
// would read it back; estimates come from the created graph (none).
const renderPricing = (id: string) => {
    const project = fixture.project!;
    fixture.view = "pricing";
    root.render(<EstimateClient key={id} estimates={[...createdGraph().estimates]}
        project={{ id: project.id, name: project.name, client_name: project.client_name, brief_scope: project.brief_scope ?? "", brief_trade_sections: project.brief_trade_sections }}
        server={server}
        loadAdvancedData={async () => ({ ok: false, error: "Advanced tools are outside this fixture." })} />);
};

const fixture: LocalFirstJobFixture = {
    view: "new-job", attempts: [], rpcCalls: [], results: [], nextCreate: "success",
    jobId: null, project: null, lockReason: null, briefSaves: [], navigation: [], unexpected: [], priceWrites: [],
    router: {
        push: href => {
            const id = fixture.jobId ?? unexpected("Navigation before a job was created");
            if (fixture.view === "new-job" && href === briefPathForProject(id)) {
                fixture.navigation.push(href);
                renderBrief(id);
            } else if (fixture.view === "brief" && href === pricingPathForProject(id)) {
                fixture.navigation.push(href);
                renderPricing(id);
            } else unexpected(`Unexpected fixture destination: ${href}`);
        },
        replace: href => unexpected(`Unexpected fixture replace: ${href}`),
        refresh: () => {},
        prefetch: () => {},
        back: () => unexpected("Unexpected fixture back"),
        forward: () => unexpected("Unexpected fixture forward"),
    },
};
window.__firstJobLocal = fixture;
root.render(<NewProjectForm isFirstProject={true} createProject={createProject} />);
