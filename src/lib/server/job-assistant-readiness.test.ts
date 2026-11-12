import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createAdminClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));

import * as activationPoint from "./job-assistant-transport";
import { approvedBriefGenerator, approvedPlanningGenerator, approvedPricingGenerator, jobAssistantAvailable, type JobAssistantActivation } from "./job-assistant-transport";
import { createRpcUsageLedger } from "./job-assistant-ledger";
import { createOpenAIJobAssistantTransport, type ChatClient } from "./openai-job-assistant-transport";
import { handleBriefTurn } from "./brief-request";
import { handlePlanningTurn } from "./planning-request";
import { handlePricingTurn } from "./pricing-request";
import { briefAssistantTurnAction } from "@/app/dashboard/projects/brief/assistant-actions";
import { pricingAssistantTurnAction } from "@/app/dashboard/projects/costs/assistant-actions";
import { planningAssistantTurnAction } from "@/app/dashboard/projects/schedule/assistant-actions";
import { briefContextFromProject, BRIEF_OFF } from "@/lib/brief-conversation";
import { buildPlanningContext, createPlanningConversation, PLANNING_OFF } from "@/lib/planning-conversation";
import { createPricingConversation, PRICING_CONVERSATION_OFF } from "@/lib/pricing-conversation";
import { buildPricingReviewContext } from "@/lib/pricing-review";
import { createPlanningRequestGenerator, createPricingRequestGenerator } from "@/lib/job-assistant-client";
import { assistantOffLabel, explainAssistantOff, type JobAssistantOffReason } from "@/lib/job-assistant-readiness";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "Help me organise the cabinet installation.";
const QA_URL = "https://umqtzfsnyoofmgfbnrgv.supabase.co";
const READY = { enabled: true, max_attempt_pence: 2, max_per_job_pence: 10, max_monthly_pence: 100 };
const SECRET_TEXT = "permission denied for pudadynieiuypxeoimnz SUPABASE_SERVICE_ROLE_KEY sk-not-a-real-key service_role";
const planningReply = { message: "Order worktops before Cabinets starts.", questions: [], suggestions: [{ topic: "procurement", title: "Order worktops", stage: "Cabinets", timing: null }] };
type Row = Record<string, unknown>;
type Feature = "pricing" | "planning" | "brief";

/** The signed-in owner's job, answered from rows through the real access helpers. */
function ownerJob() {
    const project: Row = {
        id: PROJECT, user_id: USER, name: "Kitchen refit", client_name: "QA client", brief_scope: "Install kitchen cabinets.",
        brief_trade_sections: ["Kitchens"], client_type: "domestic", status: "Estimating", is_archived: false, proposal_status: "draft",
        proposal_accepted_at: null, start_date: "2026-11-02", programme_working_pattern: null,
        programme_phases: [{ name: "Strip out", manualDays: 5, startOffset: 0 }, { name: "Cabinets", manualDays: 5, startOffset: 7 }],
    };
    let user: { id: string } | null = { id: USER };
    const from = vi.fn((table: string) => {
        const filters: [string, unknown][] = [];
        const rows = () => table === "projects" ? [project].filter(row => filters.every(([key, value]) => row[key] === value)) : [];
        const builder = {
            select: () => builder, limit: () => builder,
            eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
            single: async () => ({ data: rows()[0] ?? null, error: null }),
            then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject),
        };
        return builder;
    });
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn(async () => ({ data: { user }, error: null })) }, from });
    const sha = (text: string) => createHash("sha256").update(text).digest("hex");
    const pricingContext = buildPricingReviewContext({ id: PROJECT, brief_scope: String(project.brief_scope) }, null, MESSAGE);
    if (!pricingContext.ok) throw new Error(pricingContext.error);
    return {
        signOut: () => { user = null; },
        pricing: () => ({ projectId: PROJECT, estimateId: null, message: MESSAGE, expectedRevision: sha(pricingContext.value.revision), history: [] }),
        planning: () => ({ projectId: PROJECT, message: "When do I order the worktops?", expectedRevision: sha(JSON.stringify(buildPlanningContext(project as never))), history: [] }),
        brief: () => ({ projectId: PROJECT, message: "What should I ask?", expectedRevision: sha(JSON.stringify(briefContextFromProject(project as never))), history: [] }),
    };
}

