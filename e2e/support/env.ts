/**
 * Release-proof environment gate.
 *
 * The journey signs up, writes projects and publishes proposals, so it may
 * only ever run against the disposable Supabase project. Every check here
 * fails closed: a missing or mismatched value stops the run before a browser
 * is launched or a single request is sent.
 */

/** The only backend this harness may write to. Not a secret: it is the public project reference. */
export const APPROVED_DISPOSABLE_PROJECT = {
    name: "constructa-e2e-pr79",
    ref: "umqtzfsnyoofmgfbnrgv",
} as const;

/** Synthetic identities only (RFC 2606). */
export const SYNTHETIC_EMAIL_DOMAIN = "example.com";

const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const DEFAULT_STUB_URL = "http://127.0.0.1:3199";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export class E2EConfigurationError extends Error {
    constructor(problems: string[]) {
        super(
            [
                "E2E CONFIGURATION FAILURE - this is not a product result.",
                "The Phase 1 browser journey did not run because its environment is missing or unsafe:",
                ...problems.map((problem) => `  - ${problem}`),
                "See e2e/README.md for the required variables.",
            ].join("\n"),
        );
        this.name = "E2EConfigurationError";
    }
}

export interface E2EEnv {
    baseUrl: string;
    stubUrl: string;
    projectRef: string;
    supabaseUrl: string;
    supabaseAnonKey: string;
    supabaseServiceRoleKey: string;
    runId: string;
    evidence: boolean;
}

function jwtClaims(token: string): { ref?: unknown; role?: unknown } | null {
    const payload = token.split(".")[1];
    if (!payload) return null;
    try {
        return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
        return null;
    }
}

function loopbackUrl(value: string, name: string, problems: string[]): string {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:" || !LOOPBACK_HOSTS.has(url.hostname)) {
            problems.push(
                `${name} must be an http loopback address. The harness only tests a server it has started itself, ` +
                "because that is the only server whose backend it can prove.",
            );
        }
        return url.origin;
    } catch {
        problems.push(`${name} is not a valid URL.`);
        return value;
    }
}

export function readE2EEnv(source: NodeJS.ProcessEnv = process.env): E2EEnv {
    const problems: string[] = [];
    const approved = APPROVED_DISPOSABLE_PROJECT.ref;

    const required = (name: string): string => {
        const value = source[name]?.trim() ?? "";
        if (!value) problems.push(`${name} is not set.`);
        return value;
    };

    const projectRef = required("E2E_SUPABASE_PROJECT_REF");
    const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");

    if (projectRef && projectRef !== approved) {
        problems.push(
            `E2E_SUPABASE_PROJECT_REF does not name the approved disposable project (${APPROVED_DISPOSABLE_PROJECT.name}).`,
        );
    }

    if (supabaseUrl) {
        let host = "";
        try {
            const url = new URL(supabaseUrl);
            host = url.protocol === "https:" ? url.hostname : "";
        } catch {
            // Reported below.
        }
        if (host !== `${approved}.supabase.co`) {
            problems.push("NEXT_PUBLIC_SUPABASE_URL does not point at the approved disposable project.");
        }
    }

    const keyChecks: Array<[string, string, string]> = [
        ["NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey, "anon"],
        ["SUPABASE_SERVICE_ROLE_KEY", supabaseServiceRoleKey, "service_role"],
    ];
    for (const [name, key, role] of keyChecks) {
        if (!key) continue;
        const claims = jwtClaims(key);
        if (!claims || claims.ref !== approved || claims.role !== role) {
            problems.push(`${name} is not the ${role} key of the approved disposable project.`);
        }
    }

    const baseUrl = loopbackUrl(source.E2E_BASE_URL?.trim() || DEFAULT_BASE_URL, "E2E_BASE_URL", problems);
    const stubUrl = loopbackUrl(source.E2E_STUB_URL?.trim() || DEFAULT_STUB_URL, "E2E_STUB_URL", problems);

    if (problems.length > 0) throw new E2EConfigurationError(problems);

    return {
        baseUrl,
        stubUrl,
        projectRef,
        supabaseUrl: new URL(supabaseUrl).origin,
        supabaseAnonKey,
        supabaseServiceRoleKey,
        runId: source.E2E_RUN_ID?.trim() || new Date().toISOString().replace(/\D/g, "").slice(0, 14),
        evidence: source.E2E_EVIDENCE === "1",
    };
}

/**
 * The environment the application server is started with. Provider keys are
 * synthetic and their endpoints are the local stub, so the server cannot
 * reach a real AI or email provider whatever the operator's shell contains.
 */
export function serverEnv(env: E2EEnv): Record<string, string> {
    return {
        NEXT_PUBLIC_SUPABASE_URL: env.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.supabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: env.supabaseServiceRoleKey,
        NEXT_PUBLIC_SITE_URL: env.baseUrl,
        NEXT_PUBLIC_APP_URL: env.baseUrl,
        NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE: "cohort",
        NEXT_TELEMETRY_DISABLED: "1",
        // The application's own guard (src/lib/deployment/supabase-target.mjs)
        // then refuses to build or start against any other project.
        CONSTRUCTA_DEPLOY_CONTEXT: "e2e",
        CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF: env.projectRef,
        OPENAI_API_KEY: "e2e-synthetic-key",
        OPENAI_BASE_URL: `${env.stubUrl}/openai/v1`,
        RESEND_API_KEY: "re_e2e_synthetic_key",
        RESEND_BASE_URL: `${env.stubUrl}/resend`,
        RESEND_FROM_EMAIL: `proposals@${SYNTHETIC_EMAIL_DOMAIN}`,
        // Later-phase integrations stay unconfigured.
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
