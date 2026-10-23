import { describe, expect, it } from "vitest";
import {
    isForbiddenHostedPublishRequest,
    isForbiddenProposalServerActionPost,
    isSyntheticQaLabel,
    readNoPublishEnv,
    SYNTHETIC_QA_EMAIL_VAR,
    SYNTHETIC_QA_PASSWORD_VAR,
} from "./no-publish-guard";
import { APPROVED_DISPOSABLE_PROJECT, E2EConfigurationError, readE2EEnv } from "./env";

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
        [SYNTHETIC_QA_EMAIL_VAR]: "e2e-qa-no-publish@example.com",
        [SYNTHETIC_QA_PASSWORD_VAR]: "synthetic-password-not-a-real-secret",
        ...overrides,
    };
}

describe("no-publish guard", () => {
    it("accepts a labelled synthetic QA mailbox with the approved disposable backend", () => {
        const env = readNoPublishEnv(baseEnv());
        expect(env.projectRef).toBe(approved);
        expect(env.qaEmail).toBe("e2e-qa-no-publish@example.com");
        expect(readE2EEnv(baseEnv()).projectRef).toBe(approved);
    });

    it("refuses a QA mailbox without the e2e-qa label before any browser work", () => {
        try {
            readNoPublishEnv(baseEnv({ [SYNTHETIC_QA_EMAIL_VAR]: "contractor@example.com" }));
        } catch (error) {
            expect(error).toBeInstanceOf(E2EConfigurationError);
            expect((error as Error).message).toContain(SYNTHETIC_QA_EMAIL_VAR);
            return;
        }
        throw new Error("Expected configuration refusal.");
    });

    it("classifies hosted publish RPC posts", () => {
        const host = `https://${approved}.supabase.co`;
        expect(isForbiddenHostedPublishRequest(`${host}/rest/v1/rpc/publish_proposal_publication`, "POST")).toBe(true);
        expect(isForbiddenHostedPublishRequest(`${host}/rest/v1/rpc/publish_proposal`, "POST")).toBe(true);
        expect(isForbiddenHostedPublishRequest(`${host}/rest/v1/rpc/save_phase1_brief`, "POST")).toBe(false);
        expect(isSyntheticQaLabel("e2e-qa@example.com")).toBe(true);
        expect(isSyntheticQaLabel("other@example.com")).toBe(false);
    });

    it("blocks every next-action POST on the proposal route before transport", () => {
        const headers = { "next-action": "deadbeef" };
        expect(isForbiddenProposalServerActionPost(
            "http://127.0.0.1:3100/dashboard/projects/proposal?projectId=abc",
            "POST",
            headers,
        )).toBe(true);
        expect(isForbiddenProposalServerActionPost(
            "http://127.0.0.1:3100/dashboard/projects/costs?projectId=abc",
            "POST",
            headers,
        )).toBe(false);
        expect(isForbiddenProposalServerActionPost(
            "http://127.0.0.1:3100/dashboard/projects/proposal?projectId=abc",
            "GET",
            headers,
        )).toBe(false);
    });
});
