import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PLATFORM_TERMS_CURRENT_REVISION, PLATFORM_TERMS_DOCUMENT_ID } from "../../src/lib/platform-terms";
import { APPROVED_DISPOSABLE_PROJECT, E2EConfigurationError } from "./env";
import {
    ConsentReadbackError,
    PLATFORM_CONSENT_CAPTURE,
    PLATFORM_CONSENT_OPERATOR_AUTHORITY_VAR,
    PLATFORM_CONSENT_RUNTIME_HELD_MESSAGE,
    PLATFORM_TERMS_MIGRATION_CONFIRMED_VAR,
    SYNTHETIC_PLATFORM_CONSENT_EMAIL_VAR,
    accessTokenFromSessionCookies,
    consentHandoffPlan,
    isForbiddenHostedPublishRequest,
    isPlatformConsentRuntimeHeld,
    isSignupServerActionPost,
    isSyntheticPlatformConsentQaLabel,
    readConsentReadback,
    readPlatformConsentEnv,
    readPlatformConsentPrerequisites,
    redactedError,
    verifyConsentReadback,
    type ConsentReadbackClient,
} from "./platform-consent-guard";

// Synthetic, offline fixtures only. Nothing here starts a browser or server or contacts a service.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = (relative: string) => readFileSync(path.join(root, relative), "utf8");
// Code only, so documentation that names a forbidden thing does not trip the static scans.
const code = (relative: string) => source(relative).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function key(ref: string, role: string): string {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss: "supabase", ref, role })}.not-a-real-signature`;
}

const approved = APPROVED_DISPOSABLE_PROJECT.ref;
const email = "e2e-qa-platform-consent-run1@example.com";
const userId = "0b6f1b4e-6a43-4c55-9d0e-2d7f0f3b9a11";
const windowStart = new Date("2026-11-02T10:00:00.000Z");
const windowEnd = new Date("2026-11-02T10:30:00.000Z");

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
    return {
        NODE_ENV: "test",
        E2E_SUPABASE_PROJECT_REF: approved,
        NEXT_PUBLIC_SUPABASE_URL: `https://${approved}.supabase.co`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key(approved, "anon"),
        SUPABASE_SERVICE_ROLE_KEY: key(approved, "service_role"),
        [SYNTHETIC_PLATFORM_CONSENT_EMAIL_VAR]: email,
        [PLATFORM_TERMS_MIGRATION_CONFIRMED_VAR]: "1",
        [PLATFORM_CONSENT_OPERATOR_AUTHORITY_VAR]: "1",
        ...overrides,
    };
}

const exactRow = {
    user_id: userId,
    terms_document: PLATFORM_TERMS_DOCUMENT_ID,
    accepted_revision: PLATFORM_TERMS_CURRENT_REVISION,
    accepted_at: "2026-11-02T10:12:03.456789+00:00",
};

const otherUserId = "1b6f1b4e-6a43-4c55-9d0e-2d7f0f3b9a11";
// A synthetic, unsigned token shape. The binding only ever trusts Auth's own answer for it.
const sessionToken = key(approved, "authenticated");

function readback(rows: unknown[], boundUserId: string = userId) {
    return verifyConsentReadback({ rows, boundUserId, windowStart, windowEnd });
}

/** A fake client over a table that also holds an unrelated user's row; it records every call in order. */
function fakeClient(options: { user?: unknown; authError?: unknown; readError?: unknown; table?: unknown[] } = {}) {
    const calls: string[] = [];
    const table = options.table ?? [exactRow, { ...exactRow, user_id: otherUserId }];
    const filters: Array<[string, unknown]> = [];
    const result = (limit: number) => ({
        data: options.readError ? null : table.filter((row) => filters.every(([column, value]) => (row as Record<string, unknown>)[column] === value)).slice(0, limit),
        error: options.readError ?? null,
    });
    const filter = {
        eq(column: string, value: unknown) { calls.push(`eq:${column}:${String(value)}`); filters.push([column, value]); return filter; },
        async limit(count: number) { calls.push(`limit:${count}`); return result(count); },
    };
    const client: ConsentReadbackClient = {
        auth: {
            getUser: async (token) => {
                calls.push(`getUser:${token === sessionToken ? "session" : "other"}`);
                return { data: { user: "user" in options ? options.user : { id: userId, email } }, error: options.authError ?? null };
            },
        },
        from: (table) => {
            calls.push(`from:${table}`);
            return { select: (columns) => { calls.push(`select:${columns}`); return filter; } };
        },
    };
    return { client, calls };
}

