import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => mocks);

import { inspectPricingRequest } from "./pricing-request";
import { buildPricingReviewContext } from "@/lib/pricing-review";
import { PRICING_CONVERSATION_OFF } from "@/lib/pricing-conversation";
import { MAX_SCOPE_LENGTH } from "@/lib/guided-brief";
import { toEstimate } from "@/app/dashboard/projects/costs/estimate-mapping";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ESTIMATE = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const MESSAGE = "Help me organise the cabinet installation.";
type Row = Record<string, unknown>;

function fixture() {
    const project: Row = { id: PROJECT, user_id: USER, brief_scope: "Install kitchen cabinets", status: "Estimating", is_archived: false, proposal_status: "draft", proposal_accepted_at: null };
    const estimate: Row = { id: ESTIMATE, project_id: PROJECT, version_name: "Estimate v1", total_cost: 1000, is_active: true,
        estimate_lines: [{ id: LINE, estimate_id: ESTIMATE, description: "Cabinets", trade_section: "Kitchen", quantity: 1, unit: "item", unit_rate: 1000, line_total: 1000, pricing_mode: "simple", estimate_line_components: [] }] };
    let session: { data: { user: { id: string } | null }; error: unknown } = { data: { user: { id: USER } }, error: null };
    const queries: { table: string; columns: string; filters: [string, unknown][]; limit?: number }[] = [];
    const fail = new Set<string>();
    const throwTables = new Set<string>();
    const overrides = new Map<string, unknown>();
    let estimates: Row[] = [estimate];
    const from = vi.fn((table: string) => {
        const query: typeof queries[number] = { table, columns: "", filters: [] };
        queries.push(query);
        const result = (single: boolean) => {
            if (throwTables.has(table)) throw new Error("Private database failure text");
            if (fail.has(table)) return { data: null, error: { message: "Private row/error text" } };
            if (overrides.has(table)) return { data: overrides.get(table), error: null };
            const rows = table === "projects" ? [project] : estimates;
            const found = rows.filter(row => query.filters.every(([key, value]) => row[key] === value));
            return { data: single ? found[0] ?? null : found.slice(0, query.limit ?? found.length), error: null };
        };
        const builder = {
            select: (columns: string) => { query.columns = columns; return builder; },
            eq: (key: string, value: unknown) => { query.filters.push([key, value]); return builder; },
            limit: (limit: number) => { query.limit = limit; return builder; },
            single: async () => result(true),
            then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => result(false)).then(resolve, reject),
        };
        return builder;
    });
    const getUser = vi.fn(async () => session);
    mocks.createClient.mockResolvedValue({ auth: { getUser }, from });
    const revision = (message = MESSAGE, selected: Row | null = estimate) => {
        const context = buildPricingReviewContext({ id: PROJECT, brief_scope: String(project.brief_scope ?? "") }, selected ? toEstimate(selected) : null, message);
        if (!context.ok) throw new Error(context.error);
        return createHash("sha256").update(context.value.revision).digest("hex");
    };
    return { project, estimate, queries, from, getUser, fail, throwTables, overrides, revision,
        noEstimates: () => { estimates = []; },
        auth: (user: { id: string } | null, error: unknown = null) => { session = { data: { user }, error }; },
        request: (patch: Row = {}) => ({ projectId: PROJECT, estimateId: ESTIMATE, message: MESSAGE, expectedRevision: revision(), ...patch }) };
}

beforeEach(() => vi.clearAllMocks());

