/**
 * Fail-closed prerequisites, observation rules and consent readback for the
 * operator-assisted A023 platform-consent QA runner (e2e/platform-consent.qa.ts).
 *
 * The runner is operator-only: a human performs every consequential step
 * (typing credentials, ticking the platform terms, creating the account,
 * confirming email, signing in). The harness only observes non-secret state
 * and then requires an exact persisted consent record. It has no password and
 * records no trace, screenshot, video or request body. The readback binds the
 * human's current signed-in session to the labelled identity first, then
 * reads only that user's record through row-level security.
 *
 * Importing this module has no side effects: it starts no browser or server,
 * reads no Keychain, .env file or auth store and contacts no service. Only the
 * global setup and readConsentReadback talk to the disposable project, and
 * only when the operator config runs.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PLATFORM_TERMS_CURRENT_REVISION, PLATFORM_TERMS_DOCUMENT_ID } from "../../src/lib/platform-terms";
import { APPROVED_DISPOSABLE_PROJECT, E2EConfigurationError, readE2EEnv, type E2EEnv } from "./env";
import { isForbiddenHostedPublishRequest, isSyntheticQaLabel } from "./no-publish-guard";

/** Protected runtime variable names (values are never logged). */
export const SYNTHETIC_PLATFORM_CONSENT_EMAIL_VAR = "E2E_SYNTHETIC_PLATFORM_CONSENT_EMAIL";
export const PLATFORM_TERMS_MIGRATION_CONFIRMED_VAR = "E2E_PLATFORM_TERMS_MIGRATION_CONFIRMED";
export const PLATFORM_CONSENT_OPERATOR_AUTHORITY_VAR = "E2E_PLATFORM_CONSENT_OPERATOR_AUTHORITY";

/**
 * Hosted runtime stays held until an explicitly authorised headed run. Lifting
 * it is a deliberate code change, not an environment toggle.
 */
export function isPlatformConsentRuntimeHeld(): boolean {
    return true;
}

export const PLATFORM_CONSENT_RUNTIME_HELD_MESSAGE =
    "Platform-consent hosted runtime is NOT_RUN: signup, email and consent runs are held. " +
    "This operator-assisted runner is source-only until the hold is lifted in platform-consent-guard.ts.";

/** Nothing that could hold a credential, token or the typed form is ever recorded. */
export const PLATFORM_CONSENT_CAPTURE = { trace: "off", screenshot: "off", video: "off" } as const;

/** Allowed difference between this machine's clock and the database clock. */
export const CONSENT_READBACK_CLOCK_SKEW_MS = 5 * 60_000;

export interface PlatformConsentEnv extends E2EEnv {
    /** The labelled synthetic identity the human signs up with. No password is held. */
    signupEmail: string;
}

export class ConsentReadbackError extends Error {
    constructor(problem: string) {
        super(`A023 CONSENT NOT PROVED - ${problem}`);
        this.name = "ConsentReadbackError";
    }
}

/** Labelled synthetic mailbox dedicated to this variant (distinct from the no-publish sign-in mailbox). */
export function isSyntheticPlatformConsentQaLabel(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    if (!isSyntheticQaLabel(normalized)) return false;
    return normalized.slice(0, normalized.lastIndexOf("@")).includes("e2e-qa-platform-consent");
}

/** Every prerequisite except the source hold. Used by tests and by the operator config once lifted. */
export function readPlatformConsentPrerequisites(source: NodeJS.ProcessEnv = process.env): PlatformConsentEnv {
    const problems: string[] = [];
    let base: E2EEnv | null = null;
    try {
        base = readE2EEnv(source);
    } catch (error) {
        if (!(error instanceof E2EConfigurationError)) throw error;
        problems.push("The disposable-project environment check failed (see e2e/README.md).");
    }

    const signupEmail = source[SYNTHETIC_PLATFORM_CONSENT_EMAIL_VAR]?.trim() ?? "";
    if (!signupEmail) problems.push(`${SYNTHETIC_PLATFORM_CONSENT_EMAIL_VAR} is not set.`);
    else if (!isSyntheticPlatformConsentQaLabel(signupEmail)) {
        problems.push(`${SYNTHETIC_PLATFORM_CONSENT_EMAIL_VAR} must be a labelled synthetic identity (local part contains e2e-qa-platform-consent).`);
    }
    for (const name of [PLATFORM_TERMS_MIGRATION_CONFIRMED_VAR, PLATFORM_CONSENT_OPERATOR_AUTHORITY_VAR]) {
        if (source[name] !== "1") problems.push(`${name} must be exactly 1 (action-time operator confirmation).`);
    }

    if (problems.length > 0 || !base) throw new E2EConfigurationError(problems);
    return { ...base, signupEmail };
}

export function readPlatformConsentEnv(source: NodeJS.ProcessEnv = process.env): PlatformConsentEnv {
    if (isPlatformConsentRuntimeHeld()) throw new E2EConfigurationError([PLATFORM_CONSENT_RUNTIME_HELD_MESSAGE]);
    return readPlatformConsentPrerequisites(source);
}

