import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    DEPLOY_CONTEXT_VARIABLE,
    NONPROD_REF_VARIABLE,
    PRODUCTION_SUPABASE_PROJECT_REF,
    SupabaseTargetError,
    assertSupabaseTarget,
    checkCompiledTarget,
    checkSupabaseTarget,
    resolveDeployContext,
    supabaseRefsInBuild,
} from "./supabase-target.mjs";

const PRODUCTION = PRODUCTION_SUPABASE_PROJECT_REF;
const DISPOSABLE = "abcdefghijklmnopqrst";
const OTHER = "zyxwvutsrqponmlkjihg";
const ROOT = path.resolve(import.meta.dirname, "../../..");
const SCRIPT = path.join(ROOT, "scripts/verify-build-supabase-target.mjs");

/** A token shaped like a Supabase key. Not a real key: the signature is a marker the tests look for. */
const SIGNATURE = "not-a-real-signature-must-never-be-printed";
function key(ref: string, role: string): string {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss: "supabase", ref, role })}.${SIGNATURE}`;
}

type Env = Record<string, string | undefined>;

/** A Vercel preview bound to a disposable project, as it should be. */
function preview(overrides: Env = {}): Env {
    return {
        VERCEL: "1",
        VERCEL_ENV: "preview",
        [NONPROD_REF_VARIABLE]: DISPOSABLE,
        NEXT_PUBLIC_SUPABASE_URL: `https://${DISPOSABLE}.supabase.co`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key(DISPOSABLE, "anon"),
        SUPABASE_SERVICE_ROLE_KEY: key(DISPOSABLE, "service_role"),
        ...overrides,
    };
}

