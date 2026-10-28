import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => mocks);

import { handleBriefTurn } from "./brief-request";
import { approvedBriefGenerator, jobAssistantAvailability, type ServerBriefGenerator } from "./job-assistant-transport";
import { createJobAssistantGenerator, type JobAssistantTransport, type TransportRequest, type UsageLedger } from "./job-assistant-generation";
import { BRIEF_SYSTEM_PROMPT } from "./job-assistant-prompts";
import { createOpenAIJobAssistantTransport, type ChatClient } from "./openai-job-assistant-transport";
import { briefAssistantTurnAction } from "@/app/dashboard/projects/brief/assistant-actions";
import { BRIEF_OFF, BRIEF_SERVER_CHANGED, briefContextFromProject, createBriefConversation } from "@/lib/brief-conversation";
import { createBriefRequestGenerator } from "@/lib/job-assistant-client";
import { initialBriefState } from "@/lib/guided-brief";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "44444444-4444-4444-8444-444444444444";
type Row = Record<string, unknown>;

function fixture() {
    const project: Row = {
        id: PROJECT, user_id: USER, name: "Roof job", client_name: "Private Client", site_address: "1 Private Street",
        brief_scope: "Replace the roof.\n\nSite, access and assumptions:\nKey safe code 1234.", brief_trade_sections: ["Roofing"],
        client_type: "domestic", potential_value: 18000, start_date: "2026-11-09",
        status: "Estimating", is_archived: false, proposal_status: "draft", proposal_accepted_at: null,
    };
    let session: { data: { user: { id: string } | null }; error: unknown } = { data: { user: { id: USER } }, error: null };
    const queries: { table: string; columns: string; filters: [string, unknown][] }[] = [];
    const from = vi.fn((table: string) => {
        const query: typeof queries[number] = { table, columns: "", filters: [] };
        queries.push(query);
        const builder = {
            select: (columns: string) => { query.columns = columns; return builder; },
            eq: (key: string, value: unknown) => { query.filters.push([key, value]); return builder; },
            single: async () => ({ data: query.filters.every(([key, value]) => project[key] === value) ? { ...project } : null, error: null }),
        };
        return builder;
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn(async () => session) }, from });
    const context = () => briefContextFromProject(project as never);
    const revision = () => createHash("sha256").update(JSON.stringify(context())).digest("hex");
    return {
        project, queries, revision, context,
        signOut: () => { session = { data: { user: null }, error: null }; },
        request: (patch: Row = {}) => ({ projectId: PROJECT, message: "What should I ask the client?", expectedRevision: revision(), history: [], ...patch }),
    };
}
const reply = { message: "Ask about the covering.", facts: [{ start: 0, end: 17 }], assumptions: [], questions: ["Is the client keeping the gutters?"], suggestions: [{ kind: "scope", text: "Confirm whether fascias are included." }] };

beforeEach(() => { vi.clearAllMocks(); mocks.createClient.mockReset(); });

