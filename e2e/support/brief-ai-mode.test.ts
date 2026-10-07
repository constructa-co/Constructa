import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeAiBudget } from "../../src/lib/__fixtures__/fake-ai-budget";
import { suggestBrief } from "../../src/lib/cohort-ai/brief-suggest";
import { COHORT_AI_OFF, COHORT_AI_UNAVAILABLE } from "../../src/lib/cohort-ai/shared";
import { AI_UNAVAILABLE_ERROR, BRIEF_TRADES } from "../../src/lib/guided-brief";
import { budgetInspector } from "./backend";
import {
    BRIEF_AI_MODE_VARIABLE, BRIEF_AI_OFF_MESSAGE, BRIEF_AI_PREREQUISITES, DEFAULT_BRIEF_AI_MODE,
    assertBriefAiPrerequisites, briefAiExpectation, briefAiPrerequisiteProblems, functionArgumentsFromApiDescription, readBriefAiMode,
    type BudgetInspector, type Read,
} from "./brief-ai-mode";
import { APPROVED_DISPOSABLE_PROJECT, E2EConfigurationError, type E2EEnv } from "./env";
import { JOB } from "./journey-data";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const { feature, tables, functions, migrations } = BRIEF_AI_PREREQUISITES;

/** A made-up key in the shape of a Supabase key. Not a real key. Used to prove it is never printed. */
const SECRET = "eyJhbGciOiJIUzI1NiJ9.c2VjcmV0LXNlcnZpY2Utcm9sZQ.not-a-real-signature";

/** A pretend disposable project. `null` for a table or function means it does not exist there. */
interface Project {
    features: Array<{ feature: string; enabled: unknown }> | null;
    limits: string[] | null;
    attempts: boolean;
    functions: Record<string, string[] | null>;
}
const asMigrated = (overrides: Partial<Project> = {}): Project => ({
    features: [{ feature: "profile.rewrite", enabled: true }, { feature: "company.introduction", enabled: false }, { feature, enabled: false }],
    limits: ["contractor", "global"],
    attempts: true,
    functions: { ai_generation_reserve: [...functions.ai_generation_reserve], ai_generation_finish: [...functions.ai_generation_finish] },
    ...overrides,
});
const MISSING_TABLE: Read<never> = { ok: false, code: "PGRST205" };

/** Reads the pretend project by the names the helper asks for, so a renamed table or function is simply not found. */
function inspect(project: Project): BudgetInspector & { asked: string[] } {
    const asked: string[] = [];
    return {
        asked,
        feature: async (name) => { asked.push(`feature:${name}`); return project.features ? { ok: true, value: project.features.find((row) => row.feature === name) ?? null } : MISSING_TABLE; },
        limitScopes: async () => { asked.push("limits"); return project.limits ? { ok: true, value: project.limits } : MISSING_TABLE; },
        attemptsReadable: async () => { asked.push("attempts"); return project.attempts ? { ok: true, value: true } : MISSING_TABLE; },
        functionArguments: async (name) => { asked.push(`function:${name}`); return { ok: true, value: project.functions[name] ?? null }; },
    };
}
const problems = (project: Project, mode: "disabled" | "enabled-with-stub" = "disabled") => briefAiPrerequisiteProblems(inspect(project), mode);

afterEach(() => vi.unstubAllGlobals());

