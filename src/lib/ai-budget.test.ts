import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AiResponseError } from "./ai";
import { AI_FEATURE_BOUNDS, aiEmergencyStop, withAiBudget, type AiBudgetContext } from "./ai-budget";
import { fakeAiBudget } from "./__fixtures__/fake-ai-budget";

const USER = "aaaaaaaa-0000-4000-8000-000000000001";
const OTHER = "bbbbbbbb-0000-4000-8000-000000000002";
const FP = "0123456789abcdef0123456789abcdef";
const Schema = z.object({ text: z.string() });
const REQUEST = { label: "test.rewrite", system: "RULES", user: '{"text":"hello"}', schema: Schema };
const USAGE = { promptTokens: 210, completionTokens: 85 };

type Budget = ReturnType<typeof fakeAiBudget>;
/** A generator that returns a canned reply. No provider is involved in this file. */
const canned = (text = "tidy") => vi.fn(async (...received: [Record<string, unknown>]) => { void received; return { data: { text }, model: "canned-model", usage: USAGE }; });
const context = (budget: Budget, generate: unknown, over: Partial<AiBudgetContext> = {}): AiBudgetContext =>
    ({ admin: budget.admin, userId: USER, feature: "profile.rewrite", promptVersion: "test-v1", generate: generate as AiBudgetContext["generate"], ...over });
const ok = () => "ok" as const;

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.unstubAllEnvs();
});

describe("withAiBudget: a call that goes well", () => {
    it("reserves first, makes one call with the fixed bounds, judges, and finishes once as ok with the real usage", async () => {
        const budget = fakeAiBudget();
        const order: string[] = [];
        const generate = vi.fn(async (...received: [Record<string, unknown>]) => { void received; order.push(`call after ${budget.rpcCalls.map((c) => c.name).join(",")}`); return { data: { text: "tidy" }, model: "canned-model", usage: USAGE }; });
        const judge = vi.fn(() => { order.push("judge"); return "ok" as const; });

        const result = await withAiBudget(context(budget, generate), REQUEST, judge);

        expect(result).toEqual({ status: "ok", data: { text: "tidy" }, attemptId: budget.attempts[0].id, model: "canned-model", promptVersion: "test-v1", usage: USAGE });
        expect(order).toEqual(["call after ai_generation_reserve", "judge"]);
        expect(budget.rpcCalls.map((call) => call.name)).toEqual(["ai_generation_reserve", "ai_generation_finish"]);
        expect(generate).toHaveBeenCalledTimes(1);
        expect(generate.mock.calls[0][0]).toMatchObject({ feature: "test.rewrite", system: "RULES", user: '{"text":"hello"}', maxOutputTokens: 700, timeoutMs: 20_000 });
        expect(budget.calls("ai_generation_reserve")[0].args).toEqual({ p_user_id: USER, p_feature: "profile.rewrite", p_reserve_output_tokens: 700, p_source_fingerprint: null });
        expect(budget.attempts[0]).toMatchObject({ outcome: "ok", prompt_tokens: 210, completion_tokens: 85, model: "canned-model", prompt_version: "test-v1", reserved_output_tokens: 700 });
        expect(budget.charged()).toEqual([85]);
    });

    it("reserves exactly the output cap it then gives the call, per feature, and a caller cannot raise either", async () => {
        const budget = fakeAiBudget({ introductionEnabled: true });
        const generate = canned();
        await withAiBudget(context(budget, generate, { feature: "company.introduction", sourceFingerprint: FP, ...({ maxOutputTokens: 100_000, timeoutMs: 999_999 } as object) }), { ...REQUEST, ...({ maxOutputTokens: 100_000 } as object) }, ok);
        expect(budget.calls("ai_generation_reserve")[0].args).toMatchObject({ p_feature: "company.introduction", p_reserve_output_tokens: 500, p_source_fingerprint: FP });
        expect(generate.mock.calls[0][0]).toMatchObject({ maxOutputTokens: AI_FEATURE_BOUNDS["company.introduction"].maxOutputTokens, timeoutMs: 20_000 });
        expect(budget.attempts[0].source_fingerprint).toBe(FP);
    });
});