/**
 * Signup is a Next.js server action: the browser POSTs to /login on the app
 * under test with a Next-Action header, and the server calls Supabase Auth.
 * The browser never sends /auth/v1/signup, so that is not what is observed.
 */
export function isSignupServerActionPost(
    request: { url: string; method: string; headers: Record<string, string | undefined> },
    baseUrl: string,
): boolean {
    if (request.method.toUpperCase() !== "POST") return false;
    if (!request.headers["next-action"] && !request.headers["Next-Action"]) return false;
    try {
        const url = new URL(request.url);
        return url.origin === new URL(baseUrl).origin && url.pathname === "/login";
    } catch {
        return false;
    }
}

export type ConsentStep =
    | "human-first-sign-in"
    | "human-email-confirmation"
    | "human-sign-in-to-completion"
    | "human-accept-completion"
    | "consent-readback";

/**
 * The handoffs each signup outcome needs. Every path ends in the readback:
 * there is no outcome for which a run can pass without a stored record.
 */
export function consentHandoffPlan(outcome: unknown): ConsentStep[] {
    switch (outcome) {
        case "created-and-recorded":
            return ["human-first-sign-in", "consent-readback"];
        case "confirmation-required":
            return ["human-email-confirmation", "human-sign-in-to-completion", "human-accept-completion", "consent-readback"];
        case "consent-not-stored":
            return ["human-sign-in-to-completion", "human-accept-completion", "consent-readback"];
        default:
            throw new ConsentReadbackError("the signup outcome was not one the product reports after creating an account.");
    }
}

export interface ConsentRecord {
    userId: string;
    termsDocument: string;
    acceptedRevision: string;
    acceptedAt: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIMESTAMP_WITH_ZONE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:?\d{2})?)$/;

/**
 * Exactly one persisted row for the already-bound identity, naming the trusted
 * document and current revision, with the database's own timestamp inside
 * this run. Anything else is a failure, never a skip.
 */
export function verifyConsentReadback(input: {
    rows: unknown;
    boundUserId: string;
    windowStart: Date;
    windowEnd: Date;
}): ConsentRecord {
    const { rows, boundUserId, windowStart, windowEnd } = input;
    if (!UUID.test(boundUserId)) throw new ConsentReadbackError("no bound identity to check the record against.");
    if (!Array.isArray(rows) || rows.length !== 1) {
        throw new ConsentReadbackError(`expected exactly one platform terms acceptance for the bound identity, found ${Array.isArray(rows) ? rows.length : "none"}.`);
    }
    const row = rows[0] as Record<string, unknown>;
    if (typeof row.user_id !== "string" || !UUID.test(row.user_id)) throw new ConsentReadbackError("the stored user id is missing or malformed.");
    if (row.user_id !== boundUserId) throw new ConsentReadbackError("the stored record does not belong to the bound identity.");
    if (row.terms_document !== PLATFORM_TERMS_DOCUMENT_ID) throw new ConsentReadbackError("the stored terms document is not the platform terms of service.");
    if (row.accepted_revision !== PLATFORM_TERMS_CURRENT_REVISION) throw new ConsentReadbackError("the stored revision is not the current trusted revision.");
    if (typeof row.accepted_at !== "string" || !TIMESTAMP_WITH_ZONE.test(row.accepted_at)) {
        throw new ConsentReadbackError("the stored acceptance time is missing or not a server timestamp with a zone.");
    }
    const acceptedAt = new Date(row.accepted_at);
    if (Number.isNaN(acceptedAt.getTime())
        || acceptedAt.getTime() < windowStart.getTime() - CONSENT_READBACK_CLOCK_SKEW_MS
        || acceptedAt.getTime() > windowEnd.getTime() + CONSENT_READBACK_CLOCK_SKEW_MS) {
        throw new ConsentReadbackError("the stored acceptance time is outside this run.");
    }
    return {
        userId: row.user_id,
        termsDocument: row.terms_document,
        acceptedRevision: row.accepted_revision,
        acceptedAt: acceptedAt.toISOString(),
    };
}

const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;

/**
 * The access token of the human's current signed-in session in the harness
 * browser, taken from this project's @supabase/ssr cookie (whole or chunked
 * as .0, .1, ..., optionally "base64-" encoded). It is held in memory only and
 * is not trusted on its own: readConsentReadback asks Supabase Auth who it
 * belongs to. Errors never include a cookie value.
 */
export function accessTokenFromSessionCookies(cookies: Array<{ name: string; value: string }>, projectRef: string): string {
    const missing = () => new ConsentReadbackError("no signed-in session for the disposable project in the harness browser.");
    const name = `sb-${projectRef}-auth-token`;
    let joined = cookies.find((cookie) => cookie.name === name)?.value ?? "";
    if (!joined) {
        const chunks: string[] = [];
        for (let index = 0; ; index += 1) {
            const chunk = cookies.find((cookie) => cookie.name === `${name}.${index}`);
            if (!chunk) break;
            chunks.push(chunk.value);
        }
        joined = chunks.join("");
    }
    if (!joined) throw missing();
    try {
        const text = joined.startsWith("base64-") ? Buffer.from(joined.slice(7), "base64url").toString("utf8") : decodeURIComponent(joined);
        const token = (JSON.parse(text) as { access_token?: unknown }).access_token;
        if (typeof token === "string" && JWT_SHAPE.test(token)) return token;
    } catch {
        // Malformed session cookie: reported below without its value.
    }
    throw missing();
}

