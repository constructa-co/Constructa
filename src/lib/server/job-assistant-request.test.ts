import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => mocks);

import { handlePricingTurn } from "./pricing-request";
import { handlePlanningTurn } from "./planning-request";
import { approvedBriefGenerator, approvedPlanningGenerator, approvedPricingGenerator, jobAssistantAvailability, type ServerPlanningGenerator, type ServerPricingGenerator } from "./job-assistant-transport";
import { costPence, createJobAssistantGenerator, type JobAssistantTransport, type TransportRequest, type UsageLedger } from "./job-assistant-generation";
import { createOpenAIJobAssistantTransport, type ChatClient } from "./openai-job-assistant-transport";
import { createRpcUsageLedger } from "./job-assistant-ledger";
import { PLANNING_SYSTEM_PROMPT, PRICING_SYSTEM_PROMPT } from "./job-assistant-prompts";
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
        expect(jobAssistantAvailability()).toEqual({ pricing: false, planning: false, brief: false });
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
        expect((await handlePricingTurn(f.pricing(patch), vi.fn<ServerPricingGenerator>())).status).toBe("invalid");
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
        expect(JSON.stringify({ context: input.context, messages: input.messages })).not.toMatch(/1000|unit_rate|22222222/);
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
        expect((await handlePlanningTurn(f.planning(patch), vi.fn<ServerPlanningGenerator>())).status).toBe("invalid");
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