function bound(client: ConsentReadbackClient, accessToken = sessionToken) {
    return readConsentReadback({ client, accessToken, expectedEmail: email, windowStart, windowEnd });
}

function sessionCookie(session: object, name = `sb-${approved}-auth-token`) {
    return { name, value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` };
}

afterEach(() => vi.restoreAllMocks());

describe("platform-consent guard: environment and hold", () => {
    it("keeps the hosted runtime held in source", () => {
        expect(isPlatformConsentRuntimeHeld()).toBe(true);
        expect(() => readPlatformConsentEnv(baseEnv())).toThrow(PLATFORM_CONSENT_RUNTIME_HELD_MESSAGE);
    });

    it("needs the labelled identity and exact operator flags, and never a password", () => {
        const env = readPlatformConsentPrerequisites(baseEnv());
        expect(env.projectRef).toBe(approved);
        expect(env.signupEmail).toBe(email);
        expect(Object.keys(env).some((name) => /password/i.test(name))).toBe(false);
        expect(isSyntheticPlatformConsentQaLabel("e2e-qa-no-publish@example.com")).toBe(false);
        for (const patch of [
            { [SYNTHETIC_PLATFORM_CONSENT_EMAIL_VAR]: "someone@constructa.co" },
            { [PLATFORM_TERMS_MIGRATION_CONFIRMED_VAR]: "yes" },
            { [PLATFORM_CONSENT_OPERATOR_AUTHORITY_VAR]: undefined },
            { E2E_SUPABASE_PROJECT_REF: "abcdefghijklmnopqrst" },
        ]) {
            expect(() => readPlatformConsentPrerequisites(baseEnv(patch))).toThrow(E2EConfigurationError);
        }
    });

    it("importing and parsing the guard contacts no service", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network is forbidden here"));
        vi.resetModules();
        const guard = await import("./platform-consent-guard");
        guard.readPlatformConsentPrerequisites(baseEnv());
        expect(fetchSpy).not.toHaveBeenCalled();
        expect(code("e2e/support/platform-consent-guard.ts")).not.toMatch(/^import[^;]*@supabase\/supabase-js/m);
        expect(code("e2e/support/platform-consent-guard.ts")).not.toMatch(/child_process|keychain|find-generic-password|dotenv|\.env\.local/i);
    });
});

describe("platform-consent guard: signup observation", () => {
    const base = "http://127.0.0.1:3100";

    it("observes the server-action POST to /login, not a browser /auth/v1/signup call", () => {
        const action = { "next-action": "7f3a" };
        expect(isSignupServerActionPost({ url: `${base}/login`, method: "POST", headers: action }, base)).toBe(true);
        expect(isSignupServerActionPost({ url: `${base}/login?next=x`, method: "POST", headers: action }, base)).toBe(true);
        // The rejected runner waited for this; with a server action the browser never sends it.
        expect(isSignupServerActionPost({ url: `https://${approved}.supabase.co/auth/v1/signup`, method: "POST", headers: {} }, base)).toBe(false);
        expect(isSignupServerActionPost({ url: `${base}/login`, method: "POST", headers: {} }, base)).toBe(false);
        expect(isSignupServerActionPost({ url: `${base}/login`, method: "GET", headers: action }, base)).toBe(false);
        expect(isSignupServerActionPost({ url: "http://127.0.0.1:3999/login", method: "POST", headers: action }, base)).toBe(false);
        expect(isSignupServerActionPost({ url: `${base}/dashboard`, method: "POST", headers: action }, base)).toBe(false);
    });

    it("every signup outcome ends in a mandatory readback, with human handoffs only", () => {
        expect(consentHandoffPlan("created-and-recorded")).toEqual(["human-first-sign-in", "consent-readback"]);
        expect(consentHandoffPlan("confirmation-required")).toEqual([
            "human-email-confirmation", "human-sign-in-to-completion", "human-accept-completion", "consent-readback",
        ]);
        expect(consentHandoffPlan("consent-not-stored")).toEqual([
            "human-sign-in-to-completion", "human-accept-completion", "consent-readback",
        ]);
        for (const outcome of ["unknown", "", undefined, "signup-failed"]) {
            expect(() => consentHandoffPlan(outcome)).toThrow(ConsentReadbackError);
        }
    });

    it("keeps publication RPCs classified as forbidden", () => {
        const host = `https://${approved}.supabase.co`;
        expect(isForbiddenHostedPublishRequest(`${host}/rest/v1/rpc/publish_proposal_publication`, "POST")).toBe(true);
        expect(isForbiddenHostedPublishRequest(`${host}/rest/v1/rpc/save_phase1_brief`, "POST")).toBe(false);
    });
});

