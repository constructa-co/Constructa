// Puts the fixture harness into the app for one fixture browser run, or takes
// it out again (`node prepare.mjs remove`).
//
// It refuses to add the harness anywhere that looks like a deployment or that
// has a database configured: the harness exists to run with neither.
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
export const HARNESS_ROUTE = "admin-e2e-import-fixture";
const destination = path.join(root, "src/app", HARNESS_ROUTE);

export function removeHarness() {
    rmSync(destination, { recursive: true, force: true });
}

export function refusal(env) {
    if (env.CONSTRUCTA_IMPORT_FIXTURE !== "1") return "CONSTRUCTA_IMPORT_FIXTURE is not 1.";
    for (const name of ["VERCEL", "VERCEL_ENV", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "RESEND_API_KEY"]) {
        if (env[name]) return `${name} is set. The fixture harness runs with no deployment, database or provider configured.`;
    }
    return null;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv[2] === "remove") {
        removeHarness();
    } else {
        const reason = refusal(process.env);
        if (reason) {
            console.error(`IMPORT FIXTURE REFUSED: ${reason}`);
            process.exit(2);
        }
        removeHarness();
        cpSync(path.join(here, "app"), destination, { recursive: true });
        if (!existsSync(path.join(destination, "page.tsx"))) process.exit(3);
    }
}
