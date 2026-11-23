// @ts-check
import { REVIEW_PROJECT } from "./review-project.mjs";
/**
 * Supabase target guard.
 *
 * A preview or E2E build must never be compiled against, or started against,
 * the production database. This module is the one place that rule lives. It
 * is plain JavaScript so `next.config.mjs`, the post-build script and the
 * tests all run the same code.
 *
 * The rule, for a preview or E2E context:
 *  - the context declares the disposable project it may use, in
 *    CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF;
 *  - the Supabase URL and both keys must be present and belong to it;
 *  - nothing may name the production project.
 * Anything missing or unprovable is a failure. Production is never checked
 * and can never be stopped by this guard.
 *
 * Nothing here prints or returns a key. Project references are public
 * identifiers (they are in the URL of every page) and are the only values
 * that appear in a message.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/** The live project. The canonical production reference. */
export const PRODUCTION_SUPABASE_PROJECT_REF = "pudadynieiuypxeoimnz";

/** Declares which disposable project a preview or E2E context may use. */
export const NONPROD_REF_VARIABLE = "CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF";

/** States the context where Vercel does not: "preview" or "e2e". Ignored on Vercel. */
export const DEPLOY_CONTEXT_VARIABLE = "CONSTRUCTA_DEPLOY_CONTEXT";

const FAILURE_HEADING = "SUPABASE TARGET CHECK FAILED";
const REF_SHAPE = /^[a-z0-9]{20}$/;
const SUPABASE_HOST = /\b([a-z0-9]{20})\.supabase\.co\b/g;
/** Free text set by the platform (branch names, commit messages). Not configuration. */
const METADATA_VARIABLE = /^(VERCEL_GIT_|GITHUB_|npm_)/;

/** @typedef {Record<string, string | undefined>} Env */
/** Ephemeral local Supabase stack (Supabase CLI on loopback). Not a hosted project. */
export const EPHEMERAL_REPLAY_CONTEXT = "e2e-replay";

/** @typedef {"production" | "preview" | "e2e" | "e2e-replay" | "development" | "unspecified"} DeployContextName */
/** @typedef {{ context: DeployContextName, guarded: boolean, source: string }} DeployContext */
/** @typedef {{ context: DeployContextName, guarded: boolean, ok: boolean, problems: string[], summary: string }} TargetCheck */

/** @param {unknown} value */
function text(value) {
    return typeof value === "string" ? value.trim() : "";
}

/**
 * Which kind of deployment this is.
 *
 * On Vercel, VERCEL_ENV decides and nothing else can: it is set by the
 * platform, so a preview cannot declare itself production. Anything on
 * Vercel that is not production or local development is treated as a
 * preview. Elsewhere (the E2E run, a self-hosted preview) the context is
 * declared, and an unrecognised declaration is treated as a preview.
 *
 * @param {Env} env
 * @returns {DeployContext}
 */
export function resolveDeployContext(env) {
    const vercelEnv = text(env.VERCEL_ENV).toLowerCase();
    if (text(env.VERCEL) === "1" || vercelEnv !== "") {
        if (vercelEnv === "production") return { context: "production", guarded: false, source: "VERCEL_ENV" };
        if (vercelEnv === "development") return { context: "development", guarded: false, source: "VERCEL_ENV" };
        return { context: "preview", guarded: true, source: vercelEnv ? "VERCEL_ENV" : "VERCEL" };
    }

    const declared = text(env[DEPLOY_CONTEXT_VARIABLE]).toLowerCase();
    if (declared === "") return { context: "unspecified", guarded: false, source: "none" };
    if (declared === "production" || declared === "development") {
        return { context: declared, guarded: false, source: DEPLOY_CONTEXT_VARIABLE };
    }
    if (declared === EPHEMERAL_REPLAY_CONTEXT) {
        return { context: EPHEMERAL_REPLAY_CONTEXT, guarded: true, source: DEPLOY_CONTEXT_VARIABLE };
    }
    return { context: declared === "e2e" ? "e2e" : "preview", guarded: true, source: DEPLOY_CONTEXT_VARIABLE };
}