/** Production exactly as it is deployed. */
function production(overrides: Env = {}): Env {
    return {
        VERCEL: "1",
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION}.supabase.co`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key(PRODUCTION, "anon"),
        SUPABASE_SERVICE_ROLE_KEY: key(PRODUCTION, "service_role"),
        ...overrides,
    };
}

const problemsOf = (env: Env) => checkSupabaseTarget(env).problems.join("\n");

describe("which deployments are guarded", () => {
    it("guards every Vercel deployment that is not production or local development", () => {
        expect(resolveDeployContext({ VERCEL: "1", VERCEL_ENV: "preview" })).toMatchObject({ context: "preview", guarded: true });
        // A custom environment, or a Vercel build that states nothing, is a preview.
        expect(resolveDeployContext({ VERCEL: "1", VERCEL_ENV: "staging" })).toMatchObject({ context: "preview", guarded: true });
        expect(resolveDeployContext({ VERCEL: "1" })).toMatchObject({ context: "preview", guarded: true });
        expect(resolveDeployContext({ VERCEL: "1", VERCEL_ENV: "production" })).toMatchObject({ context: "production", guarded: false });
        expect(resolveDeployContext({ VERCEL: "1", VERCEL_ENV: "development" })).toMatchObject({ context: "development", guarded: false });
    });

    it("does not let a preview on Vercel declare itself production", () => {
        expect(resolveDeployContext({ VERCEL: "1", VERCEL_ENV: "preview", [DEPLOY_CONTEXT_VARIABLE]: "production" }))
            .toMatchObject({ context: "preview", guarded: true });
    });

    it("does not let a stray declaration stop production on Vercel", () => {
        expect(resolveDeployContext({ VERCEL: "1", VERCEL_ENV: "production", [DEPLOY_CONTEXT_VARIABLE]: "preview" }))
            .toMatchObject({ context: "production", guarded: false });
    });

    it("takes a declared context away from Vercel, and treats an unknown one as a preview", () => {
        expect(resolveDeployContext({ [DEPLOY_CONTEXT_VARIABLE]: "e2e" })).toMatchObject({ context: "e2e", guarded: true });
        expect(resolveDeployContext({ [DEPLOY_CONTEXT_VARIABLE]: " Preview " })).toMatchObject({ context: "preview", guarded: true });
        expect(resolveDeployContext({ [DEPLOY_CONTEXT_VARIABLE]: "qa" })).toMatchObject({ context: "preview", guarded: true });
        expect(resolveDeployContext({})).toMatchObject({ context: "unspecified", guarded: false });
    });
});

describe("a preview or E2E build cannot target production", () => {
    it("passes a preview bound to its declared disposable project", () => {
        const result = checkSupabaseTarget(preview());
        expect(result).toMatchObject({ ok: true, guarded: true, problems: [] });
        expect(result.summary).toBe(
            `Supabase target check: context=preview (from VERCEL_ENV) expected=${DISPOSABLE} url=${DISPOSABLE} anon-key=${DISPOSABLE} service-key=${DISPOSABLE} -> PASS`,
        );
    });

    it("fails the incident: a preview that inherited the production variables", () => {
        const result = checkSupabaseTarget({ ...production(), VERCEL_ENV: "preview" });
        expect(result.ok).toBe(false);
        expect(result.problems).toEqual(expect.arrayContaining([
            `${NONPROD_REF_VARIABLE} is not set. State the disposable project this preview may use.`,
            "NEXT_PUBLIC_SUPABASE_URL points at the production project.",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY is a key of the production project.",
            "SUPABASE_SERVICE_ROLE_KEY is a key of the production project.",
        ]));
    });

    it("fails on the production URL alone, the production browser key alone, or the production server key alone", () => {
        expect(problemsOf(preview({ NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION}.supabase.co` }))).toContain("NEXT_PUBLIC_SUPABASE_URL points at the production project.");
        expect(problemsOf(preview({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key(PRODUCTION, "anon") }))).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY is a key of the production project.");
        expect(problemsOf(preview({ SUPABASE_SERVICE_ROLE_KEY: key(PRODUCTION, "service_role") }))).toContain("SUPABASE_SERVICE_ROLE_KEY is a key of the production project.");
    });

    it("fails when the declared disposable project is production", () => {
        expect(problemsOf(preview({ [NONPROD_REF_VARIABLE]: PRODUCTION }))).toContain(`${NONPROD_REF_VARIABLE} names the production project.`);
    });

    it("fails closed when the disposable credentials are absent", () => {
        const result = checkSupabaseTarget({ VERCEL: "1", VERCEL_ENV: "preview" });
        expect(result.ok).toBe(false);
        expect(result.problems.join("\n")).toContain(`${NONPROD_REF_VARIABLE} is not set.`);
        for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
            expect(result.problems.join("\n")).toContain(`${name} is not set.`);
        }
        // One missing value is enough.
        expect(checkSupabaseTarget(preview({ SUPABASE_SERVICE_ROLE_KEY: "" })).ok).toBe(false);
        expect(checkSupabaseTarget(preview({ [NONPROD_REF_VARIABLE]: undefined })).ok).toBe(false);
    });

    it("fails a URL or key that belongs to any project other than the declared one", () => {
        expect(problemsOf(preview({ NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER}.supabase.co` }))).toContain(`points at project ${OTHER}, not the declared disposable project.`);
        expect(problemsOf(preview({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key(OTHER, "anon") }))).toContain(`belongs to project ${OTHER}`);
        expect(problemsOf(preview({ SUPABASE_SERVICE_ROLE_KEY: key(OTHER, "service_role") }))).toContain(`belongs to project ${OTHER}`);
    });

    it("fails a URL whose project cannot be read from it", () => {
        for (const url of [`http://${DISPOSABLE}.supabase.co`, "https://db.example.test", `https://${DISPOSABLE}.supabase.co.example.test`, "not a url"]) {
            expect(problemsOf(preview({ NEXT_PUBLIC_SUPABASE_URL: url })), url).toContain("so its project cannot be proved");
        }
    });

    it("fails keys in the wrong place", () => {
        expect(problemsOf(preview({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key(DISPOSABLE, "service_role") }))).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY does not hold a key with the anon role.");
        expect(problemsOf(preview({ SUPABASE_SERVICE_ROLE_KEY: key(DISPOSABLE, "anon") }))).toContain("SUPABASE_SERVICE_ROLE_KEY does not hold a key with the service_role role.");
        expect(problemsOf(preview({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_secret_abc" }))).toContain("holds the wrong kind of key");
        expect(problemsOf(preview({ SUPABASE_SERVICE_ROLE_KEY: "sb_publishable_abc" }))).toContain("holds the wrong kind of key");
    });

    it("accepts the newer key formats, which state no project, because the URL decides where requests go", () => {
        const result = checkSupabaseTarget(preview({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_abc", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_abc" }));
        expect(result.ok).toBe(true);
        expect(result.summary).toContain("anon-key=not stated by this key format");
    });

    it("fails any other variable that addresses production: a database URL, a pooler URL, a key under another name", () => {
        expect(problemsOf(preview({ DATABASE_URL: `postgresql://postgres:pw@db.${PRODUCTION}.supabase.co:5432/postgres` }))).toContain("DATABASE_URL points at the production Supabase project.");
        expect(problemsOf(preview({ POSTGRES_URL: `postgresql://postgres.${PRODUCTION}:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres` }))).toContain("POSTGRES_URL points at the production Supabase project.");
        expect(problemsOf(preview({ SUPABASE_URL: `https://${PRODUCTION}.supabase.co` }))).toContain("SUPABASE_URL points at the production Supabase project.");
        expect(problemsOf(preview({ SOME_OTHER_KEY: key(PRODUCTION, "service_role") }))).toContain("SOME_OTHER_KEY points at the production Supabase project.");
    });

    it("ignores a commit message or branch name that merely mentions production", () => {
        expect(checkSupabaseTarget(preview({
            VERCEL_GIT_COMMIT_MESSAGE: `guard against https://${PRODUCTION}.supabase.co`,
            GITHUB_HEAD_REF: `fix/${PRODUCTION}.supabase.co`,
        })).ok).toBe(true);
    });

    it("applies the same rule to the E2E context", () => {
        const e2e = { ...preview(), VERCEL: undefined, VERCEL_ENV: undefined, [DEPLOY_CONTEXT_VARIABLE]: "e2e" };
        expect(checkSupabaseTarget(e2e)).toMatchObject({ ok: true, context: "e2e" });
        expect(checkSupabaseTarget({ ...e2e, NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION}.supabase.co` }).ok).toBe(false);
    });
});

describe("production and ordinary builds are unaffected", () => {
    it("never checks production, whatever it is bound to", () => {
        expect(checkSupabaseTarget(production())).toMatchObject({ ok: true, guarded: false, problems: [] });
        expect(checkSupabaseTarget(production({ NEXT_PUBLIC_SUPABASE_URL: "garbage", SUPABASE_SERVICE_ROLE_KEY: undefined }))).toMatchObject({ ok: true, guarded: false });
        expect(() => assertSupabaseTarget(production(), { log: () => undefined })).not.toThrow();
    });

    it("lets a build with no environment at all complete, as CI requires", () => {
        expect(checkSupabaseTarget({})).toMatchObject({ ok: true, guarded: false });
        expect(checkCompiledTarget({}, [])).toMatchObject({ ok: true, guarded: false });
    });
});

describe("what is reported", () => {
    it("never prints key material, in a pass or in a failure", () => {
        const secretKey = "sb_secret_this-value-must-never-be-printed";
        const database = `postgresql://postgres:database-password-must-never-be-printed@db.${PRODUCTION}.supabase.co:5432/postgres`;
        const environments = [
            preview(),
            preview({ SUPABASE_SERVICE_ROLE_KEY: secretKey }),
            { ...production(), VERCEL_ENV: "preview", DATABASE_URL: database },
        ];
        for (const env of environments) {
            const lines: string[] = [];
            let message = "";
            try {
                assertSupabaseTarget(env, { log: (line) => lines.push(line) });
            } catch (error) {
                expect(error).toBeInstanceOf(SupabaseTargetError);
                message = (error as Error).message;
            }
            const printed = [...lines, message, ...checkSupabaseTarget(env).problems].join("\n");
            expect(printed).not.toContain(SIGNATURE);
            expect(printed).not.toContain("must-never-be-printed");
            for (const value of [env.NEXT_PUBLIC_SUPABASE_ANON_KEY, env.SUPABASE_SERVICE_ROLE_KEY]) {
                expect(printed).not.toContain(value);
            }
        }
    });

    it("throws a failure that says what it is and reports the result once per process", () => {
        const env: Env = { ...production(), VERCEL_ENV: "preview" };
        const lines: string[] = [];
        expect(() => assertSupabaseTarget(env, { log: (line) => lines.push(line) })).toThrow(/SUPABASE TARGET CHECK FAILED \(configuration\)/);
        expect(() => assertSupabaseTarget(env, { log: (line) => lines.push(line) })).toThrow(SupabaseTargetError);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("-> FAIL");
    });
});

describe("the compiled build", () => {
    const dirs: string[] = [];
    afterEach(() => {
        dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
    });

    /** A stand-in for `.next`: the public URL inlined into browser and server output. */
    function build(refs: string[], cached: string[] = []): string {
        const dir = mkdtempSync(path.join(tmpdir(), "constructa-build-"));
        dirs.push(dir);
        mkdirSync(path.join(dir, "static/chunks"), { recursive: true });
        mkdirSync(path.join(dir, "server/app"), { recursive: true });
        mkdirSync(path.join(dir, "cache"), { recursive: true });
        refs.forEach((ref, index) => {
            writeFileSync(path.join(dir, "static/chunks", `chunk-${index}.js`), `const url="https://${ref}.supabase.co";`);
            writeFileSync(path.join(dir, "server/app", `page-${index}.js`), `fetch("https://${ref}.supabase.co/rest/v1")`);
        });
        cached.forEach((ref) => writeFileSync(path.join(dir, "cache", "old.js"), `"https://${ref}.supabase.co"`));
        writeFileSync(path.join(dir, "static/chunks", "vendor.js"), 'const example="https://xyzcompany.supabase.co";');
        return dir;
    }

    it("reads every project reference compiled into browser and server output, not the build cache", () => {
        expect(supabaseRefsInBuild(build([DISPOSABLE, OTHER], [PRODUCTION]))).toEqual([DISPOSABLE, OTHER].sort());
    });

    it("passes a preview build that names only the declared disposable project", () => {
        const result = checkCompiledTarget(preview(), supabaseRefsInBuild(build([DISPOSABLE])));
        expect(result.ok).toBe(true);
        expect(result.summary).toBe(
            `Compiled Supabase target: context=preview (from VERCEL_ENV) expected=${DISPOSABLE} projects in build=${DISPOSABLE} -> PASS`,
        );
    });

    it("fails a preview build that names production, nothing, or a second project", () => {
        expect(checkCompiledTarget(preview(), [PRODUCTION]).problems).toContain("The compiled build names the production Supabase project.");
        expect(checkCompiledTarget(preview(), [DISPOSABLE, PRODUCTION]).ok).toBe(false);
        expect(checkCompiledTarget(preview(), []).problems).toContain("The compiled build names no Supabase project, so its backend cannot be proved.");
        expect(checkCompiledTarget(preview(), [DISPOSABLE, OTHER]).problems.join("\n")).toContain(`other than the declared disposable one: ${OTHER}.`);
        expect(checkCompiledTarget(preview({ [NONPROD_REF_VARIABLE]: undefined }), [DISPOSABLE]).ok).toBe(false);
    });

    it("leaves a production build alone", () => {
        expect(checkCompiledTarget(production(), [PRODUCTION])).toMatchObject({ ok: true, guarded: false });
    });

    describe("scripts/verify-build-supabase-target.mjs", () => {
        const run = (env: Env, dir: string) => spawnSync(process.execPath, [SCRIPT, "--dir", dir], {
            encoding: "utf8",
            // Only what the case states: nothing is inherited from the machine running the tests.
            env: { PATH: process.env.PATH, ...env } as unknown as NodeJS.ProcessEnv,
        });

        it("exits 0 for an isolated preview and shows the project it is bound to", () => {
            const result = run(preview(), build([DISPOSABLE]));
            expect(result.status).toBe(0);
            expect(result.stdout).toContain(`expected=${DISPOSABLE} projects in build=${DISPOSABLE} -> PASS`);
            expect(result.stdout + result.stderr).not.toContain(SIGNATURE);
        });

        it("exits 1 for a preview whose bundle was compiled against production", () => {
            const result = run(preview(), build([PRODUCTION]));
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("SUPABASE TARGET CHECK FAILED (compiled build)");
            expect(result.stderr).toContain("The compiled build names the production Supabase project.");
        });

        it("exits 1 for a preview configured with production before reading the build", () => {
            const result = run({ ...production(), VERCEL_ENV: "preview" }, build([PRODUCTION]));
            expect(result.status).toBe(1);
            expect(result.stderr).toContain("SUPABASE TARGET CHECK FAILED (configuration)");
            expect(result.stdout + result.stderr).not.toContain(SIGNATURE);
        });

        it("can never stop a production or ordinary build, even when the build cannot be read", () => {
            const notADirectory = path.join(build([DISPOSABLE]), "static/chunks/chunk-0.js");
            const inProduction = run(production(), notADirectory);
            expect(inProduction.status).toBe(0);
            expect(inProduction.stdout).toContain("nothing is enforced");
            expect(run({}, notADirectory).status).toBe(0);
            // The same unreadable build under a preview cannot be proved, so it fails.
            const inPreview = run(preview(), notADirectory);
            expect(inPreview.status).toBe(1);
            expect(inPreview.stderr).toContain("so its backend cannot be proved");
        });

        it("exits 1 when a preview has no build to check, and 0 for production and for a bare build", () => {
            expect(run(preview(), path.join(tmpdir(), "constructa-no-such-build")).status).toBe(1);
            expect(run(production(), build([PRODUCTION])).status).toBe(0);
            expect(run({}, build([])).status).toBe(0);
        });
    });
});

describe("next.config.mjs", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    const loadConfig = async (env: Env) => {
        vi.resetModules();
        for (const name of ["VERCEL", "VERCEL_ENV", DEPLOY_CONTEXT_VARIABLE, NONPROD_REF_VARIABLE, "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CONSTRUCTA_SUPABASE_TARGET_REPORTED"]) {
            vi.stubEnv(name, env[name] ?? "");
        }
        const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
        try {
            return await import("../../../next.config.mjs");
        } finally {
            log.mockRestore();
        }
    };

    it("stops a preview build that targets production before anything is compiled", async () => {
        await expect(loadConfig({ ...production(), VERCEL_ENV: "preview" })).rejects.toThrow(/SUPABASE TARGET CHECK FAILED/);
    });

    it("loads for an isolated preview, for production and with no environment", async () => {
        await expect(loadConfig(preview())).resolves.toHaveProperty("default");
        await expect(loadConfig(production())).resolves.toHaveProperty("default");
        await expect(loadConfig({})).resolves.toHaveProperty("default");
    });
});
