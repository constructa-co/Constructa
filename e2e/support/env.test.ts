import { describe, expect, it } from "vitest";
import { checkSupabaseTarget } from "../../src/lib/deployment/supabase-target.mjs";
import { APPROVED_DISPOSABLE_PROJECT, E2EConfigurationError, readE2EEnv, serverEnv } from "./env";

/** A token shaped like a Supabase key. Not a real key: the signature is a placeholder. */
function key(ref: string, role: string): string {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss: "supabase", ref, role })}.not-a-real-signature`;
}

const approved = APPROVED_DISPOSABLE_PROJECT.ref;
const other = "abcdefghijklmnopqrst";

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
    return {
        NODE_ENV: "test",
        E2E_SUPABASE_PROJECT_REF: approved,
        NEXT_PUBLIC_SUPABASE_URL: `https://${approved}.supabase.co`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key(approved, "anon"),
        SUPABASE_SERVICE_ROLE_KEY: key(approved, "service_role"),
        ...overrides,
    };
}

const refusal = (source: NodeJS.ProcessEnv): string => {
    try {
        readE2EEnv(source);
    } catch (error) {
        expect(error).toBeInstanceOf(E2EConfigurationError);
        return (error as Error).message;
    }
    throw new Error("The environment was accepted.");
};

describe("E2E environment gate", () => {
    it("accepts the approved disposable project on a loopback server", () => {
        const accepted = readE2EEnv(env());
        expect(accepted.projectRef).toBe(approved);
        expect(accepted.baseUrl).toBe("http://127.0.0.1:3100");
    });

    it("refuses to run with nothing configured, and says it is a configuration failure", () => {
        const message = refusal({ NODE_ENV: "test" });
        expect(message).toContain("E2E CONFIGURATION FAILURE");
        for (const name of ["E2E_SUPABASE_PROJECT_REF", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
            expect(message).toContain(`${name} is not set.`);
        }
    });

    it("refuses a sentinel that names another project, even when everything else agrees with it", () => {
        const message = refusal(env({
            E2E_SUPABASE_PROJECT_REF: other,
            NEXT_PUBLIC_SUPABASE_URL: `https://${other}.supabase.co`,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: key(other, "anon"),
            SUPABASE_SERVICE_ROLE_KEY: key(other, "service_role"),
        }));
        expect(message).toContain("E2E_SUPABASE_PROJECT_REF does not name the approved disposable project");
        expect(message).toContain("NEXT_PUBLIC_SUPABASE_URL does not point at the approved disposable project.");
    });

    it("refuses a URL or a key that belongs to another project", () => {
        expect(refusal(env({ NEXT_PUBLIC_SUPABASE_URL: `https://${other}.supabase.co` }))).toContain("NEXT_PUBLIC_SUPABASE_URL");
        expect(refusal(env({ NEXT_PUBLIC_SUPABASE_URL: `http://${approved}.supabase.co` }))).toContain("NEXT_PUBLIC_SUPABASE_URL");
        expect(refusal(env({ NEXT_PUBLIC_SUPABASE_URL: `https://${approved}.supabase.co.example.com` }))).toContain("NEXT_PUBLIC_SUPABASE_URL");
        expect(refusal(env({ SUPABASE_SERVICE_ROLE_KEY: key(other, "service_role") }))).toContain("SUPABASE_SERVICE_ROLE_KEY is not the service_role key");
        expect(refusal(env({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key(other, "anon") }))).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY is not the anon key");
    });

    it("refuses keys in the wrong place or of an unreadable kind", () => {
        expect(refusal(env({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key(approved, "service_role") }))).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
        expect(refusal(env({ SUPABASE_SERVICE_ROLE_KEY: "an-opaque-key-with-no-claims" }))).toContain("SUPABASE_SERVICE_ROLE_KEY");
    });

    it("refuses any server it did not start itself", () => {
        expect(refusal(env({ E2E_BASE_URL: "https://preview.example.com" }))).toContain("E2E_BASE_URL must be an http loopback address");
        expect(refusal(env({ E2E_STUB_URL: "https://api.example.com" }))).toContain("E2E_STUB_URL must be an http loopback address");
    });

    it("starts the server with synthetic provider keys pointed at the local stub", () => {
        const server = serverEnv(readE2EEnv(env()));
        expect(server.OPENAI_BASE_URL).toBe("http://127.0.0.1:3199/openai/v1");
        expect(server.RESEND_BASE_URL).toBe("http://127.0.0.1:3199/resend");
        expect(server.NEXT_PUBLIC_SITE_URL).toBe("http://127.0.0.1:3100");
        expect(server.NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE).toBe("cohort");
        expect(server.OPENAI_API_KEY).toMatch(/synthetic/);
        expect(server.RESEND_API_KEY).toMatch(/synthetic/);
    });

    it("starts the server in the E2E context, so the application's own guard binds it to the disposable project", () => {
        const server = serverEnv(readE2EEnv(env()));
        expect(server.CONSTRUCTA_DEPLOY_CONTEXT).toBe("e2e");
        expect(server.CONSTRUCTA_NONPROD_SUPABASE_PROJECT_REF).toBe(approved);
        expect(checkSupabaseTarget(server)).toMatchObject({ ok: true, guarded: true, context: "e2e" });
        // The same server environment pointed anywhere else is refused by the application itself.
        expect(checkSupabaseTarget({ ...server, NEXT_PUBLIC_SUPABASE_URL: `https://${other}.supabase.co` }).ok).toBe(false);
    });
});
