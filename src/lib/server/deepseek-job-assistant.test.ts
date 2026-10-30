import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
    constructed: [] as Record<string, unknown>[],
    create: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
    default: class {
        chat = { completions: { create: sdk.create } };
        constructor(options: Record<string, unknown>) { sdk.constructed.push(options); }
    },
}));

import * as ai from "@/lib/ai";
import * as providers from "./openai-job-assistant-transport";
import * as activation from "./job-assistant-transport";
import { approvedPlanningGenerator, jobAssistantAvailable, type JobAssistantActivation } from "./job-assistant-transport";
import { GenerationRefused, type JobAssistantFeature } from "./job-assistant-generation";
import type { ActivationLedger } from "./job-assistant-ledger";
import type { PlanningContext } from "@/lib/planning-conversation";

const QA_URL = "https://umqtzfsnyoofmgfbnrgv.supabase.co";
const KEY = "test-placeholder-not-a-key";
const PROJECT = "11111111-1111-4111-8111-111111111111";
const ATTEMPT = "44444444-4444-4444-8444-444444444444";
const REVISION = "a".repeat(64);

/** A DeepSeek approval shape for tests only. Its prices are NOT DeepSeek's: no verified price exists in source. */
const approval = (feature: JobAssistantFeature, patch: Record<string, unknown> = {}) => ({
    feature,
    approval: { ref: "TEST-ONLY", approvedBy: "test", approvedAt: "2026-10-29T15:45:00.000Z" },
    provider: "deepseek", model: "deepseek-flash", maxOutputTokens: 500, timeoutMs: 1000, maxMessages: 6, maxInputChars: 5000,
    prices: { inputPencePerMillionTokens: 25, outputPencePerMillionTokens: 100 },
    attemptPence: 10, perJobPence: 10, monthlyPence: 2000, ...patch,
});

function fakeLedger(covers = true) {
    const steps: unknown[][] = [];
    const ledger: ActivationLedger = {
        covers: vi.fn(async () => covers),
        reserve: vi.fn(async r => { steps.push(["reserve", r]); return { ok: true }; }),
        settle: vi.fn(async (id, pence) => { steps.push(["settle", id, pence]); }),
        release: vi.fn(async id => { steps.push(["release", id]); }),
        retain: vi.fn(async (id, reason) => { steps.push(["retain", id, reason]); }),
        conclude: vi.fn(async (id, outcome) => { steps.push(["conclude", id, outcome]); }),
    };
    return { ledger, steps };
}

/** The server's own providers, with a test approval and a fake ledger. */
function setup(approvals: Partial<Record<JobAssistantFeature, unknown>> = { planning: approval("planning") }, covers = true) {
    const { ledger, steps } = fakeLedger(covers);
    const makeLedger = vi.fn(() => ledger);
    const act: JobAssistantActivation = {
        approvals: { pricing: null, planning: null, brief: null, ...approvals },
        stopped: () => false,
        providers: activation.JOB_ASSISTANT_PROVIDERS,
        ledger: makeLedger,
    };
    return { act, ledger, steps, makeLedger };
}

const input = (signal = new AbortController().signal) => ({
    userId: "user-1", projectId: PROJECT, revision: REVISION, attemptId: ATTEMPT,
    context: { phases: [] } as unknown as PlanningContext, messages: [{ role: "user" as const, content: "Is the programme realistic?" }], signal,
});

const reply = (patch: Record<string, unknown> = {}) => ({
    model: "deepseek-flash",
    usage: { prompt_tokens: 1000, completion_tokens: 100 },
    choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ reply: "Looks fine." }) } }],
    ...patch,
});

function qaPreview() {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", QA_URL);
    vi.stubEnv("DEEPSEEK_API_KEY", KEY);
    vi.stubEnv("OPENAI_API_KEY", "openai-test-placeholder");
}

beforeEach(() => {
    sdk.constructed.length = 0;
    sdk.create.mockReset();
    qaPreview();
});
afterEach(() => vi.unstubAllEnvs());