describe("Brief AI mode: explicit and deterministic", () => {
    it("is 'disabled' on this candidate unless a run says otherwise", () => {
        expect(DEFAULT_BRIEF_AI_MODE).toBe("disabled");
        expect(readBriefAiMode({ NODE_ENV: "test" })).toBe("disabled");
        expect(readBriefAiMode({ NODE_ENV: "test", [BRIEF_AI_MODE_VARIABLE]: "  " })).toBe("disabled");
        expect(readBriefAiMode({ NODE_ENV: "test", [BRIEF_AI_MODE_VARIABLE]: "disabled" })).toBe("disabled");
        expect(readBriefAiMode({ NODE_ENV: "test", [BRIEF_AI_MODE_VARIABLE]: "enabled-with-stub" })).toBe("enabled-with-stub");
    });

    it("refuses anything else as a configuration failure, rather than guessing", () => {
        for (const value of ["enabled", "on", "true", "1", "auto", "Disabled"]) {
            expect(() => readBriefAiMode({ NODE_ENV: "test", [BRIEF_AI_MODE_VARIABLE]: value }), value).toThrow(E2EConfigurationError);
        }
    });

    it("the hosted workflow names the mode instead of relying on the default", () => {
        expect(read(".github/workflows/e2e.yml")).toMatch(/E2E_BRIEF_AI_MODE: disabled\b/);
    });

    it("each mode expects different things, so neither can pass for the other", () => {
        expect(briefAiExpectation("disabled")).toEqual({ mode: "disabled", suggestionTested: false, message: COHORT_AI_OFF, providerRequests: 0, budgetAttempts: 0, tradesChosen: "by hand", appliesSuggestion: false });
        expect(briefAiExpectation("enabled-with-stub")).toEqual({ mode: "enabled-with-stub", suggestionTested: true, message: null, providerRequests: 1, budgetAttempts: 1, tradesChosen: "from the suggestion", appliesSuggestion: true });
    });
});

describe("the helper checks what the application really needs", () => {
    it("uses the application's own function, argument, feature and table names", () => {
        const wrapper = read("src/lib/ai-budget.ts");
        for (const [name, args] of Object.entries(functions)) {
            expect(wrapper, name).toContain(`admin.rpc("${name}"`);
            for (const argument of args) expect(wrapper, `${name}.${argument}`).toContain(`${argument}:`);
        }
        expect(read("src/lib/cohort-ai/brief-suggest.ts")).toContain(`feature: "${feature}"`);
        const budget = read(`supabase/migrations/${migrations[0]}`);
        for (const table of Object.values(tables)) expect(budget, table).toContain(`CREATE TABLE public.${table} (`);
        expect(budget).toContain("CREATE FUNCTION public.ai_generation_reserve(");
        expect(budget).toContain("CREATE FUNCTION public.ai_generation_finish(");
        expect(read(`supabase/migrations/${migrations[2]}`)).toContain(`'${feature}'`);
        for (const migration of migrations) expect(existsSync(path.join(root, "supabase/migrations", migration)), migration).toBe(true);
    });

    it("asks for exactly those names", async () => {
        const inspector = inspect(asMigrated());
        await briefAiPrerequisiteProblems(inspector, "disabled");
        expect(inspector.asked.sort()).toEqual(["attempts", `feature:${feature}`, "function:ai_generation_finish", "function:ai_generation_reserve", "limits"]);
    });

    it("the message it expects is the application's own, and is not the 'not available' message", () => {
        expect(BRIEF_AI_OFF_MESSAGE).toBe(COHORT_AI_OFF);
        expect(BRIEF_AI_OFF_MESSAGE).not.toBe(AI_UNAVAILABLE_ERROR);
        expect(BRIEF_AI_OFF_MESSAGE).not.toBe(COHORT_AI_UNAVAILABLE);
    });

    it("the real Brief code says 'not switched on' only when the feature is off, and 'not available' when the database function is missing", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const input = { description: JOB.description, project: { name: JOB.name, projectType: "", address: JOB.site }, today: "2026-10-08" };
        const neverCalled = vi.fn();

        const off = await suggestBrief({ admin: fakeAiBudget().admin, userId: "user-1", generate: neverCalled }, input);
        expect(off).toEqual({ ok: false, error: BRIEF_AI_OFF_MESSAGE });

        // What PostgREST answers when the function is not there.
        const missing = { rpc: async () => ({ data: null, error: { code: "PGRST202", message: "Could not find the function public.ai_generation_reserve" } }) };
        const unavailable = await suggestBrief({ admin: missing as never, userId: "user-1", generate: neverCalled }, input);
        expect(unavailable).toEqual({ ok: false, error: AI_UNAVAILABLE_ERROR });
        expect(unavailable).not.toEqual(off);
        expect(neverCalled).not.toHaveBeenCalled();
    });
});

