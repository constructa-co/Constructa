import { describe, expect, it } from "vitest";
import { E2EConfigurationError } from "./env";
import { EPHEMERAL_REPLAY_PROJECT_REF, readEphemeralReplayEnv } from "./ephemeral-replay-env";

const SIGNATURE = "not-a-real-signature";
function key(ref: string | undefined, role: string, iss = "supabase"): string {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss, ref, role })}.${SIGNATURE}`;
}

function baseEnv(overrides: Record<string, string | undefined> = {}): Record<string, string> {
    return {
        E2E_D38_BACKEND: "ephemeral",
        E2E_SUPABASE_PROJECT_REF: EPHEMERAL_REPLAY_PROJECT_REF,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key(EPHEMERAL_REPLAY_PROJECT_REF, "anon"),
        SUPABASE_SERVICE_ROLE_KEY: key(EPHEMERAL_REPLAY_PROJECT_REF, "service_role"),
        E2E_BASE_URL: "http://127.0.0.1:3100",
        E2E_STUB_URL: "http://127.0.0.1:3199",
        ...overrides,
    };
}

describe("readEphemeralReplayEnv", () => {
    it("passes a complete ephemeral loopback configuration", () => {
        const env = readEphemeralReplayEnv(baseEnv() as NodeJS.ProcessEnv);
        expect(env.projectRef).toBe(EPHEMERAL_REPLAY_PROJECT_REF);
        expect(env.supabaseUrl).toBe("http://127.0.0.1:54321");
    });

    it("accepts role-matched CLI JWTs without a hosted project reference", () => {
        const env = baseEnv({
            NEXT_PUBLIC_SUPABASE_ANON_KEY: key(undefined, "anon", "supabase-demo"),
            SUPABASE_SERVICE_ROLE_KEY: key(undefined, "service_role", "supabase-demo"),
        });
        expect(readEphemeralReplayEnv(env).projectRef).toBe(EPHEMERAL_REPLAY_PROJECT_REF);
        expect(() => readEphemeralReplayEnv({
            ...env,
            SUPABASE_SERVICE_ROLE_KEY: key("another-hosted-project", "service_role", "supabase-demo"),
        })).toThrow(E2EConfigurationError);
    });

    it("fails closed on hosted Supabase URLs", () => {
        expect(() =>
            readEphemeralReplayEnv(
                baseEnv({
                    NEXT_PUBLIC_SUPABASE_URL: `https://${EPHEMERAL_REPLAY_PROJECT_REF}.supabase.co`,
                }) as NodeJS.ProcessEnv,
            ),
        ).toThrow(E2EConfigurationError);
    });

    it("requires E2E_D38_BACKEND=ephemeral", () => {
        expect(() => readEphemeralReplayEnv(baseEnv({ E2E_D38_BACKEND: undefined }) as NodeJS.ProcessEnv)).toThrow(
            E2EConfigurationError,
        );
    });
});