describe("withAiBudget: no reservation, no call", () => {
    it.each([
        ["the feature is switched off in the database", (b: Budget) => { b.features["profile.rewrite"].enabled = false; }, "disabled"],
        ["a call is already in flight for this contractor", (b: Budget) => { b.admin.rpc("ai_generation_reserve", { p_user_id: USER, p_feature: "profile.rewrite", p_reserve_output_tokens: 700, p_source_fingerprint: null }); }, "in-flight"],
        ["the hourly attempts are used up", (b: Budget) => { b.limits.contractor.perHour = 0; }, "attempt-limit"],
        ["the daily attempts are used up", (b: Budget) => { b.limits.contractor.perDay = 0; }, "attempt-limit"],
        ["the daily output is used up", (b: Budget) => { b.limits.contractor.perDayTokens = 699; }, "token-limit"],
        ["the service ceiling is reached", (b: Budget) => { b.limits.global.perDay = 0; }, "service-limit"],
        ["the service's output ceiling is reached", (b: Budget) => { b.limits.global.perDayTokens = 699; }, "service-limit"],
        ["the budget cannot be reached", (b: Budget) => { b.fail("ai_generation_reserve"); }, "unavailable"],
    ])("when %s, the provider is not called and nothing is recorded", async (_name, arrange, reason) => {
        const budget = fakeAiBudget();
        arrange(budget);
        const before = budget.attempts.length;
        const generate = canned();
        const judge = vi.fn(ok);

        expect(await withAiBudget(context(budget, generate), REQUEST, judge)).toEqual({ status: "refused", reason });
        expect(generate).not.toHaveBeenCalled();
        expect(judge).not.toHaveBeenCalled();
        expect(budget.attempts.length).toBe(before);
        expect(budget.calls("ai_generation_finish")).toEqual([]);
    });

    it("the interview's AI wording is refused while it is switched off, which is how it is seeded", async () => {
        const budget = fakeAiBudget();
        const generate = canned();
        expect(await withAiBudget(context(budget, generate, { feature: "company.introduction", sourceFingerprint: FP }), REQUEST, ok)).toEqual({ status: "refused", reason: "disabled" });
        expect(generate).not.toHaveBeenCalled();
    });

    it.each([
        ["an unknown reservation status", { data: { status: "sure, go ahead" }, error: null }],
        ["a reservation with no attempt id", { data: { status: "reserved" }, error: null }],
        ["an empty answer", { data: null, error: null }],
    ])("treats %s as no reservation", async (_name, answer) => {
        const generate = canned();
        const admin = { rpc: vi.fn(async () => answer) };
        expect(await withAiBudget({ admin: admin as never, userId: USER, feature: "profile.rewrite", promptVersion: "v", generate: generate as never }, REQUEST, ok)).toEqual({ status: "refused", reason: "unavailable" });
        expect(generate).not.toHaveBeenCalled();
        expect(admin.rpc).toHaveBeenCalledTimes(1);
    });

    it("refuses a request over the fixed size limits before consulting the budget", async () => {
        const budget = fakeAiBudget();
        const generate = canned();
        for (const request of [
            { ...REQUEST, user: "x".repeat(AI_FEATURE_BOUNDS["profile.rewrite"].maxUserChars + 1) },
            { ...REQUEST, system: "x".repeat(AI_FEATURE_BOUNDS["profile.rewrite"].maxSystemChars + 1) },
            { ...REQUEST, user: "" },
            { ...REQUEST, system: "" },
        ]) expect(await withAiBudget(context(budget, generate), request, ok)).toEqual({ status: "refused", reason: "unavailable" });
        expect(await withAiBudget(context(budget, generate, { userId: "" }), REQUEST, ok)).toEqual({ status: "refused", reason: "unavailable" });
        expect(budget.rpcCalls).toEqual([]);
        expect(generate).not.toHaveBeenCalled();
    });
});