describe("read-only preflight: fail closed", () => {
    it("passes a migrated project with the feature off, in disabled mode", async () => {
        expect(await problems(asMigrated())).toEqual([]);
        await expect(assertBriefAiPrerequisites(inspect(asMigrated()), "disabled")).resolves.toBeUndefined();
    });

    it("a project with no budget migrations is blocked, never treated as switched off", async () => {
        const bare: Project = { features: null, limits: null, attempts: false, functions: {} };
        const found = await problems(bare);
        expect(found.filter((problem) => problem.startsWith("PREREQUISITE BLOCKED"))).toHaveLength(5);
        for (const name of [tables.features, tables.limits, tables.attempts, "ai_generation_reserve", "ai_generation_finish"]) expect(found.join("\n"), name).toContain(name);
        for (const migration of migrations) expect(found.at(-1)).toContain(migration);
        expect(found.at(-1)).toContain("will not apply them and will not change any setting");

        const failure = await assertBriefAiPrerequisites(inspect(bare), "disabled").catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(E2EConfigurationError);
        expect((failure as Error).message).toContain("E2E CONFIGURATION FAILURE");
        expect((failure as Error).message).toContain("Brief AI mode: disabled.");
    });

    it.each([
        ["the features table", { features: null }, tables.features],
        ["the limits table", { limits: null }, tables.limits],
        ["the attempts table", { attempts: false }, tables.attempts],
        ["the reserve function", { functions: { ai_generation_finish: [...functions.ai_generation_finish] } }, "ai_generation_reserve does not exist"],
        ["the finish function", { functions: { ai_generation_reserve: [...functions.ai_generation_reserve] } }, "ai_generation_finish does not exist"],
        ["a reserve function of an older shape", { functions: { ai_generation_reserve: ["p_user_id", "p_feature", "p_reserve_output_tokens"], ai_generation_finish: [...functions.ai_generation_finish] } }, "does not take p_source_fingerprint"],
        ["an allowance row", { limits: ["contractor"] }, "no 'global' allowance row"],
        ["the feature's row (the last migration not applied)", { features: [{ feature: "profile.rewrite", enabled: true }] }, `no row for ${feature}`],
    ] as const)("missing %s blocks the run", async (_label, overrides, expected) => {
        const found = await problems(asMigrated(overrides as Partial<Project>));
        expect(found.join("\n")).toContain(expected);
        expect(found.some((problem) => problem.startsWith("PREREQUISITE BLOCKED"))).toBe(true);
    });

    it("the feature switched on is the wrong state for disabled mode, and the remedy is never to switch it off", async () => {
        const found = await problems(asMigrated({ features: [{ feature, enabled: true }] }));
        expect(found).toHaveLength(1);
        expect(found[0]).toContain("WRONG STATE");
        expect(found[0]).toContain("Do not switch it off to make this pass");
    });

    it.each([null, undefined, "true", "false", 1, 0, {}])("an unrecognised state (%j) is blocked", async (enabled) => {
        for (const mode of ["disabled", "enabled-with-stub"] as const) {
            const found = await problems(asMigrated({ features: [{ feature, enabled }] }), mode);
            expect(found.join("\n"), mode).toContain("its state is not recognised");
        }
    });

    it("enabled-with-stub mode needs the feature verifiably on, and the harness will not switch it on", async () => {
        const off = await problems(asMigrated(), "enabled-with-stub");
        expect(off).toHaveLength(1);
        expect(off[0]).toContain("WRONG STATE");
        expect(off[0]).toContain("The harness will not switch it on");
        expect(await problems(asMigrated({ features: [{ feature, enabled: true }] }), "enabled-with-stub")).toEqual([]);
        // On, but without the rest of the budget, is still blocked.
        expect((await problems(asMigrated({ features: [{ feature, enabled: true }], functions: {} }), "enabled-with-stub")).join("\n")).toContain("ai_generation_reserve does not exist");
    });

    it("a read that throws is a failed read, and nothing it carried is printed", async () => {
        const boom = async (): Promise<never> => { throw new Error(`connect failed for https://x.supabase.co with apikey ${SECRET}`); };
        const inspector: BudgetInspector = { feature: boom, limitScopes: boom, attemptsReadable: boom, functionArguments: boom };
        const failure = await assertBriefAiPrerequisites(inspector, "disabled").catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(E2EConfigurationError);
        const message = (failure as Error).message;
        expect(message).toContain("(unreadable)");
        expect(message).not.toContain(SECRET);
        expect(message).not.toContain("supabase.co");
        expect(message).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    });
});

