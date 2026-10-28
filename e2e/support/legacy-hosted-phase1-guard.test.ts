import { afterEach, describe, expect, it, vi } from "vitest";
import { APPROVED_DISPOSABLE_PROJECT, E2EConfigurationError } from "./env";
import {
    LEGACY_HOSTED_PHASE1_WRITE_HELD_MESSAGE,
    isLegacyHostedPhase1WriteHeld,
    readLegacyHostedPhase1Env,
    readLegacyHostedPhase1Prerequisites,
} from "./legacy-hosted-phase1-guard";

function key(ref: string, role: string): string {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    return `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss: "supabase", ref, role })}.not-a-real-signature`;
}

const approved = APPROVED_DISPOSABLE_PROJECT.ref;

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
    return {
        NODE_ENV: "test",
        E2E_SUPABASE_PROJECT_REF: approved,
        NEXT_PUBLIC_SUPABASE_URL: `https://${approved}.supabase.co`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key(approved, "anon"),
        SUPABASE_SERVICE_ROLE_KEY: key(approved, "service_role"),
        ...overrides,
    };
}

afterEach(() => vi.restoreAllMocks());

describe("legacy hosted Phase 1 write guard", () => {
    it("keeps the legacy write journey held in source", () => {
        expect(isLegacyHostedPhase1WriteHeld()).toBe(true);
        expect(() => readLegacyHostedPhase1Env(baseEnv())).toThrow(LEGACY_HOSTED_PHASE1_WRITE_HELD_MESSAGE);
    });

    it("refuses before any disposable-project network when held", () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not fetch"));
        expect(() => readLegacyHostedPhase1Env(baseEnv())).toThrow(E2EConfigurationError);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("still exposes prerequisite checks without lifting the hold", () => {
        const env = readLegacyHostedPhase1Prerequisites(baseEnv());
        expect(env.projectRef).toBe(approved);
    });

    it("blocks the default Phase 1 Playwright config at import time", async () => {
        await expect(import("../../playwright.config")).rejects.toThrow(LEGACY_HOSTED_PHASE1_WRITE_HELD_MESSAGE);
    });
});