/**
 * The claims of a Supabase API key that is a JWT, or null for any other key
 * format. Only `ref` and `role` are read.
 *
 * @param {string} token
 * @returns {{ ref?: unknown, role?: unknown } | null}
 */
function keyClaims(token) {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    try {
        const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
        return claims && typeof claims === "object" ? claims : null;
    } catch {
        return null;
    }
}

/**
 * The project a Supabase URL points at, or null when it is not a plain
 * `https://<ref>.supabase.co` address whose project can be read.
 *
 * @param {string} value
 */
function urlProjectRef(value) {
    try {
        const url = new URL(value);
        const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
        return url.protocol === "https:" && match ? match[1] : null;
    } catch {
        return null;
    }
}

/**
 * Whether a Supabase API URL is the guarded local ephemeral replay stack.
 *
 * @param {string} value
 * @param {DeployContextName} context
 */
function ephemeralReplayApiUrl(value, context) {
    if (context !== EPHEMERAL_REPLAY_CONTEXT) return false;
    return loopbackSupabaseApiUrl(value);
}

/**
 * Loopback Supabase API (local CLI). Not valid for preview, production, or Vercel.
 *
 * @param {string} value
 */
function loopbackSupabaseApiUrl(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== "http:") return false;
        if (!["127.0.0.1", "localhost"].includes(url.hostname)) return false;
        return url.port === "" || url.port === "54321";
    } catch {
        return false;
    }
}

/**
 * Checks one API key and returns how to describe it in the report.
 *
 * @param {{ name: string, value: string, role: "anon" | "service_role", expected: string | null, problems: string[] }} input
 */
function checkKey({ name, value, role, expected, problems }) {
    if (!value) {
        problems.push(`${name} is not set. A preview needs its own disposable project's keys.`);
        return "not set";
    }
    const claims = keyClaims(value);
    if (!claims || typeof claims.ref !== "string") {
        // The newer key formats carry no project reference. Where a request
        // goes is decided by the URL, which is checked; a key of the wrong
        // kind in this variable is still refused.
        const wrongKind = role === "anon" ? value.startsWith("sb_secret_") : value.startsWith("sb_publishable_");
        if (wrongKind) problems.push(`${name} holds the wrong kind of key for this variable.`);
        return "not stated by this key format";
    }
    if (claims.ref === PRODUCTION_SUPABASE_PROJECT_REF) {
        problems.push(`${name} is a key of the production project.`);
    } else if (expected && claims.ref !== expected) {
        problems.push(`${name} belongs to project ${claims.ref}, not the declared disposable project.`);
    }
    if (claims.role !== role) problems.push(`${name} does not hold a key with the ${role} role.`);
    return claims.ref;
}

/**
 * Any other variable that addresses the production project: a database or
 * pooler connection string, a second URL, a key under another name.
 *
 * @param {Env} env
 * @param {string[]} problems
 */
function checkOtherVariables(env, problems) {
    const production = PRODUCTION_SUPABASE_PROJECT_REF;
    const handled = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", NONPROD_REF_VARIABLE]);
    for (const [name, raw] of Object.entries(env)) {
        if (handled.has(name) || METADATA_VARIABLE.test(name) || typeof raw !== "string" || raw === "") continue;
        const addressesProduction = raw.includes(`${production}.supabase.`) || raw.includes(`postgres.${production}`);
        if (addressesProduction || keyClaims(raw)?.ref === production) {
            problems.push(`${name} points at the production Supabase project.`);
        }
    }
}

/**
 * Whether this environment may be built or started.
 *
 * @param {Env} env
 * @returns {TargetCheck}
 */