describe("platform-consent guard: exact persisted consent readback", () => {
    it("accepts exactly one row with the exact document, revision, identity and server time", () => {
        expect(readback([exactRow])).toEqual({
            userId,
            termsDocument: PLATFORM_TERMS_DOCUMENT_ID,
            acceptedRevision: PLATFORM_TERMS_CURRENT_REVISION,
            acceptedAt: "2026-11-02T10:12:03.456Z",
        });
    });

    it("never passes without a stored row or with an ambiguous set", () => {
        expect(() => readback([])).toThrow(ConsentReadbackError);
        expect(() => readback([exactRow, exactRow])).toThrow(/exactly one/);
        expect(() => readback(null as unknown as unknown[])).toThrow(ConsentReadbackError);
    });

    it("refuses a wrong or missing document, revision or timestamp", () => {
        for (const row of [
            { ...exactRow, terms_document: undefined },
            { ...exactRow, terms_document: "constructa-proposal-terms" },
            { ...exactRow, accepted_revision: "platform-tos-2025-01" },
            { ...exactRow, accepted_at: undefined },
            { ...exactRow, accepted_at: "yesterday" },
            { ...exactRow, accepted_at: "2026-11-02T10:12:03" },
            { ...exactRow, accepted_at: "2026-11-01T09:00:00Z" },
            { ...exactRow, accepted_at: "2026-11-02T12:00:00Z" },
        ]) {
            expect(() => readback([row]), JSON.stringify(row)).toThrow(ConsentReadbackError);
        }
    });

    it("refuses a row that is not the bound user's", () => {
        expect(() => readback([{ ...exactRow, user_id: otherUserId }])).toThrow(/bound identity/);
        expect(() => readback([{ ...exactRow, user_id: "not-a-uuid" }])).toThrow(ConsentReadbackError);
        expect(() => readback([exactRow], "not-a-uuid")).toThrow(ConsentReadbackError);
    });

    it("an invalid or mismatched identity binding fails before any consent query", async () => {
        for (const options of [
            { user: null },
            { user: { id: userId, email: "other-e2e-qa@example.com" } },
            { user: { id: "not-a-uuid", email } },
            { user: { id: userId } },
            { authError: { status: 401 } },
        ]) {
            const { client, calls } = fakeClient(options);
            await expect(bound(client), JSON.stringify(options)).rejects.toThrow(/identity/);
            expect(calls).toEqual(["getUser:session"]);
        }
        for (const token of ["", "not-a-jwt", undefined]) {
            const { client, calls } = fakeClient();
            const accessToken = token as string;
            await expect(readConsentReadback({ client, accessToken, expectedEmail: email, windowStart, windowEnd }))
                .rejects.toThrow(ConsentReadbackError);
            expect(calls).toEqual([]);
        }
    });

    it("queries only the bound user's row, so an unrelated user's row is never retrieved", async () => {
        const { client, calls } = fakeClient();
        const result = await bound(client);
        expect(result).toEqual({
            userId,
            termsDocument: PLATFORM_TERMS_DOCUMENT_ID,
            acceptedRevision: PLATFORM_TERMS_CURRENT_REVISION,
            acceptedAt: "2026-11-02T10:12:03.456Z",
        });
        expect(calls).toEqual([
            "getUser:session",
            "from:platform_terms_acceptances",
            "select:user_id, terms_document, accepted_revision, accepted_at",
            `eq:user_id:${userId}`,
            `eq:terms_document:${PLATFORM_TERMS_DOCUMENT_ID}`,
            "limit:2",
        ]);
        expect(calls.join(" ")).not.toContain(otherUserId);
    });

    it("document, revision and server time stay mandatory after binding, and read errors fail closed", async () => {
        await expect(bound(fakeClient({ table: [{ ...exactRow, accepted_revision: "platform-tos-2025-01" }] }).client)).rejects.toThrow(/revision/);
        await expect(bound(fakeClient({ table: [{ ...exactRow, accepted_at: "2026-11-01T09:00:00Z" }] }).client)).rejects.toThrow(/outside this run/);
        await expect(bound(fakeClient({ table: [{ ...exactRow, terms_document: "constructa-proposal-terms" }] }).client)).rejects.toThrow(/exactly one/);
        await expect(bound(fakeClient({ table: [] }).client)).rejects.toThrow(/exactly one/);
        await expect(bound(fakeClient({ readError: { code: "42501" } }).client)).rejects.toThrow(/could not be read/);
    });
});