describe("the real inspector, over a pretend network", () => {
    const approved = APPROVED_DISPOSABLE_PROJECT.ref;
    const env = (overrides: Partial<E2EEnv> = {}): E2EEnv => ({
        baseUrl: "http://127.0.0.1:3100", stubUrl: "http://127.0.0.1:3199", projectRef: approved, supabaseUrl: `https://${approved}.supabase.co`,
        supabaseAnonKey: "anon", supabaseServiceRoleKey: SECRET, runId: "test", evidence: false, ...overrides,
    });
    const openApi = (names: string[]) => ({
        swagger: "2.0",
        paths: Object.fromEntries(names.map((name) => [`/rpc/${name}`, { post: { parameters: [{ in: "body", name: "args", schema: { type: "object", properties: Object.fromEntries(functions[name as keyof typeof functions].map((argument) => [argument, { type: "string" }])) } }] } }])),
    });

    /** Answers like PostgREST would for the given project, and records every request made. */
    function network(project: Project) {
        const requests: Array<{ method: string; path: string; host: string }> = [];
        const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
        vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
            const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
            requests.push({ method, path: url.pathname, host: url.host });
            const table = url.pathname.replace("/rest/v1/", "");
            const missing = json(404, { code: "PGRST205", message: `Could not find the table 'public.${table}' in the schema cache` });
            if (url.pathname === "/rest/v1/") return json(200, openApi(Object.keys(project.functions).filter((name) => project.functions[name])));
            if (table === tables.features) {
                if (!project.features) return missing;
                const wanted = (url.searchParams.get("feature") ?? "").replace("eq.", "");
                return json(200, project.features.filter((row) => row.feature === wanted).map((row) => ({ enabled: row.enabled })));
            }
            if (table === tables.limits) return project.limits ? json(200, project.limits.map((scope) => ({ scope }))) : missing;
            if (table === tables.attempts) return project.attempts ? json(200, []) : missing;
            return json(404, { code: "PGRST000", message: "not stubbed" });
        });
        return requests;
    }

    it("finds a migrated, switched-off project acceptable, using only reads and never calling a function", async () => {
        const requests = network(asMigrated());
        expect(await briefAiPrerequisiteProblems(budgetInspector(env()), "disabled")).toEqual([]);
        expect(requests.length).toBeGreaterThanOrEqual(4);
        for (const request of requests) {
            expect(["GET", "HEAD"], `${request.method} ${request.path}`).toContain(request.method);
            expect(request.path.startsWith("/rest/v1/rpc/"), request.path).toBe(false);
            expect(request.host).toBe(`${approved}.supabase.co`);
        }
        // The API description is fetched once for both functions.
        expect(requests.filter((request) => request.path === "/rest/v1/")).toHaveLength(1);
    });

    it("reports missing tables and functions from what the API answers, with codes only", async () => {
        network({ features: null, limits: null, attempts: false, functions: {} });
        const found = (await briefAiPrerequisiteProblems(budgetInspector(env()), "disabled")).join("\n");
        expect(found).toContain(`the table ${tables.features} could not be read (PGRST205)`);
        expect(found).toContain("ai_generation_reserve does not exist");
        expect(found).not.toContain("schema cache");
        expect(found).not.toContain(SECRET);
    });

    it("reads the feature's real state", async () => {
        network(asMigrated({ features: [{ feature, enabled: true }] }));
        expect((await briefAiPrerequisiteProblems(budgetInspector(env()), "disabled")).join("\n")).toContain("WRONG STATE");
        expect(await briefAiPrerequisiteProblems(budgetInspector(env()), "enabled-with-stub")).toEqual([]);
    });

    it("an API description that cannot be read blocks the run instead of assuming the functions exist", async () => {
        const requests = network(asMigrated());
        const pretend = globalThis.fetch;
        vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => (new URL(String(input instanceof Request ? input.url : input)).pathname === "/rest/v1/" ? new Response("no", { status: 401 }) : pretend(input, init)));
        const found = (await briefAiPrerequisiteProblems(budgetInspector(env()), "disabled")).join("\n");
        expect(found).toContain("the database function ai_generation_reserve could not be checked (HTTP 401)");
        expect(requests.every((request) => request.method === "GET" || request.method === "HEAD")).toBe(true);
    });

    it("refuses any project but the approved disposable one before a single request", () => {
        const requests = network(asMigrated());
        const other = "abcdefghijklmnopqrst";
        expect(() => budgetInspector(env({ supabaseUrl: `https://${other}.supabase.co` }))).toThrow("not the approved disposable project");
        expect(() => budgetInspector(env({ projectRef: other }))).toThrow("not the approved disposable project");
        expect(requests).toEqual([]);
    });

    it("reads argument names from the API description, and null when the function is not offered", () => {
        const description = openApi(["ai_generation_reserve"]);
        expect(functionArgumentsFromApiDescription(description, "ai_generation_reserve")).toEqual([...functions.ai_generation_reserve]);
        expect(functionArgumentsFromApiDescription(description, "ai_generation_finish")).toBeNull();
        for (const nothing of [null, undefined, {}, { paths: null }, "text"]) expect(functionArgumentsFromApiDescription(nothing, "ai_generation_reserve")).toBeNull();
    });
});