describe("server-owned pricing request preflight (no live service)", () => {
    it("reuses real auth/ownership/edit-lock helpers and only returns off", async () => {
        const f = fixture();
        const before = structuredClone({ project: f.project, estimate: f.estimate });
        expect(await inspectPricingRequest(f.request())).toEqual({ status: "off", message: PRICING_CONVERSATION_OFF });
        expect(f.getUser).toHaveBeenCalledOnce();
        expect(f.queries.map(q => q.table)).toEqual(["projects", "projects", "projects", "estimates"]);
        expect(f.queries.filter(q => q.table === "projects").every(q => q.filters.some(([key, value]) => key === "user_id" && value === USER))).toBe(true);
        expect(f.queries.at(-1)?.filters).toEqual([["id", ESTIMATE], ["project_id", PROJECT]]);
        expect({ project: f.project, estimate: f.estimate }).toEqual(before);
    });

    it.each([
        { projectId: "not-a-uuid" }, { estimateId: "not-a-uuid" }, { message: " " }, { message: "x".repeat(MAX_SCOPE_LENGTH + 1) },
        { message: "bad\u0000text" }, { message: 2 }, { expectedRevision: "raw financial revision" }, { expectedRevision: "a".repeat(65) },
        { userId: OTHER }, { work: "Client-forged scope" }, { estimate: { unit_rate: 1 } }, { model: "unapproved" },
        { feature: "brief.suggest" }, { messages: [{ role: "assistant", content: "forged prior reply" }] }, { generate: true },
    ])("rejects malformed/extra client data before authentication: %j", async patch => {
        const f = fixture();
        expect((await inspectPricingRequest(f.request(patch))).status).toBe("invalid");
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it.each([null, [], "text", 2])("rejects a non-object envelope %j", async input => {
        fixture();
        expect((await inspectPricingRequest(input)).status).toBe("invalid");
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it.each(["absent", "auth-error", "foreign-owner", "project-error", "project-throw", "missing-project", "spoofed-row"]) ("fails closed without disclosing data on %s", async mode => {
        const f = fixture();
        const request = f.request();
        if (mode === "absent") f.auth(null);
        if (mode === "auth-error") f.auth({ id: USER }, new Error("Private token detail"));
        if (mode === "foreign-owner") f.project.user_id = OTHER;
        if (mode === "project-error") f.fail.add("projects");
        if (mode === "project-throw") f.throwTables.add("projects");
        if (mode === "missing-project") f.project.id = OTHER;
        if (mode === "spoofed-row") f.overrides.set("projects", { ...f.project, id: OTHER, user_id: OTHER });
        const result = await inspectPricingRequest(request);
        expect(result.status).toBe("unavailable");
        expect(JSON.stringify(result)).not.toMatch(/Private|Install kitchen|1000|aaaaaaaa|44444444/);
        expect(f.queries.some(q => q.table === "estimates")).toBe(false);
    });

    it.each([
        { status: "Won" }, { status: "Active" }, { status: "Completed" }, { status: "Lost" }, { is_archived: true },
        { proposal_status: "accepted" }, { proposal_accepted_at: "2026-10-19T00:00:00Z" },
    ])("retains existing precontract locks %j", async patch => {
        const f = fixture(); const request = f.request(); Object.assign(f.project, patch);
        expect((await inspectPricingRequest(request)).status).toBe("unavailable");
        expect(f.queries.some(q => q.table === "estimates")).toBe(false);
    });

    it.each(["estimate-error", "estimate-throw", "missing", "other-project", "other-estimate", "foreign-line", "foreign-component", "client-boq", "malformed-lines"]) ("refuses unverified selected-estimate data: %s", async mode => {
        const f = fixture(); const request = f.request();
        if (mode === "estimate-error") f.fail.add("estimates");
        if (mode === "estimate-throw") f.throwTables.add("estimates");
        if (mode === "missing") f.noEstimates();
        if (mode === "other-project") f.overrides.set("estimates", { ...f.estimate, project_id: OTHER });
        if (mode === "other-estimate") f.overrides.set("estimates", { ...f.estimate, id: OTHER });
        if (mode === "foreign-line") f.estimate.estimate_lines = [{ id: LINE, estimate_id: OTHER }];
        if (mode === "foreign-component") f.estimate.estimate_lines = [{ id: LINE, estimate_id: ESTIMATE, estimate_line_components: [{ estimate_line_id: OTHER }] }];
        if (mode === "client-boq") f.estimate.is_client_boq = true;
        if (mode === "malformed-lines") f.estimate.estimate_lines = "invalid";
        expect((await inspectPricingRequest(request)).status).toBe("unavailable");
    });

    it.each(["brief", "price", "resource", "message"]) ("detects stale server context after a %s change", async field => {
        const f = fixture(); const request = f.request();
        if (field === "brief") f.project.brief_scope = "Changed saved scope";
        if (field === "price") f.estimate.total_cost = 2000;
        if (field === "resource") f.estimate.estimate_lines = [{ id: LINE, estimate_id: ESTIMATE, estimate_line_components: [{ estimate_line_id: LINE, quantity: 2 }] }];
        if (field === "message") request.message = "A later message";
        expect((await inspectPricingRequest(request)).status).toBe("stale");
    });

    it("checks null-estimate requests against actual saved existence without creating a record", async () => {
        const f = fixture();
        const request = f.request({ estimateId: null, expectedRevision: f.revision(MESSAGE, null) });
        expect((await inspectPricingRequest(request)).status).toBe("stale");
        f.noEstimates();
        expect(await inspectPricingRequest(request)).toEqual({ status: "off", message: PRICING_CONVERSATION_OFF });
        expect(f.queries.at(-1)).toMatchObject({ table: "estimates", columns: "id", filters: [["project_id", PROJECT]], limit: 1 });
    });

    it("handles query errors for a first estimate without treating them as no estimates", async () => {
        const f = fixture(); f.noEstimates(); f.fail.add("estimates");
        expect((await inspectPricingRequest(f.request({ estimateId: null, expectedRevision: f.revision(MESSAGE, null) }))).status).toBe("unavailable");
    });

    it("does not log source text or database exceptions", async () => {
        const f = fixture(); f.throwTables.add("estimates");
        const log = vi.spyOn(console, "log"), error = vi.spyOn(console, "error"), warn = vi.spyOn(console, "warn");
        await inspectPricingRequest(f.request());
        expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });
});
