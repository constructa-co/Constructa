/**
 * Ephemeral Supabase replay stack (local Supabase CLI on loopback).
 * No hosted disposable project, no protected QA credentials.
 */

import { E2EConfigurationError, SYNTHETIC_EMAIL_DOMAIN, type E2EEnv } from "./env";
const EPHEMERAL_REPLAY_CONTEXT = "e2e-replay";

/** Declared non-production project reference for ephemeral replay (public identifier shape). */
export const EPHEMERAL_REPLAY_PROJECT_REF = "ephemeralreplay00001";

export const DEFAULT_EPHEMERAL_API_URL = "http://127.0.0.1:54321";

/** Disposable auth seeded by scripts/ephemeral-replay/seed-disposable-auth.mjs (ephemeral stack only). */
export const EPHEMERAL_SEED_EMAIL = "d38-ephemeral@example.com";
export const EPHEMERAL_SEED_PASSWORD = "Ephemeral-D38-Replay-Only-Not-Production";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export type EphemeralAuthMode = "signup" | "seed";

export interface EphemeralReplayEnv extends E2EEnv {
    authMode: EphemeralAuthMode;
    signupEmail: string;
    signupPassword: string;
}

function jwtClaims(token: string): { ref?: unknown; role?: unknown; iss?: unknown } | null {
    const payload = token.split(".")[1];
    if (!payload) return null;
    try {
        return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
        return null;
    }
}

function loopbackApiUrl(value: string, name: string, problems: string[]): string {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname)) {
            problems.push(`${name} must be http://127.0.0.1:54321 (or localhost) for ephemeral replay.`);
        } else if (url.port !== "" && url.port !== "54321") {
            problems.push(`${name} must use port 54321 for the local Supabase API.`);
        }
        return url.origin;
    } catch {
        problems.push(`${name} is not a valid URL.`);
        return value;
    }
}

function loopbackAppUrl(value: string, name: string, problems: string[]): string {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname)) {
            problems.push(`${name} must be an http loopback address for the application under test.`);
        }
        return url.origin;
    } catch {
        problems.push(`${name} is not a valid URL.`);
        return value;
    }
}

/**
 * Fail-closed environment for D38 ephemeral replay. Requires keys from
 * `supabase status -o env` (or equivalent) and refuses hosted Supabase URLs.
 */
export function readEphemeralReplayEnv(source: Readonly<Record<string, string | undefined>> = process.env): EphemeralReplayEnv {
    const problems: string[] = [];
    const approved = EPHEMERAL_REPLAY_PROJECT_REF;

    const required = (name: string): string => {
        const value = source[name]?.trim() ?? "";
        if (!value) problems.push(`${name} is not set.`);
        return value;
    };

    if (source.E2E_D38_BACKEND?.trim() !== "ephemeral") {
        problems.push('E2E_D38_BACKEND must be "ephemeral" for the ephemeral replay harness.');
    }

    const projectRef = source.E2E_SUPABASE_PROJECT_REF?.trim() || approved;
    if (projectRef !== approved) {
        problems.push(`E2E_SUPABASE_PROJECT_REF must name the ephemeral replay reference (${approved}).`);
    }

    const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");

    const apiOrigin = supabaseUrl ? loopbackApiUrl(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL", problems) : supabaseUrl;
    if (supabaseUrl.includes(".supabase.co")) {
        problems.push("NEXT_PUBLIC_SUPABASE_URL must not point at a hosted Supabase project for ephemeral replay.");
    }

    for (const [name, key, role] of [
        ["NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey, "anon"],
        ["SUPABASE_SERVICE_ROLE_KEY", supabaseServiceRoleKey, "service_role"],
    ] as const) {
        if (!key) continue;
        const claims = jwtClaims(key);
        const isLocalCliKey = claims?.iss === "supabase-demo" && claims.ref === undefined;
        if (!claims || claims.role !== role || (claims.ref !== approved && !isLocalCliKey)) {
            problems.push(`${name} is not the ${role} key of the ephemeral replay project (${approved}).`);
        }
    }

    const baseUrl = loopbackAppUrl(source.E2E_BASE_URL?.trim() || "http://127.0.0.1:3100", "E2E_BASE_URL", problems);
    const stubUrl = loopbackAppUrl(source.E2E_STUB_URL?.trim() || "http://127.0.0.1:3199", "E2E_STUB_URL", problems);

    const authMode: EphemeralAuthMode = source.E2E_D38_AUTH?.trim() === "seed" ? "seed" : "signup";
    const runId = source.E2E_RUN_ID?.trim() || new Date().toISOString().replace(/\D/g, "").slice(0, 14);
    const signupEmail =
        authMode === "seed"
            ? EPHEMERAL_SEED_EMAIL
            : source.E2E_D38_SIGNUP_EMAIL?.trim() || `d38-e2e-${runId}@${SYNTHETIC_EMAIL_DOMAIN}`;
    const signupPassword =
        authMode === "seed" ? EPHEMERAL_SEED_PASSWORD : source.E2E_D38_SIGNUP_PASSWORD?.trim() || `D38-Ephemeral-${runId}!`;

    if (!signupEmail.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) {
        problems.push(`Ephemeral replay identities must use @${SYNTHETIC_EMAIL_DOMAIN}.`);
    }

    if (problems.length > 0) throw new E2EConfigurationError(problems);

    return {
        baseUrl,
        stubUrl,
        projectRef: approved,
        supabaseUrl: apiOrigin,
        supabaseAnonKey,
        supabaseServiceRoleKey,
        runId,
        evidence: source.E2E_EVIDENCE === "1",
        authMode,
        signupEmail,
        signupPassword,
    };
}

/** Application server environment for ephemeral replay builds. */
export function ephemeralReplayServerEnv(env: EphemeralReplayEnv): Record<string, string> {
    return {
        NEXT_PUBLIC_SUPABASE_URL: env.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.supabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: env.supabaseServiceRoleKey,
        NEXT_PUBLIC_SITE_URL: env.baseUrl,
        NEXT_PUBLIC_APP_URL: env.baseUrl,
        NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE: "cohort",
        NEXT_TELEMETRY_DISABLED: "1",
        CONSTRUCTA_DEPLOY_CONTEXT: EPHEMERAL_REPLAY_CONTEXT,
        CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF: env.projectRef,
        OPENAI_API_KEY: "e2e-synthetic-key",
        OPENAI_BASE_URL: `${env.stubUrl}/openai/v1`,
        RESEND_API_KEY: "re_e2e_synthetic_key",
        RESEND_BASE_URL: `${env.stubUrl}/resend`,
        RESEND_FROM_EMAIL: `proposals@${SYNTHETIC_EMAIL_DOMAIN}`,
        ADMIN_EMAIL: "",
        CRON_SECRET: "",
        XERO_CLIENT_ID: "",
        XERO_CLIENT_SECRET: "",
        XERO_REDIRECT_URI: "",
        NEXT_PUBLIC_XERO_CONFIGURED: "",
        PLAUSIBLE_API_KEY: "",
        SENTRY_DSN: "",
        NEXT_PUBLIC_SENTRY_DSN: "",
    };
}