export function checkSupabaseTarget(env) {
    const { context, guarded, source } = resolveDeployContext(env);
    const label = `context=${context} (from ${source})`;

    if (!guarded) {
        return {
            context,
            guarded,
            ok: true,
            problems: [],
            summary: `Supabase target check: ${label}. Not a preview or E2E context, so nothing is enforced.`,
        };
    }

    /** @type {string[]} */
    const problems = [];
    const declared = text(env[NONPROD_REF_VARIABLE]);
    let expected = null;
    if (!declared) {
        problems.push(`${NONPROD_REF_VARIABLE} is not set. State the disposable project this ${context} may use.`);
    } else if (!REF_SHAPE.test(declared)) {
        problems.push(`${NONPROD_REF_VARIABLE} is not a Supabase project reference.`);
    } else if (declared === PRODUCTION_SUPABASE_PROJECT_REF) {
        problems.push(`${NONPROD_REF_VARIABLE} names the production project.`);
    } else {
        expected = declared;
    }

    const url = text(env.NEXT_PUBLIC_SUPABASE_URL);
    let urlRef = "not set";
    if (!url) {
        problems.push("NEXT_PUBLIC_SUPABASE_URL is not set. A preview needs its own disposable project.");
    } else if (loopbackSupabaseApiUrl(url)) {
        if (context === "preview" || context === "e2e") {
            problems.push(
                "NEXT_PUBLIC_SUPABASE_URL is a loopback test address. That is only permitted in the e2e-replay context, not preview or hosted E2E.",
            );
        } else if (text(env.VERCEL) === "1" || text(env.VERCEL_ENV) !== "") {
            problems.push("Ephemeral replay loopback URLs cannot be used on Vercel preview or production deployments.");
        } else if (context !== EPHEMERAL_REPLAY_CONTEXT) {
            problems.push(
                `NEXT_PUBLIC_SUPABASE_URL is a loopback test address. Set ${DEPLOY_CONTEXT_VARIABLE}=${EPHEMERAL_REPLAY_CONTEXT} only for local ephemeral tests.`,
            );
        }
    }
    if (url && ephemeralReplayApiUrl(url, context)) {
        urlRef = expected ?? "local-ephemeral-replay";
        if (!expected) {
            problems.push(`${NONPROD_REF_VARIABLE} must be set for ${EPHEMERAL_REPLAY_CONTEXT}; the local API URL does not carry a project reference.`);
        }
    } else {
        const ref = urlProjectRef(url);
        urlRef = ref ?? "unreadable";
        if (!ref) {
            problems.push("NEXT_PUBLIC_SUPABASE_URL is not an https://<project>.supabase.co address, so its project cannot be proved.");
        } else if (ref === PRODUCTION_SUPABASE_PROJECT_REF) {
            problems.push("NEXT_PUBLIC_SUPABASE_URL points at the production project.");
        } else if (expected && ref !== expected) {
            problems.push(`NEXT_PUBLIC_SUPABASE_URL points at project ${ref}, not the declared disposable project.`);
        }
    }

    const anonRef = checkKey({ name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: text(env.NEXT_PUBLIC_SUPABASE_ANON_KEY), role: "anon", expected, problems });
    const serviceRef = checkKey({ name: "SUPABASE_SERVICE_ROLE_KEY", value: text(env.SUPABASE_SERVICE_ROLE_KEY), role: "service_role", expected, problems });
    checkOtherVariables(env, problems);

    const ok = problems.length === 0;
    return {
        context,
        guarded,
        ok,
        problems,
        summary: `Supabase target check: ${label} expected=${expected ?? "not declared"} url=${urlRef} anon-key=${anonRef} service-key=${serviceRef} -> ${ok ? "PASS" : "FAIL"}`,
    };
}

export class SupabaseTargetError extends Error {
    /** @param {string} stage @param {string[]} problems */
    constructor(stage, problems) {
        super(
            [
                `${FAILURE_HEADING} (${stage}) - stopped before the wrong database could be used.`,
                ...problems.map((problem) => `  - ${problem}`),
                "See DEVELOPMENT.md, \"Preview and E2E database isolation\".",
            ].join("\n"),
        );
        this.name = "SupabaseTargetError";
    }
}

/**
 * Runs the check and throws when it fails. Called from `next.config.mjs`, so
 * it runs for every `next build` and `next start` whatever command started
 * them. The one-line result is the deployment's evidence of which project
 * it was bound to.
 *
 * @param {Env} env
 * @param {{ log?: (line: string) => void }} [options]
 * @returns {TargetCheck}
 */
