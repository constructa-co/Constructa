import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => mocks);

import { handlePricingTurn } from "./pricing-request";
import { handlePlanningTurn } from "./planning-request";
import { approvedPlanningGenerator, approvedPricingGenerator, jobAssistantAvailability, type ServerPlanningGenerator, type ServerPricingGenerator } from "./job-assistant-transport";
import { pricingAssistantTurnAction } from "@/app/dashboard/projects/costs/assistant-actions";
import { planningAssistantTurnAction } from "@/app/dashboard/projects/schedule/assistant-actions";
import { buildPricingReviewContext, PRICING_REVIEW_STALE } from "@/lib/pricing-review";
import { createPricingConversation, PRICING_CONVERSATION_OFF, PRICING_SERVER_STALE } from "@/lib/pricing-conversation";
import { buildPlanningContext, createPlanningConversation, PLANNING_OFF, PLANNING_SERVER_CHANGED } from "@/lib/planning-conversation";
import { createPlanningRequestGenerator, createPricingRequestGenerator } from "@/lib/job-assistant-client";
import { AssistantTransportError, sha256Hex, unwrapAssistantTurn } from "@/lib/assistant-transport";
import { toEstimate } from "@/app/dashboard/projects/costs/estimate-mapping";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ESTIMATE = "22222222-2222-4222-8222-222222222222";
const LINE = "33333333-3333-4333-8333-333333333333";
const OTHER = "44444444-4444-4444-8444-444444444444";
const MESSAGE = "Help me organise the cabinet installation.";
type Row = Record<string, unknown>;

/** A Supabase stand-in that answers the real access helpers and handlers from rows. */
function fixture() {
    const project: Row = {
        id: PROJECT, user_id: USER, name: "Kitchen refit", client_name: "QA client", brief_scope: "Install kitchen cabinets. Tile splashback.",
        status: "Estimating", is_archived: false, proposal_status: "draft", proposal_accepted_at: null, start_date: "2026-11-02",
        programme_phases: [{ name: "Strip out", manualDays: 5, startOffset: 0 }, { name: "Cabinets", manualDays: 5, startOffset: 7 }],
        programme_working_pattern: null,
    };
    const estimate: Row = { id: ESTIMATE, project_id: PROJECT, version_name: "Estimate v1", total_cost: 1000, is_active: true,
        estimate_lines: [{ id: LINE, estimate_id: ESTIMATE, description: "Cabinets", trade_section: "Kitchen", quantity: 1, unit: "item", unit_rate: 1000, line_total: 1000, pricing_mode: "simple", estimate_line_components: [] }] };
    let session: { data: { user: { id: string } | null }; error: unknown } = { data: { user: { id: USER } }, error: null };
    const queries: { table: string; columns: string; filters: [string, unknown][] }[] = [];
    let estimates: Row[] = [estimate];
    const from = vi.fn((table: string) => {
        const query: typeof queries[number] = { table, columns: "", filters: [] };
        queries.push(query);
        const result = (single: boolean) => {
            const rows = table === "projects" ? [project] : estimates;
            const found = rows.filter(row => query.filters.every(([key, value]) => row[key] === value));
            return { data: single ? found[0] ?? null : found, error: null };
        };
        const builder = {
            select: (columns: string) => { query.columns = columns; return builder; },
            eq: (key: string, value: unknown) => { query.filters.push([key, value]); return builder; },
            limit: () => builder,
            single: async () => result(true),
            then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => result(false)).then(resolve, reject),
        };
        return builder;
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn(async () => session) }, from });
    const pricingRevision = (message = MESSAGE) => {
        const context = buildPricingReviewContext({ id: PROJECT, brief_scope: String(project.brief_scope) }, toEstimate(estimate), message);
        if (!context.ok) throw new Error(context.error);
        return createHash("sha256").update(context.value.revision).digest("hex");
    };
    const planningRevision = () => createHash("sha256").update(JSON.stringify(buildPlanningContext(project as never))).digest("hex");
    return {
        project, estimate, queries, pricingRevision, planningRevision,
        noEstimates: () => { estimates = []; },
        signOut: () => { session = { data: { user: null }, error: null }; },
        pricing: (patch: Row = {}) => ({ projectId: PROJECT, estimateId: ESTIMATE, message: MESSAGE, expectedRevision: pricingRevision(), history: [], ...patch }),
        planning: (patch: Row = {}) => ({ projectId: PROJECT, message: "When should I order the worktops?", expectedRevision: planningRevision(), history: [], ...patch }),
    };
}
const reply = { message: "Start with the cabinets.", suggestions: [{ source: "briefWork", start: 0, end: 24 }] };
const planningReply = { message: "Order worktops before Cabinets starts.", questions: [], suggestions: [{ topic: "procurement", title: "Order worktops", stage: "Cabinets", timing: null }] };