describe("A055 generation seam: reservation, transport and provenance on the real request paths", () => {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const config = (patch: Row = {}) => ({
        feature: "pricing", approval: { ref: "TEST-ONLY", approvedBy: "test", approvedAt: "2026-10-28T00:00:00Z" },
        provider: "stub", model: "stub-model", maxOutputTokens: 500, timeoutMs: 1000, maxMessages: 6, maxInputChars: 5000,
        prices: { inputPencePerMillionTokens: 100, outputPencePerMillionTokens: 400 },
        attemptPence: 2, perJobPence: 10, monthlyPence: 100, ...patch,
    });
    function ledger(patch: Partial<Record<keyof UsageLedger, (...args: never[]) => Promise<unknown>>> = {}) {
        return {
            reserve: vi.fn(async () => ({ ok: true })), settle: vi.fn(async () => {}), release: vi.fn(async () => {}),
            retain: vi.fn(async () => {}), conclude: vi.fn(async () => {}), ...patch,
        } as unknown as { [K in keyof UsageLedger]: ReturnType<typeof vi.fn> };
    }
    const stub = (send: JobAssistantTransport["send"], maxInputTokens: JobAssistantTransport["maxInputTokens"] = () => 100) => ({ send: vi.fn(send), maxInputTokens });
    const pricing = (l: ReturnType<typeof ledger>, send: JobAssistantTransport["send"], patch: Row = {}) =>
        createJobAssistantGenerator<unknown>("pricing", { config: config(patch), transport: stub(send), ledger: l as unknown as UsageLedger })!;
    const attempt = (l: ReturnType<typeof ledger>) => l.conclude.mock.calls[0]?.[0] as string;

    it("is off at every activation point and refuses a missing, unapproved or out-of-bounds configuration", () => {
        expect([approvedPricingGenerator(), approvedPlanningGenerator(), approvedBriefGenerator()]).toEqual([null, null, null]);
        expect(jobAssistantAvailability()).toEqual({ pricing: false, planning: false, brief: false });
        const l = ledger() as unknown as UsageLedger;
        const transport = stub(async () => ({ kind: "not_sent" }));
        expect(createJobAssistantGenerator("pricing", { config: config(), transport, ledger: l })).toBeTypeOf("function");
        for (const [value, t, ld] of [
            [null, transport, l], [config(), null, l], [config(), transport, null],
            [config({ approval: undefined }), transport, l], [config({ approval: { ref: " ", approvedBy: "x", approvedAt: "2026-10-28T00:00:00Z" } }), transport, l],
            [config({ feature: "planning" }), transport, l], [config({ budget: 5 }), transport, l],
            [config({ attemptPence: 11 }), transport, l], [config({ perJobPence: 101 }), transport, l],
            [config({ maxMessages: 25 }), transport, l], [config({ attemptPence: 0.5 }), transport, l],
            [config({ prices: undefined }), transport, l], [config({ prices: { inputPencePerMillionTokens: 0, outputPencePerMillionTokens: 1 } }), transport, l],
            [config(), { send: transport.send } as unknown as JobAssistantTransport, l],
        ] as const) expect(createJobAssistantGenerator("pricing", { config: value, transport: t, ledger: ld })).toBeNull();
    });

    it("reserves under server caps bound to the job and revision, calls the configured model once, settles and records the reply", async () => {
        const f = fixture(); const l = ledger();
        const generate = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        const result = await handlePricingTurn(f.pricing(), generate);
        expect(result).toEqual({ status: "reply", reply, provenance: { projectId: PROJECT, estimateId: ESTIMATE, revision: f.pricingRevision() } });
        const id = attempt(l);
        expect(id).toMatch(UUID);
        expect(l.reserve).toHaveBeenCalledWith({
            attemptId: id, feature: "pricing", userId: USER, projectId: PROJECT, revision: f.pricingRevision(),
            provider: "stub", model: "stub-model", approvalRef: "TEST-ONLY", pence: 2, caps: { perJobPence: 10, monthlyPence: 100 },
        });
        expect(l.settle).toHaveBeenCalledWith(id, 1);
        expect(l.conclude.mock.calls).toEqual([[id, "reply"]]);
        expect(l.release).not.toHaveBeenCalled(); expect(l.retain).not.toHaveBeenCalled();
    });

    it("never takes a model, budget or generator from the request", async () => {
        const f = fixture(); const l = ledger(); const send = vi.fn();
        const generate = pricing(l, send);
        for (const patch of [{ model: "big" }, { attemptPence: 1 }, { caps: {} }, { attemptId: OTHER }])
            expect((await handlePricingTurn(f.pricing(patch), generate)).status).toBe("invalid");
        expect(l.reserve).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
    });

    it("refuses before any reservation when the page's context is stale, and before sending when the bounds or reservation fail", async () => {
        const f = fixture(); const l = ledger(); const send = vi.fn();
        expect((await handlePricingTurn(f.pricing({ expectedRevision: "0".repeat(64) }), pricing(l, send))).status).toBe("stale");
        expect(l.reserve).not.toHaveBeenCalled(); expect(l.conclude).not.toHaveBeenCalled();

        const history = [{ role: "user", content: "One" }, { role: "assistant", content: "Two" }];
        expect((await handlePricingTurn(f.pricing({ history }), pricing(l, send, { maxMessages: 2 })))).toMatchObject({ status: "unavailable" });
        expect(l.reserve).not.toHaveBeenCalled();
        expect(l.conclude).not.toHaveBeenCalled();

        for (const reserve of [async () => ({ ok: false }), async () => { throw new Error("db"); }]) {
            const refused = ledger({ reserve });
            expect(await handlePricingTurn(f.pricing(), pricing(refused, send))).toMatchObject({ status: "unavailable" });
            expect(refused.conclude).not.toHaveBeenCalled();
        }
        expect(send).not.toHaveBeenCalled();
    });

    it("keeps the whole reservation when the paid outcome is unknown, and releases it only when nothing was sent", async () => {
        const f = fixture();
        const failed = ledger();
        expect(await handlePricingTurn(f.pricing(), pricing(failed, async () => { throw new Error("socket"); }))).toMatchObject({ status: "unavailable" });
        expect(failed.retain).toHaveBeenCalledWith(attempt(failed), "failed");

        const timedOut = ledger();
        const hang: JobAssistantTransport["send"] = ({ signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason)));
        expect(await handlePricingTurn(f.pricing(), pricing(timedOut, hang, { timeoutMs: 20 }))).toMatchObject({ status: "unavailable" });
        expect(timedOut.retain).toHaveBeenCalledWith(attempt(timedOut), "cancelled");

        const unreadable = ledger();
        expect(await handlePricingTurn(f.pricing(), pricing(unreadable, async () => ({ kind: "reply", raw: reply, costPence: -1 })))).toMatchObject({ status: "unavailable" });
        expect(unreadable.retain).toHaveBeenCalledWith(attempt(unreadable), "unreadable_usage");

        for (const l of [failed, timedOut, unreadable]) {
            expect(l.settle).not.toHaveBeenCalled(); expect(l.release).not.toHaveBeenCalled();
            expect(l.conclude.mock.calls).toEqual([[attempt(l), "unavailable"]]);
        }

        const notSent = ledger();
        expect(await handlePricingTurn(f.pricing(), pricing(notSent, async () => ({ kind: "not_sent" })))).toMatchObject({ status: "unavailable" });
        expect(notSent.release).toHaveBeenCalledWith(attempt(notSent));
        expect(notSent.retain).not.toHaveBeenCalled(); expect(notSent.settle).not.toHaveBeenCalled();
    });

    it("settles a paid reply it then rejects, or that the saved job overtook, and records why it was not shown", async () => {
        const f = fixture();
        const rejected = ledger();
        expect(await handlePricingTurn(f.pricing(), pricing(rejected, async () => ({ kind: "reply", raw: { ...reply, price: 5 }, costPence: 1 }))))
            .toMatchObject({ status: "rejected" });
        expect(rejected.settle).toHaveBeenCalledWith(attempt(rejected), 1);
        expect(rejected.conclude.mock.calls).toEqual([[attempt(rejected), "rejected"]]);

        const overtaken = ledger();
        const send = async () => { f.project.brief_scope = "Install kitchen cabinets. Tile splashback. Paint."; return { kind: "reply" as const, raw: reply, costPence: 1 }; };
        expect(await handlePricingTurn(f.pricing(), pricing(overtaken, send))).toMatchObject({ status: "stale" });
        expect(overtaken.settle).toHaveBeenCalledWith(attempt(overtaken), 1);
        expect(overtaken.conclude.mock.calls).toEqual([[attempt(overtaken), "stale"]]);
    });

    it("does not show a reply whose settlement or provenance could not be recorded", async () => {
        const f = fixture();
        for (const patch of [{ settle: async () => { throw new Error("db"); } }, { conclude: async () => { throw new Error("db"); } }]) {
            const l = ledger(patch);
            expect(await handlePricingTurn(f.pricing(), pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }))))
                .toMatchObject({ status: "unavailable" });
        }
    });

    it("runs the same seam on the planning request path, bound to the saved programme revision", async () => {
        const f = fixture(); const l = ledger();
        const send = vi.fn<JobAssistantTransport["send"]>(async () => ({ kind: "reply", raw: planningReply, costPence: 1 }));
        const generate = createJobAssistantGenerator<unknown>("planning", { config: config({ feature: "planning" }), transport: { send, maxInputTokens: () => 100 }, ledger: l as unknown as UsageLedger })!;
        const result = await handlePlanningTurn(f.planning(), generate);
        expect(result).toMatchObject({ status: "reply", provenance: { projectId: PROJECT, revision: f.planningRevision() } });
        expect(l.reserve).toHaveBeenCalledWith(expect.objectContaining({ feature: "planning", projectId: PROJECT, revision: f.planningRevision(), userId: USER }));
        expect(send.mock.calls[0][0]).toMatchObject({ model: "stub-model", maxOutputTokens: 500, context: buildPlanningContext(f.project as never) });
        expect(l.conclude.mock.calls).toEqual([[attempt(l), "reply"]]);
    });
});