const approval = (feature: string, patch: Row = {}) => ({
    feature, approval: { ref: "TEST-ONLY", approvedBy: "test", approvedAt: "2026-10-29T00:00:00Z" },
    provider: "openai", model: "stub-model", maxOutputTokens: 500, timeoutMs: 1000, maxMessages: 6, maxInputChars: 5000,
    prices: { inputPencePerMillionTokens: 100, outputPencePerMillionTokens: 400 }, attemptPence: 2, perJobPence: 10, monthlyPence: 100, ...patch,
});
const allApproved = (patch: Row = {}) => ({ pricing: approval("pricing", patch), planning: approval("planning", patch), brief: approval("brief", patch) });

function fakeDatabase(settings: unknown = READY, error: unknown = null) {
    const rpc = vi.fn(async (fn: string) => ({ data: fn === "job_assistant_reserve" ? { status: "reserved" } : true, error: null }));
    const read = vi.fn(async () => ({ data: settings, error }));
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: read }) }) }));
    return { rpc, read, client: vi.fn(() => ({ rpc, from })) };
}

function setup(patch: Partial<JobAssistantActivation> = {}, db = fakeDatabase()) {
    const create = vi.fn(async () => ({
        model: "stub-model", usage: { prompt_tokens: 100, completion_tokens: 20 },
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(planningReply) } }],
    }));
    const sdk = vi.fn(() => ({ chat: { completions: { create } } }) as unknown as ChatClient);
    const provider = {
        configured: vi.fn(() => true),
        transport: vi.fn((systemPrompt: string) => createOpenAIJobAssistantTransport({ systemPrompt, client: sdk })),
    };
    const activation: JobAssistantActivation = {
        approvals: allApproved(), stopped: () => false, providers: { openai: provider }, ledger: () => createRpcUsageLedger(db.client), ...patch,
    };
    return { activation, provider, db, create, sdk };
}
type Setup = ReturnType<typeof setup>;

// Reads the activation point through the module, so a missing export fails its own assertion, not the whole file.
const readiness = (feature: Feature, owner: boolean, activation: JobAssistantActivation) =>
    activationPoint.jobAssistantReadiness(feature, { owner }, activation);