describe("the emergency stop", () => {
    it("stops every call before the budget is even consulted", async () => {
        for (const value of ["1", "true", "TRUE", "yes", "on"]) {
            vi.stubEnv("CONSTRUCTA_AI_DISABLED", value);
            const budget = fakeAiBudget();
            const generate = canned();
            expect(await withAiBudget(context(budget, generate), REQUEST, ok), value).toEqual({ status: "refused", reason: "disabled" });
            expect(budget.rpcCalls, value).toEqual([]);
            expect(generate, value).not.toHaveBeenCalled();
        }
    });

    it("is off when unset, empty, 0 or false", () => {
        for (const value of [undefined, "", " ", "0", "false", "FALSE"]) {
            if (value === undefined) vi.unstubAllEnvs(); else vi.stubEnv("CONSTRUCTA_AI_DISABLED", value);
            expect(aiEmergencyStop(), String(value)).toBe(false);
        }
    });

    it("can only switch off: no environment variable switches a disabled feature on", async () => {
        for (const name of ["CONSTRUCTA_AI_ENABLED", "CONSTRUCTA_INTERVIEW_AI", "CONSTRUCTA_AI_DISABLED", "AI_ENABLED", "ENABLE_AI"]) vi.stubEnv(name, name === "CONSTRUCTA_AI_DISABLED" ? "0" : "1");
        const budget = fakeAiBudget();
        const generate = canned();
        expect(await withAiBudget(context(budget, generate, { feature: "company.introduction", sourceFingerprint: FP }), REQUEST, ok)).toEqual({ status: "refused", reason: "disabled" });
        expect(generate).not.toHaveBeenCalled();
        const source = readFileSync(path.resolve(__dirname, "ai-budget.ts"), "utf8");
        expect(source.match(/process\.env\.\w+/g)).toEqual(["process.env.CONSTRUCTA_AI_DISABLED"]);
    });
});

