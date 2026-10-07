import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { APPROVED_DISPOSABLE_PROJECT, E2EConfigurationError, readE2EEnv } from "./env";

const SUPABASE_HOST = /\b([a-z0-9]{20})\.supabase\.co\b/g;

/** Every Supabase project reference compiled into the build under test. */
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
 * Runs after the servers have started and before any test. Proves which
 * backend the build under test talks to; a build compiled against any other
 * project stops the run before a single write.
 */
export default async function globalSetup() {
    const env = readE2EEnv();
    const approved = APPROVED_DISPOSABLE_PROJECT.ref;

    const refs = [...supabaseRefsInBuild(path.resolve(".next"))];
    if (refs.length !== 1 || refs[0] !== approved) {
        throw new E2EConfigurationError([
            refs.length === 0
                ? "The build under test names no Supabase project, so its backend cannot be proved."
                : "The build under test was compiled against a Supabase project other than the approved disposable one. Rebuild without E2E_SKIP_BUILD.",
        ]);
    }

    // The disposable project answers with the keys supplied for it.
    const health = await fetch(`${env.supabaseUrl}/auth/v1/settings`, { headers: { apikey: env.supabaseAnonKey } });
    if (!health.ok) {
        throw new E2EConfigurationError([`The disposable project did not answer its own key (HTTP ${health.status}).`]);
    }

    await fetch(`${env.stubUrl}/__control`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ failEmails: 0 }),
    });
}