const CASES: [string, () => Setup, JobAssistantOffReason][] = [
    ["the emergency stop", () => setup({ stopped: () => true }), "emergency_stop"],
    ["no approval on this target", () => setup({ approvals: { pricing: null, planning: null, brief: null } }), "not_approved"],
    ["an approval that fails the schema", () => setup({ approvals: allApproved({ attemptPence: 11 }) }), "approval_mismatch"],
    ["features stating different monthly caps", () => setup({ approvals: { ...allApproved(), pricing: approval("pricing", { monthlyPence: 500 }), planning: approval("planning", { monthlyPence: 500 }) } }), "approval_mismatch"],
    ["a provider with no adapter", () => setup({ approvals: allApproved({ provider: "other-provider" }) }), "provider_unavailable"],
    ["the provider's key missing", () => { const s = setup(); s.provider.configured.mockReturnValue(false); return s; }, "provider_unavailable"],
    ["no settings row", () => setup({}, fakeDatabase(null)), "ledger_not_installed"],
    ["the ledger table missing (PostgREST)", () => setup({}, fakeDatabase(null, { code: "PGRST205", message: SECRET_TEXT })), "ledger_not_installed"],
    ["the ledger table missing (Postgres)", () => setup({}, fakeDatabase(null, { code: "42P01", message: SECRET_TEXT })), "ledger_not_installed"],
    ["the ledger disabled, as the migration ships", () => setup({}, fakeDatabase({ enabled: false, max_attempt_pence: null, max_per_job_pence: null, max_monthly_pence: null })), "ledger_disabled"],
    ["the ledger disabled with ceilings set", () => setup({}, fakeDatabase({ ...READY, enabled: false })), "ledger_disabled"],
    ["ceilings not set", () => setup({}, fakeDatabase({ enabled: true, max_attempt_pence: null, max_per_job_pence: null, max_monthly_pence: null })), "ledger_limits"],
    ["a ceiling below the approved monthly cap", () => setup({}, fakeDatabase({ ...READY, max_monthly_pence: 99 })), "ledger_limits"],
    ["a ceiling below the approved attempt", () => setup({}, fakeDatabase({ ...READY, max_attempt_pence: 1 })), "ledger_limits"],
    ["a failed settings read", () => setup({}, fakeDatabase(READY, { code: "42501", message: SECRET_TEXT })), "ledger_unreadable"],
    ["no service-role client", () => { const db = fakeDatabase(); db.client.mockImplementation(() => { throw new Error(SECRET_TEXT); }); return setup({}, db); }, "ledger_unreadable"],
    ["the ledger failing to construct", () => setup({ ledger: () => { throw new Error(SECRET_TEXT); } }), "check_failed"],
];
const OFF: Record<Feature, string> = { pricing: PRICING_CONVERSATION_OFF, planning: PLANNING_OFF, brief: BRIEF_OFF };