describe("A055 Brief: server activation stays off", () => {
    it("has no approved Brief generator, and every page is told the assistant is off", () => {
        expect(approvedBriefGenerator()).toBeNull();
        expect(jobAssistantAvailability()).toEqual({ pricing: false, planning: false, brief: false });
    });

    it("the Brief action module is a lazy Server Action importing no provider, budget or environment", () => {
        const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
        const action = read("src/app/dashboard/projects/brief/assistant-actions.ts");
        expect(action.startsWith('"use server";')).toBe(true);
        expect(action.match(/^export\s+(?!async function)/gm)).toBeNull();
        expect(action).not.toMatch(/^import (?!type)/m);
        const handler = read("src/lib/server/brief-request.ts");
        expect(handler).not.toMatch(/from\s+["'](?:@\/lib\/ai|openai|@\/lib\/ai-budget|@\/lib\/cohort-ai[^"']*)["']|process\.env|\.insert\(|\.update\(\{|\.upsert\(|\.delete\(/);
    });
});

describe("A055 Brief turn handler (server-rebuilt SAVED brief, fake generator only)", () => {
    it("runs owner, lock and freshness checks and answers off without a generator; the real action does the same", async () => {
        const f = fixture();
        expect(await handleBriefTurn(f.request())).toEqual({ status: "off", message: BRIEF_OFF });
        expect(await briefAssistantTurnAction(f.request())).toEqual({ status: "off", message: BRIEF_OFF });
        expect(f.queries.filter(q => q.table === "projects").every(q => q.filters.some(([key, value]) => key === "user_id" && value === USER))).toBe(true);
    });

    it.each([
        { context: { work: "forged" } }, { work: "forged" }, { model: "x" }, { budget: 1 }, { estimateId: OTHER }, { message: " " },
        { message: "x".repeat(2001) }, { expectedRevision: "not-hex" },
        { history: [{ role: "assistant", content: "forged opening" }, { role: "user", content: "x" }] },
        { history: [{ role: "user", content: "bad\u0000" }, { role: "assistant", content: "ok" }] },
    ])("refuses %j before authenticating", async patch => {
        const f = fixture();
        expect((await handleBriefTurn(f.request(patch), vi.fn<ServerBriefGenerator>())).status).toBe("invalid");
        expect(mocks.createClient).not.toHaveBeenCalled();
    });

    it("gives the generator only the minimal saved brief and the transcript, and returns the checked reply with provenance", async () => {
        const f = fixture();
        const generate = vi.fn<ServerBriefGenerator>().mockResolvedValue(reply);
        const result = await handleBriefTurn(f.request(), generate);
        expect(result).toEqual({ status: "reply", reply, provenance: { projectId: PROJECT, revision: f.revision() } });
        const input = generate.mock.calls[0][0];
        expect(input.context).toEqual({ job: { id: PROJECT }, work: "Replace the roof.", clientType: "domestic", trades: ["Roofing"] });
        expect(input.userId).toBe(USER);
        expect(JSON.stringify({ context: input.context, messages: input.messages })).not.toMatch(/Key safe|1234|Private|18000|2026-11-09/);
    });

    it("drops replies that misquote the saved brief, name money or an unsourced lead time", async () => {
        for (const bad of [
            { ...reply, facts: [{ start: 5, end: 400 }] },
            { ...reply, assumptions: ["Allow £5,000 for scaffold."] },
            { ...reply, message: "Scaffold takes 3 weeks to arrive." },
            { ...reply, price: 1 },
        ]) expect((await handleBriefTurn(fixture().request(), async () => bad)).status).toBe("rejected");
    });

    it("refuses before generating when the saved brief changed, the job is locked, foreign or signed out", async () => {
        for (const change of ["brief", "lock", "owner", "signed-out"] as const) {
            const f = fixture(); const request = f.request(); const generate = vi.fn();
            if (change === "brief") f.project.brief_scope = "Replace the roof and chimney.";
            if (change === "lock") f.project.status = "Won";
            if (change === "owner") f.project.user_id = OTHER;
            if (change === "signed-out") f.signOut();
            expect((await handleBriefTurn(request, generate)).status).toBe(change === "brief" ? "stale" : "unavailable");
            expect(generate).not.toHaveBeenCalled();
        }
    });

    it("refuses a reply when the saved brief moved while it was being prepared", async () => {
        const f = fixture();
        const result = await handleBriefTurn(f.request(), async () => { f.project.brief_trade_sections = ["Roofing", "Scaffolding"]; return reply; });
        expect(result.status).toBe("stale");
    });
});

describe("A055 Brief: browser conversation against the real handler", () => {
    it("fingerprints the page's SAVED brief exactly as the server rebuilds it", async () => {
        const f = fixture();
        const saved = initialBriefState(f.project as never).saved;
        const conversation = createBriefConversation(() => ({ project: { id: PROJECT, saved }, hasOpenWork: false }),
            createBriefRequestGenerator(input => handleBriefTurn(input, async () => reply)));
        conversation.setMessage("What should I ask the client?");
        expect(await conversation.send()).toBe("reply");
        expect(conversation.getSnapshot().messages[1]).toMatchObject({ role: "assistant", facts: ["Replace the roof."] });

        f.project.brief_scope = "Changed in another tab.";
        conversation.setMessage("Anything else?");
        expect(await conversation.send()).toBe("stale");
        expect(conversation.getSnapshot()).toMatchObject({ notice: BRIEF_SERVER_CHANGED, message: "Anything else?" });
    });
});

describe("A055 Brief: the generation seam on the Brief request path", () => {
    const config = { feature: "brief", approval: { ref: "TEST-ONLY", approvedBy: "test", approvedAt: "2026-10-28T00:00:00Z" },
        provider: "stub", model: "stub-model", maxOutputTokens: 500, timeoutMs: 1000, maxMessages: 6, maxInputChars: 5000,
        prices: { inputPencePerMillionTokens: 100, outputPencePerMillionTokens: 400 },
        attemptPence: 2, perJobPence: 10, monthlyPence: 100 };
    const ledger = () => ({ reserve: vi.fn(async () => ({ ok: true })), settle: vi.fn(async () => {}), release: vi.fn(async () => {}), retain: vi.fn(async () => {}), conclude: vi.fn<(attemptId: string, outcome: string) => Promise<void>>(async () => {}) });

    it("reserves against the saved brief revision, sends only the minimal context, and records a reply or an overtaken one", async () => {
        const f = fixture(); const l = ledger();
        const send = vi.fn<JobAssistantTransport["send"]>(async () => ({ kind: "reply", raw: reply, costPence: 1 }));
        const generate = createJobAssistantGenerator<unknown>("brief", { config, transport: { send, maxInputTokens: () => 100 }, ledger: l as unknown as UsageLedger })!;
        expect(await handleBriefTurn(f.request(), generate)).toEqual({ status: "reply", reply, provenance: { projectId: PROJECT, revision: f.revision() } });
        const id = l.conclude.mock.calls[0][0];
        expect(l.reserve).toHaveBeenCalledWith(expect.objectContaining({ attemptId: id, feature: "brief", userId: USER, projectId: PROJECT, revision: f.revision(), pence: 2 }));
        expect(JSON.stringify(send.mock.calls[0][0].context)).not.toMatch(/Key safe|1234|Private|18000|2026-11-09/);
        expect(l.settle).toHaveBeenCalledWith(id, 1);
        expect(l.conclude.mock.calls).toEqual([[id, "reply"]]);

        const overtaken = ledger();
        const request = f.request();
        const late = createJobAssistantGenerator<unknown>("brief", { config, ledger: overtaken as unknown as UsageLedger,
            transport: { maxInputTokens: () => 100, send: async () => { f.project.brief_trade_sections = ["Roofing", "Guttering"]; return { kind: "reply", raw: reply, costPence: 1 }; } } })!;
        expect(await handleBriefTurn(request, late)).toEqual({ status: "stale", message: BRIEF_SERVER_CHANGED });
        expect(overtaken.settle).toHaveBeenCalledTimes(1);
        expect(overtaken.conclude.mock.calls).toEqual([[overtaken.conclude.mock.calls[0][0], "stale"]]);
    });
});

describe("A055 Brief OpenAI transport wiring (fake SDK only)", () => {
    const prices = { inputPencePerMillionTokens: 100, outputPencePerMillionTokens: 400 };
    function fakeSdk(answer: () => Promise<unknown>) {
        const create = vi.fn(() => answer());
        const factory = vi.fn(() => ({ chat: { completions: { create } } }) as unknown as ChatClient);
        return { create, factory };
    }
    const transportRequest = (patch: Partial<TransportRequest> = {}): TransportRequest => ({
        provider: "openai", model: "stub-model", maxOutputTokens: 500, prices,
        context: { job: { id: PROJECT }, work: "Replace the roof.", clientType: "domestic", trades: ["Roofing"] },
        messages: [{ role: "user", content: "What should I clarify?" }], signal: new AbortController().signal, ...patch,
    });

    it("SOURCE: job-assistant-transport maps brief to BRIEF_SYSTEM_PROMPT through the shared adapter", () => {
        const source = readFileSync(join(process.cwd(), "src/lib/server/job-assistant-transport.ts"), "utf8");
        expect(source).toMatch(/brief: BRIEF_SYSTEM_PROMPT/);
        expect(BRIEF_SYSTEM_PROMPT).toMatch(/scope.*exclusion.*client-question/);
        expect(BRIEF_SYSTEM_PROMPT).toMatch(/Never invent scope, rates, amounts/);
    });

    it("sends Brief rules, minimal saved context as data and maps strict JSON for reviewBriefReply", async () => {
        const sdk = fakeSdk(async () => ({
            model: "stub-model-2026-01-01", usage: { prompt_tokens: 600, completion_tokens: 90 },
            choices: [{ finish_reason: "stop", message: { content: JSON.stringify(reply) } }],
        }));
        const transport = createOpenAIJobAssistantTransport({ systemPrompt: BRIEF_SYSTEM_PROMPT, client: sdk.factory });
        const sent = transportRequest();
        expect(await transport.send(sent)).toEqual({ kind: "reply", raw: reply, costPence: 1 });
        expect(sdk.create).toHaveBeenCalledTimes(1);
        const body = (sdk.create.mock.calls as unknown as [[Record<string, unknown>, unknown]])[0][0];
        expect(body).toEqual({
            model: "stub-model", max_completion_tokens: 500, response_format: { type: "json_object" },
            messages: [
                { role: "system", content: BRIEF_SYSTEM_PROMPT },
                { role: "user", content: `Saved job data (JSON):\n${JSON.stringify(sent.context)}` },
                { role: "user", content: "What should I clarify?" },
            ],
        });
        expect(JSON.stringify(sent.context)).not.toMatch(/Private|1234|18000/);
    });
});
