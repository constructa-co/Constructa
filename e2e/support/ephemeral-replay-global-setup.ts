import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { checkCompiledTarget, PRODUCTION_SUPABASE_PROJECT_REF } from "../../src/lib/deployment/supabase-target.mjs";
import { E2EConfigurationError } from "./env";
import { readEphemeralReplayEnv } from "./ephemeral-replay-env";

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
 * Ephemeral replay: prove the build does not embed production, then check local auth API.
 */
export default async function globalSetup() {
    const env = readEphemeralReplayEnv();
    const refs = [...supabaseRefsInBuild(path.resolve(".next"))];

    if (refs.includes(PRODUCTION_SUPABASE_PROJECT_REF)) {
        throw new E2EConfigurationError(["The build under test names the production Supabase project. Rebuild with ephemeral env."]);
    }
    const compiled = checkCompiledTarget({ ...process.env,
        CONSTRUCTA_DEPLOY_CONTEXT: "e2e-replay",
        CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF: env.projectRef,
        NEXT_PUBLIC_SUPABASE_URL: env.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: env.supabaseAnonKey,
        SUPABASE_SERVICE_ROLE_KEY: env.supabaseServiceRoleKey,
    }, refs);
    if (!compiled.ok) throw new E2EConfigurationError(compiled.problems);

    const health = await fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabaseAnonKey } });
    if (!health.ok) {
        throw new E2EConfigurationError([
            `The local Supabase API did not answer on ${env.supabaseUrl} (HTTP ${health.status}). Start the ephemeral stack first.`,
        ]);
    }

    await fetch(`${env.stubUrl}/__control`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ failEmails: 0 }),
    });
}