beforeEach(() => { vi.clearAllMocks(); mocks.createClient.mockReset(); mocks.createAdminClient.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("CQ-2210 readiness names the missing prerequisite on the one activation contract", () => {
    describe.each(CASES)("%s", (_name, make, reason) => {
        it("agrees across availability, generation and all three real handlers, and touches nothing", async () => {
            const f = ownerJob();
            for (const feature of ["pricing", "planning", "brief"] as const) {
                const s = make();
                expect(await readiness(feature, true, s.activation)).toEqual({ available: false, offReason: reason });
                expect(await jobAssistantAvailable(feature, s.activation)).toBe(false);
                const generator = { pricing: approvedPricingGenerator, planning: approvedPlanningGenerator, brief: approvedBriefGenerator }[feature];
                // A prerequisite that throws rejects here, as it did; the handler's source turns that into off below.
                expect(await generator(s.activation).catch(() => null)).toBeNull();
                const source = activationPoint.jobAssistantTurnSource(feature, s.activation);
                const result = feature === "pricing" ? await handlePricingTurn(f.pricing(), source as never)
                    : feature === "planning" ? await handlePlanningTurn(f.planning(), source as never)
                        : await handleBriefTurn(f.brief(), source as never);
                expect(result).toEqual({ status: "off", message: explainAssistantOff(OFF[feature], reason) });
                expect(s.db.rpc).not.toHaveBeenCalled(); expect(s.provider.transport).not.toHaveBeenCalled();
                expect(s.sdk).not.toHaveBeenCalled(); expect(s.create).not.toHaveBeenCalled();
                expect(JSON.stringify(result)).not.toMatch(/pudadynieiuypxeoimnz|SERVICE_ROLE|service_role|sk-not|permission denied|PGRST|42P01|42501/);
            }
        });
    });

    it("with every prerequisite met, each feature is offered and a turn source runs one recorded attempt", async () => {
        const f = ownerJob(); const s = setup();
        for (const feature of ["pricing", "planning", "brief"] as const) expect(await readiness(feature, true, s.activation)).toEqual({ available: true, offReason: null });
        expect(await handlePlanningTurn(f.planning(), activationPoint.jobAssistantTurnSource("planning", s.activation) as never)).toMatchObject({ status: "reply" });
        expect(s.db.rpc.mock.calls.map(([fn]) => fn)).toEqual(["job_assistant_reserve", "job_assistant_settle", "job_assistant_conclude"]);
        expect(s.create).toHaveBeenCalledTimes(1);
    });

    it("reads the settings row once for one readiness answer and never writes", async () => {
        const db = fakeDatabase({ ...READY, enabled: false }); const s = setup({}, db);
        await readiness("brief", true, s.activation);
        expect(db.read).toHaveBeenCalledTimes(1);
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it("stays fail-closed for a ledger that only answers covers", async () => {
        const covers = vi.fn(async () => false);
        const s = setup({ ledger: () => ({ covers }) as never });
        expect(await readiness("planning", true, s.activation)).toEqual({ available: false, offReason: "ledger_unreadable" });
        expect(covers).toHaveBeenCalledTimes(1);
    });

    it("keeps the ledger's covers answer the same as its readiness, for every row", async () => {
        const config = { attemptPence: 2, perJobPence: 10, monthlyPence: 100 };
        for (const row of [READY, null, { ...READY, enabled: false }, { ...READY, enabled: "true" }, { ...READY, max_monthly_pence: 100.5 }, { ...READY, max_per_job_pence: 0 }, []]) {
            const ledger = createRpcUsageLedger(fakeDatabase(row).client);
            expect(await ledger.covers(config)).toBe(await ledger.assess?.(config) === "ready");
        }
    });
});

describe("CQ-2210 only the job's owner is told why", () => {
    it("withholds the reason from anyone but the verified owner, with the same availability", async () => {
        const s = setup({}, fakeDatabase({ ...READY, enabled: false }));
        expect(await readiness("brief", false, s.activation)).toEqual({ available: false, offReason: null });
        expect(await readiness("brief", true, s.activation)).toEqual({ available: false, offReason: "ledger_disabled" });
    });

    it("never reaches readiness for a signed-out or stale request", async () => {
        const f = ownerJob();
        const s = setup({}, fakeDatabase({ ...READY, enabled: false }));
        const source = activationPoint.jobAssistantTurnSource("planning", s.activation);
        const stale = await handlePlanningTurn({ ...f.planning(), expectedRevision: "b".repeat(64) }, source as never);
        expect(stale.status).toBe("stale");
        f.signOut();
        const signedOut = await handlePlanningTurn(f.planning(), source as never);
        expect(signedOut.status).toBe("unavailable");
        expect(s.db.read).not.toHaveBeenCalled();
        expect(JSON.stringify([stale, signedOut])).not.toMatch(/ledger/i);
    });
});

describe("CQ-2210 the server's own activation on real targets (stubbed environment, fake database)", () => {
    function qaPreview(key = "test-placeholder-not-a-key") {
        vi.stubEnv("VERCEL_ENV", "preview");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", QA_URL);
        vi.stubEnv("DEEPSEEK_API_KEY", key);
        vi.stubEnv("CONSTRUCTA_AI_DISABLED", "");
    }

    it.each([
        ["no settings row", null, "ledger_not_installed"],
        ["the shipped disabled row", { enabled: false, max_attempt_pence: null, max_per_job_pence: null, max_monthly_pence: null }, "ledger_disabled"],
        ["ceilings below the QA caps", { enabled: true, max_attempt_pence: 10, max_per_job_pence: 10, max_monthly_pence: 1999 }, "ledger_limits"],
    ])("QA with the approval and key: %s is named on the real Server Actions and nothing is reserved", async (_name, row, reason) => {
        qaPreview();
        const db = fakeDatabase(row);
        mocks.createAdminClient.mockImplementation(db.client);
        const f = ownerJob();
        expect(await pricingAssistantTurnAction(f.pricing())).toEqual({ status: "off", message: explainAssistantOff(PRICING_CONVERSATION_OFF, reason as JobAssistantOffReason) });
        expect(await planningAssistantTurnAction(f.planning())).toEqual({ status: "off", message: explainAssistantOff(PLANNING_OFF, reason as JobAssistantOffReason) });
        expect(await briefAssistantTurnAction(f.brief())).toEqual({ status: "off", message: explainAssistantOff(BRIEF_OFF, reason as JobAssistantOffReason) });
        expect(db.rpc).not.toHaveBeenCalled();
    });

    it.each(["", "   "])("QA with the approval but key %j says the provider is not connected, before any ledger client", async key => {
        qaPreview(key);
        expect(await activationPoint.jobAssistantReadiness("brief", { owner: true })).toEqual({ available: false, offReason: "provider_unavailable" });
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });

    it("Production stays unapproved with the same key and URL: generic words, and no ledger client", async () => {
        qaPreview();
        vi.stubEnv("VERCEL_ENV", "production");
        const f = ownerJob();
        expect(await activationPoint.jobAssistantReadiness("planning", { owner: true })).toEqual({ available: false, offReason: "not_approved" });
        expect(await planningAssistantTurnAction(f.planning())).toEqual({ status: "off", message: PLANNING_OFF });
        expect(mocks.createAdminClient).not.toHaveBeenCalled();
    });

    it("an emergency stop outranks a ready ledger on the real path", async () => {
        qaPreview();
        vi.stubEnv("CONSTRUCTA_AI_DISABLED", "1");
        const db = fakeDatabase({ enabled: true, max_attempt_pence: 10, max_per_job_pence: 10, max_monthly_pence: 2000 });
        mocks.createAdminClient.mockImplementation(db.client);
        expect(await activationPoint.jobAssistantReadiness("pricing", { owner: true })).toEqual({ available: false, offReason: "emergency_stop" });
        expect(db.read).not.toHaveBeenCalled();
    });
});

describe("CQ-2210 the conversation shows the server's explanation when a turn goes off", () => {
    const disabled = () => { const s = setup({}, fakeDatabase({ ...READY, enabled: false })); return s.activation; };

    it("planning, on the real handler", async () => {
        const f = ownerJob();
        const job = { id: PROJECT, name: "Kitchen refit", start_date: "2026-11-02", programme_phases: [{ name: "Strip out", manualDays: 5, startOffset: 0 }, { name: "Cabinets", manualDays: 5, startOffset: 7 }] };
        const expected = f.planning().expectedRevision;
        const session = createPlanningConversation(() => ({ project: job, hasOpenWork: false }), createPlanningRequestGenerator(input =>
            handlePlanningTurn({ ...input, expectedRevision: expected }, activationPoint.jobAssistantTurnSource("planning", disabled()) as never)));
        session.setMessage("When do I order the worktops?");
        expect(await session.send()).toBe("off");
        expect(session.getSnapshot().error).toBe(explainAssistantOff(PLANNING_OFF, "ledger_disabled"));
    });

    it("pricing, on the real handler", async () => {
        const f = ownerJob();
        const read = () => ({ project: { id: PROJECT, brief_scope: "Install kitchen cabinets." }, estimate: null, hasOpenWork: false });
        const conversation = createPricingConversation(read, createPricingRequestGenerator(read, input =>
            handlePricingTurn(input, activationPoint.jobAssistantTurnSource("pricing", disabled()) as never)));
        expect(f.pricing().estimateId).toBeNull();
        expect(await conversation.send(MESSAGE)).toBe("off");
        expect(conversation.getState()).toMatchObject({ status: "off", error: explainAssistantOff(PRICING_CONVERSATION_OFF, "ledger_disabled"), pending: null });
    });

    it("the wording itself carries no key, project, provider or service detail", () => {
        for (const reason of CASES.map(item => item[2])) {
            for (const text of [explainAssistantOff("", reason), assistantOffLabel(reason) ?? ""])
                expect(text).not.toMatch(/deepseek|openai|supabase|service|secret|\bkey\b|\bref\b|token|error|sql|postgres/i);
        }
    });
});