describe("the harness cannot change the disposable project's settings", () => {
    const harness = ["e2e/support/backend.ts", "e2e/support/brief-ai-mode.ts", "e2e/support/global-setup.ts", "e2e/support/harness.ts", "e2e/phase1-journey.spec.ts"];

    it("no harness file inserts, updates, deletes or calls a database function", () => {
        for (const file of harness) {
            const code = read(file).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
            expect(code, file).not.toMatch(/\.(insert|update|upsert|delete|rpc)\s*\(/);
            expect(code, file).not.toMatch(/method:\s*["'](PATCH|PUT|DELETE)["']/);
        }
        // The only POSTs the support code makes are to the loopback provider stub.
        for (const file of harness.slice(0, 4)) {
            for (const match of read(file).matchAll(/fetch\(([^,)]+),\s*\{\s*method:\s*"POST"/g)) expect(match[1], file).toContain("env.stubUrl");
        }
    });

    it("the check runs after the target is proved and before anything else, and nothing skips the journey", () => {
        const setup = read("e2e/support/global-setup.ts");
        const order = ["refs[0] !== approved", "did not answer its own key", "assertBriefAiPrerequisites(budgetInspector(env), readBriefAiMode())"].map((marker) => setup.indexOf(marker));
        expect(order.every((index) => index > 0)).toBe(true);
        expect(order).toEqual([...order].sort((a, b) => a - b));

        const journey = read("e2e/phase1-journey.spec.ts");
        expect(journey).not.toMatch(/test\.(skip|fixme|fail)\b/);
        expect(journey.indexOf("syntheticUserExists(userId, email)")).toBeGreaterThan(0);
        // The disabled branch asserts the exact message; the enabled branch still asserts a pending suggestion and its use.
        expect(journey).toContain("await expect(refusal).toHaveText(briefAi.message!)");
        expect(journey).toContain("await expect(suggestion).toHaveCount(0)");
        expect(journey).toContain('await expect(suggestion.getByText("Suggestion · not applied")).toBeVisible()');
        expect(journey).toContain("await expect(description).toHaveValue(`${JOB.description} ${AI_MARKER}`)");
        // Both branches rejoin the same journey: every later step is still there.
        const after = journey.slice(journey.indexOf("recorder.results.parity.briefAi"));
        for (const step of ["simple estimate with explicit preliminaries", "Save and build the price", "publicationRecords(projectId)"]) expect(after, step).toContain(step);
    });
});

describe("the manual path carries the same job", () => {
    it("picks by hand exactly the trades the stub would have suggested, and they are real trades", () => {
        const stub = read("e2e/support/provider-stubs.mjs");
        const suggested = Array.from(stub.matchAll(/suggestedTrades: (\[[^\]]+\])/g)).map((match) => JSON.parse(match[1]));
        expect(suggested.length).toBeGreaterThanOrEqual(2);
        for (const trades of suggested) expect(trades).toEqual(JOB.trades);
        for (const trade of JOB.trades) expect(BRIEF_TRADES).toContain(trade);
    });

    it("the stub still answers both the structured request and the older single prompt", () => {
        const stub = read("e2e/support/provider-stubs.mjs");
        expect(stub).toContain('system.includes("write up a job they have described")');
        expect(stub).toContain(`prompt.includes("Contractor's description:")`);
        expect(read("src/lib/cohort-ai/brief-suggest.ts")).toContain("write up a job they have described");
    });
});