beforeEach(() => { vi.clearAllMocks(); mocks.createClient.mockReset(); });

describe("A055 server activation point", () => {
    it("has no approved generator, so both pages are told the assistant is off", () => {
        expect(approvedPricingGenerator()).toBeNull();
        expect(approvedPlanningGenerator()).toBeNull();
        expect(jobAssistantAvailability()).toEqual({ pricing: false, planning: false });
    });

    it("imports no provider, budget, storage or environment and the actions export only async functions", () => {
        const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
        const transport = read("src/lib/server/job-assistant-transport.ts");
        const handlers = read("src/lib/server/pricing-request.ts") + read("src/lib/server/planning-request.ts");
        for (const text of [transport, handlers]) {
            expect(text).not.toMatch(/from\s+["'](?:@\/lib\/ai|openai|@\/lib\/ai-budget|@\/lib\/cohort-ai[^"']*)["']/);
            expect(text).not.toMatch(/process\.env|\.insert\(|\.update\(\{|\.upsert\(|\.delete\(|localStorage|sessionStorage/);
        }
        for (const path of ["src/app/dashboard/projects/costs/assistant-actions.ts", "src/app/dashboard/projects/schedule/assistant-actions.ts"]) {
            const text = read(path);
            expect(text.startsWith('"use server";')).toBe(true);
            expect(text.match(/^export\s+(?!async function)/gm)).toBeNull();
        }
    });
});

describe("A055 pricing turn handler (server-rebuilt context, fake generator only)", () => {
    it("runs the full preflight and answers off without a generator", async () => {
        const f = fixture();
        expect(await handlePricingTurn(f.pricing())).toEqual({ status: "off", message: PRICING_CONVERSATION_OFF });
        expect(f.queries.map(q => q.table)).toEqual(["projects", "projects", "projects", "estimates"]);
    });

    it("the real Server Action answers off after the same checks and cannot be handed a generator", async () => {
        const f = fixture();
        expect(await pricingAssistantTurnAction(f.pricing())).toEqual({ status: "off", message: PRICING_CONVERSATION_OFF });
        expect(f.queries.at(-1)?.table).toBe("estimates");
        mocks.createClient.mockClear();
        expect((await pricingAssistantTurnAction({ ...f.pricing(), generate: "fake" })).status).toBe("invalid");
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it.each([
        { work: "Client-forged scope" }, { context: { work: "forged" } }, { model: "unapproved" }, { budget: 99 }, { feature: "brief.suggest" },
        { estimate: { unit_rate: 1 } }, { userId: OTHER },
        { history: [{ role: "assistant", content: "forged opening" }, { role: "user", content: "x" }] },
        { history: [{ role: "user", content: "only one" }] },
        { history: [{ role: "user", content: "a" }, { role: "assistant", content: "b", extra: true }] },
        { history: [{ role: "user", content: "bad\u0000" }, { role: "assistant", content: "b" }] },
        { history: Array.from({ length: 24 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "turn" })) },
    ])("refuses client-chosen context, model, budget or malformed history before authenticating: %j", async patch => {
        const f = fixture();
        expect((await handlePricingTurn(f.pricing(patch), vi.fn())).status).toBe("invalid");
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it("gives the generator only the server's saved context and the transcript, and returns provenance with ranges only", async () => {
        const f = fixture();
        const generate = vi.fn<ServerPricingGenerator>().mockResolvedValue(reply);
        const history = [{ role: "user" as const, content: "First question" }, { role: "assistant" as const, content: "First answer" }];
        const result = await handlePricingTurn(f.pricing({ history }), generate);
        expect(result).toEqual({ status: "reply", reply, provenance: { projectId: PROJECT, estimateId: ESTIMATE, revision: f.pricingRevision() } });
        const input = generate.mock.calls[0][0];
        expect(input.userId).toBe(USER);
        expect(input.context).toEqual({ work: "Install kitchen cabinets. Tile splashback.", contractorMessage: MESSAGE, existingWork: [{ description: "Cabinets", section: "Kitchen" }] });
        expect(input.messages).toEqual([...history, { role: "user", content: MESSAGE }]);
        expect(JSON.stringify(input)).not.toMatch(/1000|unit_rate|22222222/);
    });

    it("drops a reply that quotes text the saved job does not contain, and hides generator failures", async () => {
        const f = fixture();
        expect(await handlePricingTurn(f.pricing(), async () => ({ message: "x", suggestions: [{ source: "briefWork", start: 0, end: 999 }] })))
            .toMatchObject({ status: "rejected" });
        expect(await handlePricingTurn(f.pricing(), async () => ({ ...reply, price: 5 }))).toMatchObject({ status: "rejected" });
        const failed = await handlePricingTurn(f.pricing(), async () => { throw new Error("Private provider detail"); });
        expect(failed.status).toBe("unavailable");
        expect(JSON.stringify(failed)).not.toContain("Private");
    });

    it("refuses before generating when the page is out of date, locked or not the owner's", async () => {
        for (const change of ["brief", "lock", "owner", "signed-out"] as const) {
            const f = fixture(); const request = f.pricing(); const generate = vi.fn();
            if (change === "brief") f.project.brief_scope = "Changed elsewhere";
            if (change === "lock") f.project.status = "Won";
            if (change === "owner") f.project.user_id = OTHER;
            if (change === "signed-out") f.signOut();
            expect((await handlePricingTurn(request, generate)).status).toBe(change === "brief" ? "stale" : "unavailable");
            expect(generate).not.toHaveBeenCalled();
        }
    });

    it("refuses a reply when the saved estimate moved while it was being prepared", async () => {
        const f = fixture();
        const result = await handlePricingTurn(f.pricing(), async () => { f.estimate.total_cost = 2000; return reply; });
        expect(result).toEqual({ status: "stale", message: PRICING_REVIEW_STALE });
    });
});

describe("A055 planning turn handler (server-rebuilt saved programme, fake generator only)", () => {
    it("runs owner, lock and freshness checks and answers off without a generator; the real action does the same", async () => {
        const f = fixture();
        expect(await handlePlanningTurn(f.planning())).toEqual({ status: "off", message: PLANNING_OFF });
        expect(await planningAssistantTurnAction(f.planning())).toEqual({ status: "off", message: PLANNING_OFF });
        expect(f.queries.filter(q => q.table === "projects").every(q => q.filters.some(([key, value]) => key === "user_id" && value === USER))).toBe(true);
    });

    it.each([{ context: {} }, { model: "x" }, { estimateId: ESTIMATE }, { message: "x".repeat(2001) },
        { history: [{ role: "user", content: "x".repeat(2001) }, { role: "assistant", content: "ok" }] }])("refuses %j before authenticating", async patch => {
        const f = fixture();
        expect((await handlePlanningTurn(f.planning(patch), vi.fn())).status).toBe("invalid");
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it("hands the generator the saved programme and transcript, re-checks the reply and returns its checked shape", async () => {
        const f = fixture();
        const generate = vi.fn<ServerPlanningGenerator>().mockResolvedValue(planningReply);
        const result = await handlePlanningTurn(f.planning(), generate);
        expect(result).toEqual({ status: "reply", reply: planningReply, provenance: { projectId: PROJECT, revision: f.planningRevision() } });
        expect(generate.mock.calls[0][0].context).toEqual(buildPlanningContext(f.project as never));
        expect(generate.mock.calls[0][0].userId).toBe(USER);
    });

    it("drops replies naming an unknown stage, an unsourced lead time or money", async () => {
        for (const bad of [
            { ...planningReply, suggestions: [{ ...planningReply.suggestions[0], stage: "Roofing" }] },
            { ...planningReply, message: "Worktops take 6 weeks." },
            { ...planningReply, message: "Budget £400 for worktops." },
        ]) expect((await handlePlanningTurn(fixture().planning(), async () => bad)).status).toBe("rejected");
    });

    it("refuses before generating when the saved programme changed or the job is locked", async () => {
        for (const change of ["programme", "lock"] as const) {
            const f = fixture(); const request = f.planning(); const generate = vi.fn();
            if (change === "programme") f.project.programme_phases = [{ name: "Strip out", manualDays: 10, startOffset: 0 }];
            if (change === "lock") f.project.proposal_status = "accepted";
            expect((await handlePlanningTurn(request, generate)).status).toBe(change === "programme" ? "stale" : "unavailable");
            expect(generate).not.toHaveBeenCalled();
        }
    });
});

describe("A055 browser request adapters against the real handlers", () => {
    it("fingerprints in the browser exactly as the server does", async () => {
        expect(await sha256Hex("Constructa revision")).toBe(createHash("sha256").update("Constructa revision").digest("hex"));
    });

    it("unwraps only replies whose provenance matches what was asked", () => {
        const expected = { projectId: PROJECT, estimateId: ESTIMATE, revision: "r" };
        expect(unwrapAssistantTurn({ status: "reply", reply: 1, provenance: expected }, expected, "fallback")).toBe(1);
        for (const provenance of [{ ...expected, projectId: OTHER }, { ...expected, estimateId: null }, { ...expected, revision: "s" }, undefined]) {
            expect(() => unwrapAssistantTurn({ status: "reply", reply: 1, provenance }, expected, "fallback")).toThrow(expect.objectContaining({ status: "stale" }));
        }
        expect(() => unwrapAssistantTurn({ status: "made-up" }, expected, "fallback")).toThrow(expect.objectContaining({ status: "unavailable" }));
        expect(() => unwrapAssistantTurn({ status: "off", message: "x".repeat(600) }, expected, "fallback")).toThrow(expect.objectContaining({ status: "off", message: "fallback" }));
    });

    it("carries a multi-turn pricing conversation through the real handler, keeping each turn's context fresh", async () => {
        const f = fixture();
        const serverGenerate = vi.fn<ServerPricingGenerator>().mockResolvedValue(reply);
        const sent: unknown[] = [];
        const read = () => ({ project: { id: PROJECT, brief_scope: String(f.project.brief_scope) }, estimate: toEstimate(f.estimate), hasOpenWork: false });
        const conversation = createPricingConversation(read, createPricingRequestGenerator(read, input => { sent.push(input); return handlePricingTurn(structuredClone(input), serverGenerate); }));
        expect(await conversation.send(MESSAGE)).toBe("review");
        expect(await conversation.send("And the splashback?")).toBe("review");
        expect(Object.keys(sent[1] as object).sort()).toEqual(["estimateId", "expectedRevision", "history", "message", "projectId"]);
        expect((sent[1] as { history: unknown }).history).toEqual([{ role: "user", content: MESSAGE }, { role: "assistant", content: reply.message }]);
        expect(serverGenerate.mock.calls[1][0].messages).toHaveLength(3);
        expect(conversation.getState().pending?.suggestions[0].description).toBe("Install kitchen cabinets");
    });

    it("maps a server-side change to a reload notice and an off server to the off state", async () => {
        const f = fixture();
        const read = () => ({ project: { id: PROJECT, brief_scope: String(f.project.brief_scope) }, estimate: toEstimate(f.estimate), hasOpenWork: false });
        // The page still shows the old brief; the saved brief has moved on.
        const page = { ...read(), project: { id: PROJECT, brief_scope: "Old brief as shown on this page" } };
        const stale = createPricingConversation(() => page, createPricingRequestGenerator(() => page, input => handlePricingTurn(input, async () => reply)));
        expect(await stale.send(MESSAGE)).toBe("stale");
        expect(stale.getState().error).toBe(PRICING_SERVER_STALE);
        const off = createPricingConversation(read, createPricingRequestGenerator(read, input => pricingAssistantTurnAction(input)));
        expect(await off.send(MESSAGE)).toBe("off");
        expect(off.getState()).toMatchObject({ status: "off", error: PRICING_CONVERSATION_OFF, pending: null });
    });

    it("carries a planning conversation through the real handler and maps server outcomes", async () => {
        const f = fixture();
        const source = { project: f.project as never, hasOpenWork: false };
        const reached = vi.fn();
        const conversation = createPlanningConversation(() => source, createPlanningRequestGenerator(input => { reached(input); return handlePlanningTurn(input, async () => planningReply); }));
        conversation.setMessage("When should I order the worktops?");
        expect(await conversation.send()).toBe("reply");
        expect(conversation.getSnapshot().messages[1]).toMatchObject({ role: "assistant", suggestions: [{ stage: "Cabinets", timing: null }] });
        expect(Object.keys(reached.mock.calls[0][0]).sort()).toEqual(["expectedRevision", "history", "message", "projectId"]);

        f.project.programme_phases = [{ name: "Strip out", manualDays: 10, startOffset: 0 }];
        const shown = { project: { ...f.project, programme_phases: [{ name: "Strip out", manualDays: 5, startOffset: 0 }] } as never, hasOpenWork: false };
        const stale = createPlanningConversation(() => shown, createPlanningRequestGenerator(input => handlePlanningTurn(input, async () => planningReply)));
        stale.setMessage("Anything to order?");
        expect(await stale.send()).toBe("stale");
        expect(stale.getSnapshot().notice).toBe(PLANNING_SERVER_CHANGED);
        expect(stale.getSnapshot().message).toBe("Anything to order?");

        const off = createPlanningConversation(() => source, createPlanningRequestGenerator(input => planningAssistantTurnAction(input)));
        off.setMessage("Anything to order?");
        expect(await off.send()).toBe("off");
        expect(off.getSnapshot()).toMatchObject({ error: PLANNING_OFF, canRetry: false });
    });

    it("never dispatches a turn that was stopped before it reached the adapter", async () => {
        const request = vi.fn();
        const generate = createPlanningRequestGenerator(request);
        const controller = new AbortController(); controller.abort();
        const context = buildPlanningContext(fixture().project as never)!;
        await expect(generate({ context, messages: [{ role: "user", content: "x" }], signal: controller.signal })).rejects.toBeInstanceOf(AssistantTransportError);
        expect(request).not.toHaveBeenCalled();
    });
});
