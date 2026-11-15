import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PRODUCTION_SUPABASE_PROJECT_REF } from "../../src/lib/deployment/supabase-target.mjs";
import { E2EConfigurationError } from "./env";
import { EPHEMERAL_REPLAY_PROJECT_REF, readEphemeralReplayEnv } from "./ephemeral-replay-env";

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
    const approved = EPHEMERAL_REPLAY_PROJECT_REF;
    const refs = [...supabaseRefsInBuild(path.resolve(".next"))];

    if (refs.includes(PRODUCTION_SUPABASE_PROJECT_REF)) {
        throw new E2EConfigurationError(["The build under test names the production Supabase project. Rebuild with ephemeral env."]);
    }
    const foreign = refs.filter((ref) => ref !== approved);
    if (foreign.length > 0) {
        throw new E2EConfigurationError([
            `The build embeds hosted Supabase project(s) other than ephemeral replay: ${foreign.join(", ")}.`,
        ]);
    }

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