describe("DeepSeek client", () => {
    it("uses only the server key and the fixed DeepSeek endpoint, with SDK retries off", () => {
        vi.stubEnv("DEEPSEEK_BASE_URL", "https://example.test/not-deepseek");
        ai.getDeepSeekClient();
        expect(sdk.constructed).toEqual([{ apiKey: KEY, baseURL: "https://api.deepseek.com", maxRetries: 0 }]);
    });

    it.each(["", "   "])("refuses a missing key (%j) without making a client or exposing a value", key => {
        vi.stubEnv("DEEPSEEK_API_KEY", key);
        expect(() => ai.getDeepSeekClient()).toThrow("DEEPSEEK_API_KEY is not configured");
        expect(sdk.constructed).toEqual([]);
    });
});

describe("DeepSeek job assistant provider: QA Preview only", () => {
    it("is configured on QA Preview with a key, without making a client", () => {
        expect(providers.deepSeekJobAssistantProvider.configured()).toBe(true);
        expect(sdk.constructed).toEqual([]);
    });

    it.each([
        ["Production", { VERCEL_ENV: "production" }],
        ["development", { VERCEL_ENV: "development" }],
        ["no Vercel environment", { VERCEL_ENV: "" }],
        ["another Supabase project", { NEXT_PUBLIC_SUPABASE_URL: "https://pudadynieiuypxeoimnz.supabase.co" }],
        ["a look-alike project host", { NEXT_PUBLIC_SUPABASE_URL: `${QA_URL}.example.test` }],
        ["no key", { DEEPSEEK_API_KEY: "" }],
    ])("fails closed for %s", async (_label, env) => {
        for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
        expect(providers.deepSeekJobAssistantProvider.configured()).toBe(false);
        const s = setup();
        expect(await jobAssistantAvailable("planning", s.act)).toBe(false);
        expect(s.makeLedger).not.toHaveBeenCalled();
        expect(sdk.constructed).toEqual([]);
    });

    it("is registered with the server's activation point beside OpenAI", () => {
        expect(Object.keys(activation.JOB_ASSISTANT_PROVIDERS ?? {}).sort()).toEqual(["deepseek", "openai"]);
    });

    it("keeps every feature OFF at runtime without QA Preview, even if a key is present", async () => {
        vi.stubEnv("VERCEL_ENV", "production");
        vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", QA_URL);
        vi.stubEnv("DEEPSEEK_API_KEY", KEY);
        expect(await jobAssistantAvailable("planning")).toBe(false);
        expect(sdk.constructed).toEqual([]);
    });

    it("stays OFF on QA Preview until the ledger admits the caps, even with server approvals present", async () => {
        expect(await jobAssistantAvailable("planning")).toBe(false);
        expect(sdk.constructed).toEqual([]);
    });

    it("checks the ledger only after the approval, caps and QA target pass, and makes no client before a send", async () => {
        const off = setup({ planning: approval("planning") }, false);
        expect(await jobAssistantAvailable("planning", off.act)).toBe(false);
        expect(off.ledger.covers).toHaveBeenCalledWith(expect.objectContaining({ attemptPence: 10, perJobPence: 10, monthlyPence: 2000 }));

        const mismatched = setup({ planning: approval("planning"), pricing: approval("pricing", { monthlyPence: 1000 }) });
        expect(await jobAssistantAvailable("planning", mismatched.act)).toBe(false);
        expect(mismatched.makeLedger).not.toHaveBeenCalled();

        const combined = setup({ planning: approval("planning"), pricing: approval("pricing"), brief: approval("brief") });
        expect(await jobAssistantAvailable("planning", combined.act)).toBe(true);
        expect(sdk.constructed).toEqual([]);
    });
});