describe("withAiBudget: every attempt ends exactly once, truthfully", () => {
    it.each([
        ["a reply the caller's check rejects", () => "rejected:tripwire" as const, "rejected:tripwire"],
        ["a reply whose sources moved while it was being written", () => "sources-moved" as const, "sources-moved"],
    ])("%s is recorded as that, once, charged what it really used", async (_name, judge, outcome) => {
        const budget = fakeAiBudget();
        const result = await withAiBudget(context(budget, canned()), REQUEST, judge);
        expect(result).toEqual({ status: "rejected", outcome, attemptId: budget.attempts[0].id });
        expect(budget.calls("ai_generation_finish")).toHaveLength(1);
        expect(budget.attempts[0]).toMatchObject({ outcome, prompt_tokens: 210, completion_tokens: 85, model: "canned-model" });
        expect(budget.charged()).toEqual([85]);
    });

    it("the verdict is decided before the attempt is finished, so a finished attempt is never rewritten", async () => {
        const budget = fakeAiBudget();
        let finishedWhenJudged = true;
        await withAiBudget(context(budget, canned()), REQUEST, () => { finishedWhenJudged = budget.attempts[0].finished_at !== null; return "sources-moved"; });
        expect(finishedWhenJudged).toBe(false);
        expect(budget.calls("ai_generation_finish").map((call) => call.args.p_outcome)).toEqual(["sources-moved"]);
    });

    it.each([
        ["not JSON", "not-json"],
        ["the wrong shape", "wrong-shape"],
        ["cut off at the output limit", "cut-off"],
    ] as const)("a reply that is %s is charged the usage the provider reported, not the reservation", async (_name, reason) => {
        const budget = fakeAiBudget();
        const generate = vi.fn(async () => { throw new AiResponseError("test.rewrite", reason, "canned-model", { promptTokens: 300, completionTokens: 140 }); });
        const judge = vi.fn(ok);
        expect(await withAiBudget(context(budget, generate), REQUEST, judge)).toEqual({ status: "rejected", outcome: "rejected:schema", attemptId: budget.attempts[0].id });
        expect(judge).not.toHaveBeenCalled();
        expect(budget.attempts[0]).toMatchObject({ outcome: "rejected:schema", prompt_tokens: 300, completion_tokens: 140, model: "canned-model" });
        expect(budget.charged()).toEqual([140]);
        expect(generate).toHaveBeenCalledTimes(1);
    });

    it("a rejected reply with no usage reported is charged its whole reservation", async () => {
        const budget = fakeAiBudget();
        const generate = vi.fn(async () => { throw new AiResponseError("test.rewrite", "wrong-shape", null, null); });
        await withAiBudget(context(budget, generate), REQUEST, ok);
        expect(budget.attempts[0]).toMatchObject({ outcome: "rejected:schema", completion_tokens: null });
        expect(budget.charged()).toEqual([700]);
    });

    it("a call that gives nothing back is an error charged in full, with no second call", async () => {
        const budget = fakeAiBudget();
        const generate = vi.fn(async () => { throw new Error("socket hang up"); });
        expect(await withAiBudget(context(budget, generate), REQUEST, ok)).toEqual({ status: "failed", attemptId: budget.attempts[0].id });
        expect(generate).toHaveBeenCalledTimes(1);
        expect(budget.calls("ai_generation_finish")).toHaveLength(1);
        expect(budget.attempts[0]).toMatchObject({ outcome: "error", completion_tokens: null, prompt_tokens: null });
        expect(budget.charged()).toEqual([700]);
    });

    it("a check that throws is recorded as an error with the usage that is known, once", async () => {
        const budget = fakeAiBudget();
        const result = await withAiBudget(context(budget, canned()), REQUEST, () => { throw new Error("tripwire crashed"); });
        expect(result).toEqual({ status: "failed", attemptId: budget.attempts[0].id });
        expect(budget.calls("ai_generation_finish")).toHaveLength(1);
        expect(budget.attempts[0]).toMatchObject({ outcome: "error", completion_tokens: 85 });
    });

    it("a good reply is not used if recording it fails: it stays open, charged in full, and is not retried", async () => {
        const budget = fakeAiBudget();
        budget.fail("ai_generation_finish");
        const generate = canned();
        expect(await withAiBudget(context(budget, generate), REQUEST, ok)).toEqual({ status: "failed", attemptId: budget.attempts[0].id });
        expect(generate).toHaveBeenCalledTimes(1);
        expect(budget.calls("ai_generation_finish")).toHaveLength(1);
        expect(budget.attempts[0].finished_at).toBeNull();
        expect(budget.charged()).toEqual([700]);
        // It blocks the next call until it is abandoned, two minutes later, and still counts then.
        expect(await withAiBudget(context(budget, canned()), REQUEST, ok)).toEqual({ status: "refused", reason: "in-flight" });
        budget.advance(2 * 60 * 1000 + 1);
        expect((await withAiBudget(context(budget, canned()), REQUEST, ok)).status).toBe("ok");
        expect(budget.attempts.map((attempt) => attempt.outcome)).toEqual(["abandoned", "ok"]);
        expect(budget.charged()).toEqual([700, 85]);
    });

    it("failures are not free: six failed calls use up the hour", async () => {
        const budget = fakeAiBudget();
        const generate = vi.fn(async () => { throw new Error("provider down"); });
        for (let call = 0; call < 6; call += 1) expect((await withAiBudget(context(budget, generate), REQUEST, ok)).status).toBe("failed");
        expect(await withAiBudget(context(budget, generate), REQUEST, ok)).toEqual({ status: "refused", reason: "attempt-limit" });
        expect(generate).toHaveBeenCalledTimes(6);
        // Another contractor has their own allowance.
        expect((await withAiBudget(context(budget, canned(), { userId: OTHER }), REQUEST, ok)).status).toBe("ok");
    });

    it("the allowance is one pool across both features", async () => {
        const budget = fakeAiBudget({ introductionEnabled: true });
        for (let pair = 0; pair < 3; pair += 1) {
            expect((await withAiBudget(context(budget, canned()), REQUEST, ok)).status).toBe("ok");
            expect((await withAiBudget(context(budget, canned(), { feature: "company.introduction", sourceFingerprint: FP }), REQUEST, ok)).status).toBe("ok");
        }
        expect(await withAiBudget(context(budget, canned()), REQUEST, ok)).toEqual({ status: "refused", reason: "attempt-limit" });
        expect(await withAiBudget(context(budget, canned(), { feature: "company.introduction", sourceFingerprint: FP }), REQUEST, ok)).toEqual({ status: "refused", reason: "attempt-limit" });
    });

    it("lets only one of several simultaneous calls reach the provider", async () => {
        const budget = fakeAiBudget();
        const generate = canned();
        const results = await Promise.all(Array.from({ length: 8 }, () => withAiBudget(context(budget, generate), REQUEST, ok)));
        expect(results.filter((result) => result.status === "ok")).toHaveLength(1);
        expect(results.filter((result) => result.status === "refused" && result.reason === "in-flight")).toHaveLength(7);
        expect(generate).toHaveBeenCalledTimes(1);
        expect(budget.attempts).toHaveLength(1);
    });

    it("acts only for the contractor it was given", async () => {
        const budget = fakeAiBudget();
        await withAiBudget(context(budget, canned()), { ...REQUEST, ...({ userId: OTHER, p_user_id: OTHER } as object) }, ok);
        expect(new Set(budget.rpcCalls.map((call) => call.args.p_user_id))).toEqual(new Set([USER]));
    });
});