export function assertSupabaseTarget(env, options = {}) {
    const result = checkSupabaseTarget(env);
    // Build workers load the configuration again; say it once.
    if (env.CONSTRUCTA_SUPABASE_TARGET_REPORTED !== result.summary) {
        (options.log ?? console.log)(result.summary);
        env.CONSTRUCTA_SUPABASE_TARGET_REPORTED = result.summary;
    }
    if (!result.ok) throw new SupabaseTargetError("configuration", result.problems);
    return result;
}

// ── The compiled build ───────────────────────────────────────────────────────

/**
 * Every Supabase project reference compiled into a build, browser and server
 * output alike. The build cache is not part of what is deployed.
 *
 * @param {string} dir
 * @param {Set<string>} [found]
 * @returns {string[]}
 */
export function supabaseRefsInBuild(dir, found = new Set()) {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stats = statSync(full);
        if (stats.isDirectory()) {
            if (entry !== "cache") supabaseRefsInBuild(full, found);
        } else if (/\.(js|mjs|cjs|json|html|rsc|body|txt)$/.test(entry) && stats.size < 20_000_000) {
            for (const match of readFileSync(full, "utf8").matchAll(SUPABASE_HOST)) found.add(match[1]);
        }
    }
    return [...found].sort();
}

/**
 * Whether what was compiled is bound to the declared disposable project and
 * nothing else. This is the check on the browser's configuration: the public
 * URL is inlined into the bundle at build time, so the bundle is the truth.
 *
 * @param {Env} env
 * @param {string[]} refs
 * @returns {TargetCheck}
 */
export function checkCompiledTarget(env, refs) {
    const { context, guarded, source } = resolveDeployContext(env);
    const found = refs.length > 0 ? refs.join(", ") : "none";
    const label = `context=${context} (from ${source})`;
    if (!guarded) {
        return {
            context,
            guarded,
            ok: true,
            problems: [],
            summary: `Compiled Supabase target: ${label} projects in build=${found}. Not a preview or E2E context, so nothing is enforced.`,
        };
    }

    /** @type {string[]} */
    const problems = [];
    const declared = text(env[NONPROD_REF_VARIABLE]);
    const expected = REF_SHAPE.test(declared) && declared !== PRODUCTION_SUPABASE_PROJECT_REF ? declared : null;
    if (!expected) problems.push(`${NONPROD_REF_VARIABLE} does not name a disposable project, so the build cannot be checked against it.`);

    if (refs.includes(PRODUCTION_SUPABASE_PROJECT_REF)) {
        problems.push("The compiled build names the production Supabase project.");
    }
    if (refs.length === 0 && context !== EPHEMERAL_REPLAY_CONTEXT) {
        problems.push("The compiled build names no Supabase project, so its backend cannot be proved.");
    }
    // The app bundles an existing read-only review-policy origin even when that
    // mode is disabled. It is metadata, not the configured backend, ONLY for a
    // fully validated local replay. Hosted/preview/E2E and production checks
    // retain their existing refusal of additional project references.
    const inactiveReviewMetadata = context === EPHEMERAL_REPLAY_CONTEXT
        && checkSupabaseTarget(env).ok
        && loopbackSupabaseApiUrl(text(env.NEXT_PUBLIC_SUPABASE_URL))
        && text(env.CONSTRUCTA_REVIEW_ONLY) !== "1"
        && text(env.VERCEL) !== "1" && text(env.VERCEL_ENV) === "";
    const others = refs.filter((ref) => ref !== expected && ref !== PRODUCTION_SUPABASE_PROJECT_REF
        && !(inactiveReviewMetadata && ref === REVIEW_PROJECT));
    if (expected && others.length > 0) {
        problems.push(`The compiled build names a project other than the declared disposable one: ${others.join(", ")}.`);
    }

    const ok = problems.length === 0;
    return {
        context,
        guarded,
        ok,
        problems,
        summary: `Compiled Supabase target: ${label} expected=${expected ?? "not declared"} projects in build=${found} -> ${ok ? "PASS" : "FAIL"}`,
    };
}