describe("platform-consent guard: current session binding", () => {
    it("takes the access token from this project's session cookie, whole or chunked", () => {
        const session = { access_token: sessionToken, refresh_token: "synthetic-refresh" };
        expect(accessTokenFromSessionCookies([sessionCookie(session)], approved)).toBe(sessionToken);
        const whole = sessionCookie(session).value;
        const chunked = [
            { name: `sb-${approved}-auth-token.1`, value: whole.slice(40) },
            { name: "unrelated", value: "x" },
            { name: `sb-${approved}-auth-token.0`, value: whole.slice(0, 40) },
        ];
        expect(accessTokenFromSessionCookies(chunked, approved)).toBe(sessionToken);
        expect(accessTokenFromSessionCookies([{ name: `sb-${approved}-auth-token`, value: JSON.stringify(session) }], approved)).toBe(sessionToken);
    });

    it("refuses a missing, foreign or malformed session without echoing cookie values", () => {
        const session = { access_token: sessionToken };
        for (const cookies of [
            [],
            [sessionCookie(session, "sb-abcdefghijklmnopqrst-auth-token")],
            [{ name: `sb-${approved}-auth-token.1`, value: sessionCookie(session).value }],
            [{ name: `sb-${approved}-auth-token`, value: "base64-%%%" }],
            [sessionCookie({ access_token: "not-a-jwt" })],
        ]) {
            let message = "";
            try {
                accessTokenFromSessionCookies(cookies, approved);
            } catch (error) {
                expect(error).toBeInstanceOf(ConsentReadbackError);
                message = (error as Error).message;
            }
            expect(message, JSON.stringify(cookies.map((cookie) => cookie.name))).toMatch(/signed-in session/);
            for (const cookie of cookies) expect(message).not.toContain(cookie.value);
        }
    });
});