/**
 * The narrow slice of a Supabase client the readback uses, so tests can supply
 * a fake. In the runner it is an anon-key client carrying the human's session
 * token, so row-level security limits every read to that user's own rows.
 */
export interface ConsentReadbackClient {
    auth: { getUser(jwt: string): PromiseLike<{ data: { user: unknown } | null; error: unknown }> };
    from(table: string): { select(columns: string): ConsentReadbackFilter };
}

export interface ConsentReadbackFilter {
    eq(column: string, value: string): ConsentReadbackFilter;
    limit(count: number): PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * Binds the labelled identity first: Supabase Auth must say the current
 * session belongs to a valid user id with the labelled email. Only then is
 * the consent table read, filtered to exactly that user and document.
 */
export async function readConsentReadback(input: {
    client: ConsentReadbackClient;
    accessToken: string;
    expectedEmail: string;
    windowStart: Date;
    windowEnd: Date;
}): Promise<ConsentRecord> {
    const { client, accessToken, expectedEmail, windowStart, windowEnd } = input;
    if (typeof accessToken !== "string" || !JWT_SHAPE.test(accessToken)) {
        throw new ConsentReadbackError("no signed-in session to bind the labelled identity to.");
    }
    const { data, error: authError } = await client.auth.getUser(accessToken);
    const user = data?.user as { id?: unknown; email?: unknown } | null | undefined;
    if (authError || !user || typeof user.id !== "string" || !UUID.test(user.id) || typeof user.email !== "string"
        || user.email.trim().toLowerCase() !== expectedEmail.trim().toLowerCase()) {
        throw new ConsentReadbackError("the signed-in session is not the labelled identity.");
    }
    const { data: rows, error } = await client
        .from("platform_terms_acceptances")
        .select("user_id, terms_document, accepted_revision, accepted_at")
        .eq("user_id", user.id)
        .eq("terms_document", PLATFORM_TERMS_DOCUMENT_ID)
        .limit(2);
    if (error || !Array.isArray(rows)) throw new ConsentReadbackError("the bound identity's consent record could not be read.");
    return verifyConsentReadback({ rows, boundUserId: user.id, windowStart, windowEnd });
}

const SECRET_SHAPES: RegExp[] = [
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
    /\bBearer\s+\S+/gi,
    /\b(password|passwd|pwd|token|apikey|api_key|secret)=\S+/gi,
    /\bsb_(secret|publishable)_[A-Za-z0-9_-]+/g,
    /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
];

/** A fresh error carrying only a redacted message: no stack, cause or original object. */
export function redactedError(error: unknown, secrets: string[]): Error {
    let message = error instanceof Error ? error.message : String(error);
    for (const secret of secrets) if (secret) message = message.split(secret).join("[redacted]");
    for (const shape of SECRET_SHAPES) message = message.replace(shape, "[redacted]");
    const safe = new Error(message);
    safe.name = error instanceof ConsentReadbackError || error instanceof E2EConfigurationError ? error.name : "RedactedError";
    safe.stack = `${safe.name}: ${message}`;
    return safe;
}

export { isForbiddenHostedPublishRequest };

const SUPABASE_HOST = /\b([a-z0-9]{20})\.supabase\.co\b/g;

function supabaseRefsInBuild(dir: string, found = new Set<string>()): Set<string> {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stats = statSync(full);
        if (stats.isDirectory()) {
            if (entry !== "cache") supabaseRefsInBuild(full, found);
        } else if (/\.(js|mjs|json|html|rsc)$/.test(entry) && stats.size < 20_000_000) {
            for (const match of readFileSync(full, "utf8").matchAll(SUPABASE_HOST)) found.add(match[1]);
        }
    }
    return found;
}

/**
 * Operator config global setup: hold, prerequisites, build backend proof and a
 * read-only probe that the consent table exists. Creates no account.
 */
export default async function platformConsentGlobalSetup() {
    const env = readPlatformConsentEnv();
    const refs = [...supabaseRefsInBuild(path.resolve(".next"))];
    if (refs.length !== 1 || refs[0] !== APPROVED_DISPOSABLE_PROJECT.ref) {
        throw new E2EConfigurationError(["The build under test is not proved to use only the approved disposable project."]);
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await supabase.from("platform_terms_acceptances").select("user_id").limit(0);
    if (error) {
        throw new E2EConfigurationError([
            "platform_terms_acceptances cannot be read on the disposable project. The readback is mandatory, so the run stops here.",
        ]);
    }
}