describe("DeepSeek through the real generation seam", () => {
    async function generator(patch: Record<string, unknown> = {}) {
        const s = setup({ planning: approval("planning", patch) });
        const generate = await approvedPlanningGenerator(s.act);
        expect(generate).not.toBeNull();
        return { ...s, generate: generate! };
    }

    it("sends one DeepSeek request after the reservation and settles the reported cost", async () => {
        sdk.create.mockResolvedValue(reply());
        const s = await generator();

        expect(await s.generate(input())).toEqual({ reply: "Looks fine." });
        expect(sdk.constructed).toEqual([{ apiKey: KEY, baseURL: "https://api.deepseek.com", maxRetries: 0 }]);
        expect(sdk.create).toHaveBeenCalledTimes(1);
        const [body, options] = sdk.create.mock.calls[0];
        expect(body).toMatchObject({ model: "deepseek-flash", max_tokens: 500, thinking: { type: "disabled" }, response_format: { type: "json_object" } });
        expect(body).not.toHaveProperty("max_completion_tokens");
        expect(options).toMatchObject({ maxRetries: 0 });
        expect(s.steps).toEqual([
            ["reserve", expect.objectContaining({ provider: "deepseek", model: "deepseek-flash", approvalRef: "TEST-ONLY", pence: 10, caps: { perJobPence: 10, monthlyPence: 2000 } })],
            ["settle", ATTEMPT, 1],
        ]);
    });

    it.each([
        ["another model named in the reply", reply({ model: "deepseek-v4-flash" })],
        ["a dated variant of the requested model", reply({ model: "deepseek-flash-1017" })],
        ["missing usage", reply({ usage: undefined })],
        ["non-integer usage", reply({ usage: { prompt_tokens: 10.5, completion_tokens: 1 } })],
    ])("keeps the whole reservation and refuses the reply for %s", async (_label, response) => {
        sdk.create.mockResolvedValue(response);
        const s = await generator();
        await expect(s.generate(input())).rejects.toMatchObject({ reason: "usage" });
        expect(s.steps.at(-1)).toEqual(["retain", ATTEMPT, "unreadable_usage"]);
    });

    it("an uncertain DeepSeek send keeps the reservation and never calls OpenAI as well", async () => {
        sdk.create.mockRejectedValue(new Error("socket hang up"));
        const s = await generator();
        await expect(s.generate(input())).rejects.toBeInstanceOf(GenerationRefused);
        expect(s.steps.at(-1)).toEqual(["retain", ATTEMPT, "failed"]);
        expect(sdk.create).toHaveBeenCalledTimes(1);
        expect(sdk.constructed.map(o => o.baseURL)).toEqual(["https://api.deepseek.com"]);
    });

    it("a cancelled request is not sent and nothing about it is charged twice", async () => {
        const controller = new AbortController();
        controller.abort();
        const s = await generator();
        await expect(s.generate(input(controller.signal))).rejects.toMatchObject({ reason: "cancelled" });
        expect(sdk.create).not.toHaveBeenCalled();
        expect(s.steps.at(-1)).toEqual(["retain", ATTEMPT, "cancelled"]);
    });

    it("refuses before any client when the QA target changed after readiness", async () => {
        const s = await generator();
        vi.stubEnv("VERCEL_ENV", "production");
        await expect(s.generate(input())).rejects.toMatchObject({ reason: "not_sent" });
        expect(sdk.constructed).toEqual([]);
        expect(s.steps.at(-1)).toEqual(["release", ATTEMPT]);
    });

    it("each transport refuses a request for the other provider before making a client", async () => {
        const request = { model: "m", maxOutputTokens: 10, prices: { inputPencePerMillionTokens: 1, outputPencePerMillionTokens: 1 }, context: null, messages: [], signal: new AbortController().signal };
        expect(await providers.deepSeekJobAssistantProvider.transport("p").send({ ...request, provider: "openai" })).toEqual({ kind: "not_sent" });
        expect(await providers.openAIJobAssistantProvider.transport("p").send({ ...request, provider: "deepseek" })).toEqual({ kind: "not_sent" });
        expect(sdk.constructed).toEqual([]);
    });
});

describe("DeepSeek QA activation config (server source)", () => {
    beforeEach(() => qaPreview());
    afterEach(() => vi.unstubAllEnvs());

    it("binds the Rob QA approval ref and peak budget prices only on QA Preview with a key", () => {
        expect(activation.APPROVED_GENERATION.planning).toMatchObject({
            feature: "planning",
            provider: "deepseek",
            model: "deepseek-flash",
            attemptPence: 10,
            perJobPence: 10,
            monthlyPence: 2000,
            maxOutputTokens: 4000,
            timeoutMs: 60000,
            maxMessages: 24,
            maxInputChars: 60000,
            prices: { inputPencePerMillionTokens: 25, outputPencePerMillionTokens: 100 },
            approval: { ref: "rob-qa-deepseek-flash-20261029T160232065Z", approvedAt: "2026-10-29T16:02:32.065Z" },
        });
    });

    it("returns null approvals on Production with the same key and QA URL", () => {
        vi.stubEnv("VERCEL_ENV", "production");
        expect(activation.APPROVED_GENERATION.planning).toBeNull();
        expect(activation.APPROVED_GENERATION.pricing).toBeNull();
        expect(activation.APPROVED_GENERATION.brief).toBeNull();
    });
});