describe("structure: no call to the provider for these features without the budget", () => {
    const root = path.resolve(__dirname, "..");
    const sources = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return name === "node_modules" || name === "admin-e2e-import-fixture" ? [] : sources(full);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
    const relative = (file: string) => path.relative(root, file);

    it("generateStructured is called in exactly one place: the budget wrapper", () => {
        const callers = sources(root).filter((file) => /generateStructured\s*[(<]|\?\?\s*generateStructured/.test(readFileSync(file, "utf8"))).map(relative).sort();
        expect(callers).toEqual(["lib/ai-budget.ts", "lib/ai.ts"]);
    });

    it("the profile rewrite actions reach the provider only through the wrapper", () => {
        const source = readFileSync(path.join(root, "app/dashboard/settings/profile/actions.ts"), "utf8");
        expect(source).toContain('from "@/lib/ai-budget"');
        expect(source).not.toMatch(/from "@\/lib\/ai"|generateStructured|generateText|generateJSON|getAIClient|openai/);
        expect(source.match(/withAiBudget\(/g)).toHaveLength(1);
    });

    it("the interview's AI drafting is still imported by nothing", () => {
        const importers = sources(root).filter((file) => !file.endsWith("company-interview/ai-draft.ts") && /company-interview\/ai-draft|from "\.\/ai-draft"/.test(readFileSync(file, "utf8")));
        expect(importers.map(relative)).toEqual([]);
    });

    it("the budget's database functions are called only by the wrapper", () => {
        const callers = sources(root).filter((file) => /ai_generation_(reserve|finish)/.test(readFileSync(file, "utf8"))).map(relative).sort();
        expect(callers).toEqual(["lib/__fixtures__/fake-ai-budget.ts", "lib/ai-budget.ts"]);
    });

    it("says in its own header that it covers two features and is not app-wide", () => {
        const source = readFileSync(path.join(root, "lib/ai-budget.ts"), "utf8");
        expect(source).toContain("It is not an");
        expect(source).toContain("application-wide spending limit");
    });
});