describe("platform-consent guard: no sensitive capture", () => {
    it("turns every trace, screenshot and video off", () => {
        expect(PLATFORM_CONSENT_CAPTURE).toEqual({ trace: "off", screenshot: "off", video: "off" });
        const config = code("playwright.platform-consent.config.ts");
        expect(config).toContain("...PLATFORM_CONSENT_CAPTURE");
        expect(config).toContain("headless: false");
        expect(config).not.toMatch(/retain-on-failure|only-on-failure|trace: "on"|video: "on"/);
    });

    it("redacts secrets, tokens and emails from errors and drops the stack", () => {
        const secret = key(approved, "service_role");
        const error = new Error(`failed for ${email} with ${secret} and Bearer abc.def.ghi password=hunter2`);
        const safe = redactedError(error, [secret, email]);
        expect(safe.message).not.toContain(email);
        expect(safe.message).not.toContain(secret);
        expect(safe.message).not.toContain("hunter2");
        expect(safe.message).not.toContain("abc.def.ghi");
        expect(safe.stack ?? "").not.toContain(email);
        expect(safe.cause).toBeUndefined();
    });

    it("the runner leaves consequential and credential steps to the human", () => {
        const runner = code("e2e/platform-consent.qa.ts");
        for (const forbidden of [
            /\.check\(/, /setChecked/, /\.fill\(/, /\.type\(/, /pressSequentially/, /postData/, /storageState/, /addCookies/,
            /tracing/, /\.screenshot\(/, /recordVideo/, /localStorage/, /sessionStorage/, /\.evaluate\(/,
            /password/i, /Create account/, /auth\/v1\/signup/, /Recorder/, /\.json\(\)/, /\.body\(\)/, /\.text\(\)/,
        ]) {
            expect(runner, String(forbidden)).not.toMatch(forbidden);
        }
        for (const required of ["isSignupServerActionPost", "consentHandoffPlan", "readConsentReadback", "redactedError"]) {
            expect(runner).toContain(required);
        }
        // The one narrow session read: this app's cookies go straight to the token extractor, in memory,
        // and the token joins the redaction list before anything else can fail.
        expect(runner.match(/\.cookies\(/g)).toHaveLength(1);
        expect(runner).toContain("accessTokenFromSessionCookies(await context.cookies(env.baseUrl), env.projectRef)");
        expect(runner).toMatch(/accessTokenFromSessionCookies\([^;]+;\s*secrets\.push\(accessToken\);/);
    });

    it("the readback uses no service-role, admin, user-list or time-window consent read", () => {
        for (const file of ["e2e/platform-consent.qa.ts", "e2e/support/platform-consent-guard.ts"]) {
            const text = code(file);
            for (const forbidden of [/listUsers/, /getUserById/, /auth\.admin/, /\.gte\(/, /\.rpc\(/]) {
                expect(text, `${file} ${forbidden}`).not.toMatch(forbidden);
            }
        }
        expect(code("e2e/platform-consent.qa.ts")).not.toMatch(/supabaseServiceRoleKey(?!,)/);
    });
});

describe("platform-consent guard: operator-only discovery", () => {
    it("no default Playwright or Vitest pattern discovers the runner", () => {
        const runner = "e2e/platform-consent.qa.ts";
        const configs = readdirSync(root).filter((name) => /^playwright\..*config\.ts$/.test(name));
        expect(configs.length).toBeGreaterThan(1);
        for (const name of configs) {
            const matches = [...source(name).matchAll(/testMatch:\s*"([^"]+)"/g)].map((match) => match[1]);
            for (const pattern of matches) {
                const discovers = path.matchesGlob(runner, pattern) || path.matchesGlob(runner, `e2e/${pattern}`);
                expect(discovers, `${name} ${pattern}`).toBe(name === "playwright.platform-consent.config.ts");
            }
        }
        const vitestIncludes = [...source("vitest.config.mts").matchAll(/"([^"]+\*[^"]*)"/g)].map((match) => match[1]);
        expect(vitestIncludes.length).toBeGreaterThan(0);
        for (const pattern of vitestIncludes) expect(path.matchesGlob(runner, pattern), pattern).toBe(false);
    });

    it("the operator config refuses to load while the runtime is held", async () => {
        await expect(import("../../playwright.platform-consent.config")).rejects.toThrow(PLATFORM_CONSENT_RUNTIME_HELD_MESSAGE);
    });
});