describe("A063 planning transport, worst-case cost and usage ledger (fake SDK and fake database only)", () => {
    const prices = { inputPencePerMillionTokens: 100, outputPencePerMillionTokens: 400 };
    const config = (patch: Row = {}) => ({
        feature: "planning", approval: { ref: "TEST-ONLY", approvedBy: "test", approvedAt: "2026-10-28T00:00:00Z" },
        provider: "openai", model: "stub-model", maxOutputTokens: 500, timeoutMs: 1000, maxMessages: 6, maxInputChars: 5000,
        prices, attemptPence: 2, perJobPence: 10, monthlyPence: 100, ...patch,
    });
    const memoryLedger = () => ({
        reserve: vi.fn(async () => ({ ok: true })), settle: vi.fn(async () => {}), release: vi.fn(async () => {}),
        retain: vi.fn(async () => {}), conclude: vi.fn<(id: string, outcome: string) => Promise<void>>(async () => {}),
    });
    const completion = (patch: Row = {}) => ({
        model: "stub-model-2026-01-01", usage: { prompt_tokens: 1000, completion_tokens: 200 },
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(planningReply) } }], ...patch,
    });
    function fakeSdk(answer: () => Promise<unknown>) {
        const create = vi.fn<(body: Record<string, unknown>, options: Record<string, unknown>) => Promise<unknown>>(() => answer());
        const factory = vi.fn(() => ({ chat: { completions: { create } } }) as unknown as ChatClient);
        return { create, factory };
    }
    /** A stand-in for the job_assistant_* functions: records calls and answers like the SQL. */
    function fakeDatabase(reserveStatus = "reserved") {
        const calls: [string, Record<string, unknown>][] = [];
        const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
            calls.push([fn, args]);
            return { data: fn === "job_assistant_reserve" ? { status: reserveStatus } : true, error: null };
        });
        return { calls, rpc, client: vi.fn(() => ({ rpc })) };
    }
    const request = (patch: Partial<TransportRequest> = {}): TransportRequest => ({
        provider: "openai", model: "stub-model", maxOutputTokens: 500, prices,
        context: { job: { id: PROJECT } }, messages: [{ role: "user", content: "When should I order the worktops?" }],
        signal: new AbortController().signal, ...patch,
    });

    it("refuses before reserving when this request's worst-case cost at the approved prices exceeds the reservation", async () => {
        const f = fixture();
        for (const maxInputTokens of [() => 10_000_000, () => { throw new Error("unknown"); }, () => Number.NaN]) {
            const l = memoryLedger(); const send = vi.fn();
            const generate = createJobAssistantGenerator<unknown>("planning", { config: config(), transport: { send, maxInputTokens }, ledger: l as unknown as UsageLedger })!;
            expect(await handlePlanningTurn(f.planning(), generate)).toMatchObject({ status: "unavailable" });
            expect(l.reserve).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
            expect(l.conclude).not.toHaveBeenCalled();
        }
        expect(costPence(prices, 1000, 200)).toBe(1);
        expect(costPence(prices, 10_000, 5_000)).toBe(3);
    });

    it("records a reported cost above the reservation as charged and refuses the reply", async () => {
        const f = fixture(); const l = memoryLedger();
        const generate = createJobAssistantGenerator<unknown>("planning", { config: config(), ledger: l as unknown as UsageLedger,
            transport: { maxInputTokens: () => 100, send: async () => ({ kind: "reply", raw: planningReply, costPence: 5 }) } })!;
        expect(await handlePlanningTurn(f.planning(), generate)).toMatchObject({ status: "unavailable" });
        const id = l.conclude.mock.calls[0][0];
        expect(l.settle).toHaveBeenCalledWith(id, 5);
        expect(l.retain).not.toHaveBeenCalled(); expect(l.release).not.toHaveBeenCalled();
        expect(l.conclude.mock.calls).toEqual([[id, "unavailable"]]);
    });

    it("makes no SDK client until a send, and refuses before any client for another provider or a cancelled request", async () => {
        const sdk = fakeSdk(async () => completion());
        const transport = createOpenAIJobAssistantTransport({ systemPrompt: PLANNING_SYSTEM_PROMPT, client: sdk.factory });
        expect(transport.maxInputTokens(request())).toBeGreaterThan(0);
        const cancelled = new AbortController(); cancelled.abort();
        expect(await transport.send(request({ provider: "anthropic" }))).toEqual({ kind: "not_sent" });
        expect(await transport.send(request({ signal: cancelled.signal }))).toEqual({ kind: "not_sent" });
        expect(sdk.factory).not.toHaveBeenCalled();
    });

    it("sends the planning rules, the saved context as data and the conversation once, and maps usage to approved-price pence", async () => {
        const sdk = fakeSdk(async () => completion());
        const transport = createOpenAIJobAssistantTransport({ systemPrompt: PLANNING_SYSTEM_PROMPT, client: sdk.factory });
        const sent = request({ messages: [{ role: "user", content: "One" }, { role: "assistant", content: "Two" }, { role: "user", content: "Three £" }] });
        expect(await transport.send(sent)).toEqual({ kind: "reply", raw: planningReply, costPence: 1 });
        expect(sdk.create).toHaveBeenCalledTimes(1);
        const [body, options] = sdk.create.mock.calls[0];
        expect(body).toEqual({
            model: "stub-model", max_completion_tokens: 500, response_format: { type: "json_object" },
            messages: [
                { role: "system", content: PLANNING_SYSTEM_PROMPT },
                { role: "user", content: `Saved job data (JSON):\n${JSON.stringify(sent.context)}` },
                { role: "user", content: "One" }, { role: "assistant", content: "Two" }, { role: "user", content: "Three £" },
            ],
        });
        expect(options).toEqual({ signal: sent.signal, maxRetries: 0 });
        const bytes = (body.messages as { content: string }[]).reduce((total, item) => total + Buffer.byteLength(item.content, "utf8"), 0);
        expect(transport.maxInputTokens(sent)).toBeGreaterThanOrEqual(bytes);
        expect(PLANNING_SYSTEM_PROMPT).toMatch(/Never invent a stage, date, duration, lead time, quantity, price, rate or amount of money/);
    });

    it("maps unusable replies to a rejected null and unknown usage to an unreadable cost, and lets SDK failures through", async () => {
        const send = async (answer: Row) => createOpenAIJobAssistantTransport({ systemPrompt: "rules", client: fakeSdk(async () => completion(answer)).factory }).send(request());
        expect(await send({ choices: [{ finish_reason: "length", message: { content: JSON.stringify(planningReply) } }] })).toEqual({ kind: "reply", raw: null, costPence: 1 });
        expect(await send({ choices: [{ finish_reason: "stop", message: { content: "not json" } }] })).toEqual({ kind: "reply", raw: null, costPence: 1 });
        for (const answer of [{ usage: undefined }, { usage: { prompt_tokens: 10 } }, { model: "other-model" }, { model: "stub-modelx" }])
            expect((await send(answer)) as { costPence: number }).toMatchObject({ kind: "reply", costPence: Number.NaN });
        const failing = createOpenAIJobAssistantTransport({ systemPrompt: "rules", client: fakeSdk(async () => { throw new Error("socket"); }).factory });
        await expect(failing.send(request())).rejects.toThrow("socket");
    });

    it("maps the ledger to the database functions, refuses any non-reserved answer, and fails closed on any unrecorded step", async () => {
        const db = fakeDatabase();
        const ledger = createRpcUsageLedger(db.client);
        expect(db.client).not.toHaveBeenCalled();
        const reservation = { attemptId: OTHER, feature: "planning" as const, userId: USER, projectId: PROJECT, revision: "a".repeat(64),
            provider: "openai", model: "stub-model", approvalRef: "TEST-ONLY", pence: 2, caps: { perJobPence: 10, monthlyPence: 100 } };
        expect(await ledger.reserve(reservation)).toEqual({ ok: true });
        await ledger.settle(OTHER, 1); await ledger.release(OTHER); await ledger.retain(OTHER, "failed"); await ledger.conclude(OTHER, "reply");
        expect(db.calls).toEqual([
            ["job_assistant_reserve", { p_attempt_id: OTHER, p_user_id: USER, p_project_id: PROJECT, p_feature: "planning", p_revision: "a".repeat(64),
                p_provider: "openai", p_model: "stub-model", p_approval_ref: "TEST-ONLY", p_pence: 2, p_per_job_cap_pence: 10, p_monthly_cap_pence: 100 }],
            ["job_assistant_settle", { p_attempt_id: OTHER, p_charged_pence: 1 }],
            ["job_assistant_release", { p_attempt_id: OTHER }],
            ["job_assistant_retain", { p_attempt_id: OTHER, p_reason: "failed" }],
            ["job_assistant_conclude", { p_attempt_id: OTHER, p_outcome: "reply" }],
        ]);
        for (const status of ["disabled", "duplicate", "not-owner", "over-ceiling", "job-cap", "monthly-cap"])
            expect(await createRpcUsageLedger(fakeDatabase(status).client).reserve(reservation)).toEqual({ ok: false });
        const broken = (data: unknown, error: unknown = null) => createRpcUsageLedger(() => ({ rpc: async () => ({ data, error }) }));
        await expect(broken(null, { message: "down" }).reserve(reservation)).rejects.toThrow();
        for (const [data, error] of [[false, null], [null, null], [true, { message: "down" }], ["true", null]] as const) {
            await expect(broken(data, error).settle(OTHER, 1)).rejects.toThrow();
            await expect(broken(data, error).conclude(OTHER, "reply")).rejects.toThrow();
        }
    });

    it("runs a planning turn end to end through the real transport and ledger adapters, and never sends a duplicate attempt", async () => {
        const f = fixture(); const db = fakeDatabase(); const sdk = fakeSdk(async () => completion());
        const generate = createJobAssistantGenerator<unknown>("planning", { config: config(),
            transport: createOpenAIJobAssistantTransport({ systemPrompt: PLANNING_SYSTEM_PROMPT, client: sdk.factory }), ledger: createRpcUsageLedger(db.client) })!;
        const result = await handlePlanningTurn(f.planning(), generate);
        expect(result).toMatchObject({ status: "reply", provenance: { projectId: PROJECT, revision: f.planningRevision() } });
        expect(db.calls.map(([fn]) => fn)).toEqual(["job_assistant_reserve", "job_assistant_settle", "job_assistant_conclude"]);
        const id = db.calls[0][1].p_attempt_id;
        expect(db.calls[0][1]).toMatchObject({ p_feature: "planning", p_project_id: PROJECT, p_user_id: USER, p_revision: f.planningRevision(), p_pence: 2 });
        expect(db.calls.slice(1).map(([, args]) => args)).toEqual([{ p_attempt_id: id, p_charged_pence: 1 }, { p_attempt_id: id, p_outcome: "reply" }]);
        const data = (sdk.create.mock.calls[0][0].messages as { content: string }[])[1].content;
        expect(data).toBe(`Saved job data (JSON):\n${JSON.stringify(buildPlanningContext(f.project as never))}`);

        const duplicate = fakeDatabase("duplicate"); const quiet = fakeSdk(async () => completion());
        const again = createJobAssistantGenerator<unknown>("planning", { config: config(),
            transport: createOpenAIJobAssistantTransport({ systemPrompt: PLANNING_SYSTEM_PROMPT, client: quiet.factory }), ledger: createRpcUsageLedger(duplicate.client) })!;
        expect(await handlePlanningTurn(f.planning(), again)).toMatchObject({ status: "unavailable" });
        expect(quiet.factory).not.toHaveBeenCalled();
        expect(duplicate.calls.map(([fn]) => fn)).toEqual(["job_assistant_reserve"]);
    });

    it("keeps every feature OFF: approved configuration is null while all three transports are wired", () => {
        expect(approvedPlanningGenerator()).toBeNull();
        expect(jobAssistantAvailability()).toEqual({ pricing: false, planning: false, brief: false });
        const source = readFileSync(join(process.cwd(), "src/lib/server/job-assistant-transport.ts"), "utf8");
        expect(source).toMatch(/const APPROVED_GENERATION: Record<JobAssistantFeature, unknown> = \{ pricing: null, planning: null, brief: null \};/);
        expect(source).toMatch(/FEATURE_PROMPTS/);
        for (const prompt of ["PRICING_SYSTEM_PROMPT", "PLANNING_SYSTEM_PROMPT", "BRIEF_SYSTEM_PROMPT"]) expect(source).toContain(prompt);
        expect(source).toMatch(/createOpenAIJobAssistantTransport\(\{ systemPrompt \}\)/);
        expect(source).toMatch(/return createRpcUsageLedger\(\);/);
        expect(source).not.toMatch(/process\.env|gpt-|OPENAI_API_KEY/);
    });

    it("the source ledger migration is disabled, service-role only, stores no text, and caps all features together (static source check, not Postgres)", () => {
        const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261028233000_job_assistant_usage_ledger.sql"), "utf8");
        const code = sql.replace(/--.*$/gm, "");
        expect(code).toMatch(/enabled boolean NOT NULL DEFAULT false/);
        expect(code).toMatch(/INSERT INTO public\.job_assistant_usage_settings \(id, enabled\) VALUES \(1, false\);/);
        expect(code).not.toMatch(/enabled\s*=\s*true|VALUES \(1, true/i);
        expect(code.indexOf("'job_assistant:global'")).toBeLessThan(code.indexOf("'job_assistant:project:'"));
        expect(code.indexOf("'duplicate'")).toBeLessThan(code.indexOf("INSERT INTO public.job_assistant_attempts"));
        expect(code).toMatch(/FROM public\.job_assistant_attempts WHERE project_id = p_project_id;/);
        expect(code).toMatch(/FROM public\.job_assistant_attempts\s+WHERE created_at >= date_trunc\('month'/);
        expect(code).not.toMatch(/WHERE[^;]*feature = p_feature/);
        expect(code).toMatch(/WHEN 'released' THEN 0 WHEN 'settled' THEN p_charged ELSE p_reserved END/);
        expect(code).toMatch(/ENABLE ROW LEVEL SECURITY;[\s\S]*job_assistant_attempts ENABLE ROW LEVEL SECURITY;/);
        expect(code).toMatch(/REVOKE ALL PRIVILEGES ON TABLE public\.job_assistant_usage_settings, public\.job_assistant_attempts FROM PUBLIC, anon, authenticated;/);
        expect(code).not.toMatch(/TO (anon|authenticated|PUBLIC)\b/);
        expect(code).not.toMatch(/CREATE POLICY|SECURITY DEFINER/i);
        expect(code).not.toMatch(/\b(prompt|reply_text|response|content|api_key|secret)\b/i);
        for (const fn of ["job_assistant_reserve", "job_assistant_settle", "job_assistant_release", "job_assistant_retain", "job_assistant_conclude"]) {
            expect(code).toMatch(new RegExp(`CREATE FUNCTION public\\.${fn}\\(`));
            expect(code).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${fn}\\([^)]*\\) TO service_role;`));
        }
        for (const step of ["settle", "release", "retain"]) expect(code).toMatch(new RegExp(`job_assistant_${step}[\\s\\S]*?WHERE id = p_attempt_id AND state = 'reserved';`));
    });
});

describe("A055 confirmed reservation: conclude only this generator's holds", () => {
    const ATTEMPT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const config = (patch: Row = {}) => ({
        feature: "pricing", approval: { ref: "TEST-ONLY", approvedBy: "test", approvedAt: "2026-10-28T00:00:00Z" },
        provider: "stub", model: "stub-model", maxOutputTokens: 500, timeoutMs: 1000, maxMessages: 6, maxInputChars: 5000,
        prices: { inputPencePerMillionTokens: 100, outputPencePerMillionTokens: 400 },
        attemptPence: 2, perJobPence: 10, monthlyPence: 100, ...patch,
    });
    function ledger(patch: Partial<Record<keyof UsageLedger, (...args: never[]) => Promise<unknown>>> = {}) {
        return {
            reserve: vi.fn(async () => ({ ok: true })), settle: vi.fn(async () => {}), release: vi.fn(async () => {}),
            retain: vi.fn(async () => {}), conclude: vi.fn(async () => {}), ...patch,
        } as unknown as { [K in keyof UsageLedger]: ReturnType<typeof vi.fn> };
    }
    const stub = (send: JobAssistantTransport["send"], maxInputTokens: JobAssistantTransport["maxInputTokens"] = () => 100) => ({ send: vi.fn(send), maxInputTokens });
    const pricing = (l: ReturnType<typeof ledger>, send: JobAssistantTransport["send"], patch: Row = {}) =>
        createJobAssistantGenerator<unknown>("pricing", { config: config(patch), transport: stub(send), ledger: l as unknown as UsageLedger })!;
    const turnInput = () => ({
        userId: USER, projectId: PROJECT, revision: "a".repeat(64), attemptId: ATTEMPT,
        context: { work: "Install kitchen cabinets.", contractorMessage: "Help", existingWork: [] },
        messages: [{ role: "user" as const, content: "Organise pricing" }], signal: new AbortController().signal,
    });

    it("does not call ledger.conclude before a hold exists: bounds, cost cap, or refused reservation", async () => {
        const l = ledger();
        const bounds = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }), { maxMessages: 1 });
        await expect(bounds({
            ...turnInput(),
            messages: [{ role: "user", content: "One" }, { role: "user", content: "Two" }],
        })).rejects.toMatchObject({ reason: "bounds" });
        expect(l.reserve).not.toHaveBeenCalled();
        expect(await bounds.conclude!(ATTEMPT, "unavailable")).toBe(false);
        expect(await bounds.conclude!(ATTEMPT, "reply")).toBe(false);
        expect(l.conclude).not.toHaveBeenCalled();

        const expensive = ledger();
        const overCap = createJobAssistantGenerator<unknown>("pricing", {
            config: config({ attemptPence: 1 }), transport: { send: vi.fn(), maxInputTokens: () => 10_000_000 }, ledger: expensive as unknown as UsageLedger,
        })!;
        await expect(overCap(turnInput())).rejects.toMatchObject({ reason: "cost" });
        expect(expensive.reserve).not.toHaveBeenCalled();
        expect(await overCap.conclude!(ATTEMPT, "unavailable")).toBe(false);
        expect(expensive.conclude).not.toHaveBeenCalled();

        const refused = ledger({ reserve: vi.fn(async () => ({ ok: false })) });
        const blocked = pricing(refused, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        await expect(blocked(turnInput())).rejects.toMatchObject({ reason: "reservation" });
        expect(await blocked.conclude!(ATTEMPT, "unavailable")).toBe(false);
        expect(refused.conclude).not.toHaveBeenCalled();
    });

    it("returns false without RPC for unknown, repeated, or foreign conclude after eligibility is consumed", async () => {
        const l = ledger();
        const generate = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        expect(await generate.conclude!("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "reply")).toBe(false);
        expect(l.conclude).not.toHaveBeenCalled();
        await generate(turnInput());
        expect(await generate.conclude!(ATTEMPT, "reply")).toBe(true);
        expect(l.conclude).toHaveBeenCalledTimes(1);
        expect(await generate.conclude!(ATTEMPT, "reply")).toBe(false);
        expect(l.conclude).toHaveBeenCalledTimes(1);
        expect(await generate.conclude!(ATTEMPT, "unavailable")).toBe(false);
        expect(l.conclude).toHaveBeenCalledTimes(1);
    });

    it("allows only one ledger.conclude RPC when two conclude calls run concurrently for the same owned attempt", async () => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const l = ledger({ conclude: vi.fn(async () => { await gate; }) });
        const generate = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        await generate(turnInput());
        const first = generate.conclude!(ATTEMPT, "reply");
        const second = generate.conclude!(ATTEMPT, "stale");
        release();
        const results = await Promise.all([first, second]);
        expect(results.sort()).toEqual([false, true]);
        expect(l.conclude).toHaveBeenCalledTimes(1);
    });

    it("does not retry conclude after a ledger failure; a second call stays false with no extra RPC", async () => {
        const l = ledger({ conclude: vi.fn(async () => { throw new Error("db"); }) });
        const generate = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        await generate(turnInput());
        expect(await generate.conclude!(ATTEMPT, "reply")).toBe(false);
        expect(l.conclude).toHaveBeenCalledTimes(1);
        expect(await generate.conclude!(ATTEMPT, "reply")).toBe(false);
        expect(l.conclude).toHaveBeenCalledTimes(1);
    });

    it("two generators share one ledger: a duplicate reserve must not conclude the first settled attempt", async () => {
        const l = ledger({ reserve: vi.fn()
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce({ ok: false }) });
        const first = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        const second = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        const input = turnInput();
        await first(input);
        expect(l.settle).toHaveBeenCalledWith(ATTEMPT, 1);
        expect(l.conclude).not.toHaveBeenCalled();
        await expect(second(input)).rejects.toMatchObject({ reason: "reservation" });
        expect(await second.conclude!(ATTEMPT, "unavailable")).toBe(false);
        expect(l.conclude).not.toHaveBeenCalled();
        expect(await first.conclude!(ATTEMPT, "reply")).toBe(true);
        expect(l.conclude).toHaveBeenCalledTimes(1);
        expect(l.conclude).toHaveBeenCalledWith(ATTEMPT, "reply");
    });

    it("returns false from conclude when the ledger step fails, so the handler does not accept the reply", async () => {
        const f = fixture();
        const l = ledger({ conclude: vi.fn(async () => { throw new Error("db"); }) });
        const generate = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        expect(await handlePricingTurn(f.pricing(), generate)).toMatchObject({ status: "unavailable" });
        expect(l.settle).toHaveBeenCalledTimes(1);
        expect(l.conclude).toHaveBeenCalledTimes(1);
    });

    it("concludes separate attempt ids independently without cross-talk", async () => {
        const l = ledger();
        const generate = pricing(l, async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
        const first = { ...turnInput(), attemptId: ATTEMPT };
        const second = { ...turnInput(), attemptId: other };
        await generate(first);
        await generate(second);
        expect(await generate.conclude!(other, "rejected")).toBe(true);
        expect(l.conclude).toHaveBeenCalledWith(other, "rejected");
        expect(await generate.conclude!(ATTEMPT, "reply")).toBe(true);
        expect(l.conclude).toHaveBeenLastCalledWith(ATTEMPT, "reply");
        expect(l.conclude).toHaveBeenCalledTimes(2);
    });
});

describe("A055 pricing OpenAI transport wiring (fake SDK only)", () => {
    const prices = { inputPencePerMillionTokens: 100, outputPencePerMillionTokens: 400 };
    const pricingModelReply = { message: "Start with the cabinets.", suggestions: [{ source: "briefWork", start: 0, end: 24 }] };
    function fakeSdk(answer: () => Promise<unknown>) {
        const create = vi.fn(() => answer());
        const factory = vi.fn(() => ({ chat: { completions: { create } } }) as unknown as ChatClient);
        return { create, factory };
    }
    const transportRequest = (patch: Partial<TransportRequest> = {}): TransportRequest => ({
        provider: "openai", model: "stub-model", maxOutputTokens: 500, prices,
        context: { work: "Install kitchen cabinets. Tile splashback.", contractorMessage: "Help me organise this.", existingWork: [{ description: "Cabinets", section: "Kitchen" }] },
        messages: [{ role: "user", content: "Where should I start?" }], signal: new AbortController().signal, ...patch,
    });

    it("SOURCE: job-assistant-transport maps pricing to PRICING_SYSTEM_PROMPT through the shared adapter", () => {
        const source = readFileSync(join(process.cwd(), "src/lib/server/job-assistant-transport.ts"), "utf8");
        expect(source).toMatch(/pricing: PRICING_SYSTEM_PROMPT/);
        expect(PRICING_SYSTEM_PROMPT).toMatch(/briefWork.*contractorMessage/);
        expect(PRICING_SYSTEM_PROMPT).toMatch(/Never invent a rate, price, amount/);
    });

    it("sends pricing rules, saved context as data and maps strict JSON for reviewPricingSuggestion", async () => {
        const sdk = fakeSdk(async () => ({
            model: "stub-model-2026-01-01", usage: { prompt_tokens: 800, completion_tokens: 120 },
            choices: [{ finish_reason: "stop", message: { content: JSON.stringify(pricingModelReply) } }],
        }));
        const transport = createOpenAIJobAssistantTransport({ systemPrompt: PRICING_SYSTEM_PROMPT, client: sdk.factory });
        const sent = transportRequest();
        expect(await transport.send(sent)).toEqual({ kind: "reply", raw: pricingModelReply, costPence: costPence(prices, 800, 120) });
        expect(sdk.create).toHaveBeenCalledTimes(1);
        const body = (sdk.create.mock.calls as unknown as [[Record<string, unknown>, unknown]])[0][0];
        expect(body).toEqual({
            model: "stub-model", max_completion_tokens: 500, response_format: { type: "json_object" },
            messages: [
                { role: "system", content: PRICING_SYSTEM_PROMPT },
                { role: "user", content: `Saved job data (JSON):\n${JSON.stringify(sent.context)}` },
                { role: "user", content: "Where should I start?" },
            ],
        });
    });
});
