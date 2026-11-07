import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
    PLATFORM_TERMS_CURRENT_REVISION,
    PLATFORM_TERMS_DOCUMENT_ID,
    PLATFORM_TERMS_REVISION_MARCH_2026,
    isRecognizedPlatformTermsRevision,
} from "@/lib/platform-terms";
import { recordPlatformTermsAcceptance } from "@/lib/platform-terms-acceptance";

// Offline tests for the A023 server acceptance recorder. Every Supabase
// client is a mock injected through deps — no network, no Auth, no DB.

type MockRow = Record<string, unknown>;

interface MockClientOptions {
    user?: { id: string } | null;
    authError?: { message: string } | null;
    getUserThrows?: Error | null;
    insertThrows?: Error | null;
    insertError?: { message: string; code?: string } | null;
}

function makeMockClient(options: MockClientOptions) {
    const getUser = vi.fn(async () => {
        if (options.getUserThrows) throw options.getUserThrows;
        return {
            data: { user: options.user ?? null },
            error: options.authError ?? null,
        };
    });
    const insert = vi.fn(async (row: MockRow) => {
        if (options.insertThrows) throw options.insertThrows;
        if (options.insertError) return { data: null, error: options.insertError };
        return { data: [row], error: null };
    });
    const from = vi.fn((table: string) => {
        if (table !== "platform_terms_acceptances") {
            throw new Error(`unexpected table: ${table}`);
        }
        return { insert };
    });
    const client = { auth: { getUser }, from } as never;
    return { client, getUser, insert, from };
}

function makeDeps(options: MockClientOptions) {
    const mock = makeMockClient(options);
    return { deps: { createSupabaseClient: async () => mock.client }, mock };
}

describe("platform-terms trusted descriptor", () => {
    it("names the March 2026 technical revision of the visible document", () => {
        expect(PLATFORM_TERMS_REVISION_MARCH_2026).toBe("platform-tos-2026-03");
        expect(PLATFORM_TERMS_CURRENT_REVISION).toBe(PLATFORM_TERMS_REVISION_MARCH_2026);
        expect(PLATFORM_TERMS_DOCUMENT_ID).toBe("constructa-platform-terms-of-service");
    });

    it("recognizes only the trusted allow-list of revisions", () => {
        expect(isRecognizedPlatformTermsRevision(PLATFORM_TERMS_CURRENT_REVISION)).toBe(true);
        expect(isRecognizedPlatformTermsRevision("platform-tos-2099-01")).toBe(false);
        expect(isRecognizedPlatformTermsRevision("march-2026")).toBe(false);
        expect(isRecognizedPlatformTermsRevision("")).toBe(false);
        expect(isRecognizedPlatformTermsRevision(undefined)).toBe(false);
        expect(isRecognizedPlatformTermsRevision(null)).toBe(false);
        expect(isRecognizedPlatformTermsRevision(202603)).toBe(false);
    });
});

describe("recordPlatformTermsAcceptance", () => {
    it("refuses without touching auth or storage when acceptance is not exactly true", async () => {
        const { deps, mock } = makeDeps({ user: { id: "server-user-1" } });

        for (const acceptance of [false, undefined, null, "yes", 1]) {
            const result = await recordPlatformTermsAcceptance(
                { acceptance, revision: PLATFORM_TERMS_CURRENT_REVISION },
                deps,
            );
            expect(result).toEqual({ ok: false, code: "refused" });
        }
        expect(mock.getUser).not.toHaveBeenCalled();
        expect(mock.from).not.toHaveBeenCalled();
    });

    it("reports unauthenticated and records nothing when there is no server session", async () => {
        // The pending-email-confirmation signup case: no session exists yet,
        // so no acceptance record can honestly be stored.
        const { deps, mock } = makeDeps({ user: null });

        const result = await recordPlatformTermsAcceptance(
            { acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION },
            deps,
        );

        expect(result).toEqual({ ok: false, code: "unauthenticated" });
        expect(mock.from).not.toHaveBeenCalled();
    });

    it("reports unauthenticated when getUser itself errors", async () => {
        const { deps, mock } = makeDeps({ authError: { message: "session expired" } });

        const result = await recordPlatformTermsAcceptance(
            { acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION },
            deps,
        );

        expect(result).toEqual({ ok: false, code: "unauthenticated" });
        expect(mock.from).not.toHaveBeenCalled();
    });

    it("fails closed on an auth error even if a user object is returned", async () => {
        const { deps, mock } = makeDeps({
            user: { id: "server-user-1" },
            authError: { message: "identity verification failed" },
        });
        expect(await recordPlatformTermsAcceptance(
            { acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION }, deps,
        )).toEqual({ ok: false, code: "unauthenticated" });
        expect(mock.from).not.toHaveBeenCalled();
    });

    it("refuses a forged or stale revision even for an authenticated user", async () => {
        const { deps, mock } = makeDeps({ user: { id: "server-user-1" } });

        for (const revision of ["platform-tos-2099-01", "march 2026", "", null]) {
            const result = await recordPlatformTermsAcceptance({ acceptance: true, revision }, deps);
            expect(result).toEqual({ ok: false, code: "unrecognized-revision" });
        }
        expect(mock.from).not.toHaveBeenCalled();
    });

    it("records with the server user id and no browser-supplied identity or timestamp", async () => {
        const { deps, mock } = makeDeps({ user: { id: "server-user-1" } });

        // A hostile caller smuggles extra fields; the recorder must ignore them.
        const result = await recordPlatformTermsAcceptance(
            {
                acceptance: true,
                revision: PLATFORM_TERMS_CURRENT_REVISION,
                userId: "attacker-user-9",
                acceptedAt: "2030-01-01T00:00:00Z",
            } as never,
            deps,
        );

        expect(result).toEqual({
            ok: true,
            outcome: "recorded",
            userId: "server-user-1",
            revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        expect(mock.insert).toHaveBeenCalledTimes(1);
        const row = mock.insert.mock.calls[0][0] as MockRow;
        expect(row).toEqual({
            user_id: "server-user-1",
            terms_document: PLATFORM_TERMS_DOCUMENT_ID,
            accepted_revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
        // accepted_at must come from the database clock, never the client.
        expect(row).not.toHaveProperty("accepted_at");
    });

    it("treats a unique violation as already-recorded, not an error", async () => {
        const { deps } = makeDeps({
            user: { id: "server-user-1" },
            insertError: { message: "duplicate key", code: "23505" },
        });

        const result = await recordPlatformTermsAcceptance(
            { acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION },
            deps,
        );

        expect(result).toEqual({
            ok: true,
            outcome: "already-recorded",
            userId: "server-user-1",
            revision: PLATFORM_TERMS_CURRENT_REVISION,
        });
    });

    it("reports a storage error honestly when the insert fails", async () => {
        const { deps } = makeDeps({
            user: { id: "server-user-1" },
            insertError: { message: "connection refused" },
        });

        const result = await recordPlatformTermsAcceptance(
            { acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION },
            deps,
        );

        expect(result).toEqual({ ok: false, code: "storage-error" });
    });
});


describe("recordPlatformTermsAcceptance thrown transport errors", () => {
    const accept = { acceptance: true, revision: PLATFORM_TERMS_CURRENT_REVISION };

    it("never logs untrusted transport error messages", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            const marker = "SYNTHETIC_PRIVATE_TRANSPORT_DETAIL";
            await recordPlatformTermsAcceptance(accept, {
                createSupabaseClient: async () => { throw new Error(marker); },
            });
            const { deps } = makeDeps({
                user: { id: "server-user-1" }, insertThrows: new Error(marker),
            });
            await recordPlatformTermsAcceptance(accept, deps);
            expect(log.mock.calls).toEqual([
                ["recordPlatformTermsAcceptance auth transport failed"],
                ["recordPlatformTermsAcceptance insert transport failed"],
            ]);
        } finally {
            log.mockRestore();
        }
    });

    it("maps a thrown createClient failure to unauthenticated with no persistence claim", async () => {
        const result = await recordPlatformTermsAcceptance(accept, {
            createSupabaseClient: async () => {
                throw new Error("cookie store unavailable");
            },
        });

        expect(result).toEqual({ ok: false, code: "unauthenticated" });
    });

    it("maps a thrown getUser failure to unauthenticated with no persistence claim", async () => {
        const { deps, mock } = makeDeps({
            user: { id: "server-user-1" },
            getUserThrows: new Error("auth transport reset"),
        });

        const result = await recordPlatformTermsAcceptance(accept, deps);

        expect(result).toEqual({ ok: false, code: "unauthenticated" });
        expect(mock.from).not.toHaveBeenCalled();
    });

    it("maps a thrown insert failure to storage-error with no persistence claim", async () => {
        const { deps } = makeDeps({
            user: { id: "server-user-1" },
            insertThrows: new Error("connection reset by peer"),
        });

        const result = await recordPlatformTermsAcceptance(accept, deps);

        expect(result).toEqual({ ok: false, code: "storage-error" });
    });
});

describe("platform_terms_acceptance migration grant regression", () => {
    // Static check on the migration FILE text (no SQL execution): the
    // coordinator finding was that a table-wide INSERT grant let any direct
    // PostgREST client name accepted_at (and id). These assertions pin the
    // repaired grant shape.
    const migrationPath = path.resolve(
        import.meta.dirname,
        "../../supabase/migrations/20261024122500_platform_terms_acceptance.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");

    it("grants INSERT on the three client-named columns only", () => {
        expect(sql).toMatch(
            /GRANT INSERT \(user_id, terms_document, accepted_revision\)\s+ON TABLE public\.platform_terms_acceptances TO authenticated;/,
        );
    });

    it("does not grant table-wide INSERT that could name accepted_at or id", () => {
        expect(sql).not.toMatch(/GRANT INSERT ON TABLE public\.platform_terms_acceptances/);
        expect(sql).not.toMatch(/GRANT (SELECT, INSERT|INSERT, SELECT|ALL PRIVILEGES) ON TABLE public\.platform_terms_acceptances TO authenticated/);
    });

    it("grants no service_role access at all", () => {
        // Comment prose may mention the absence; only GRANT lines matter.
        expect(sql).not.toMatch(/GRANT[^;]*service_role/);
    });

    it("keeps RLS own-identity policies, known-revision CHECK, and idempotence unique constraint", () => {
        expect(sql).toMatch(/FOR INSERT TO authenticated\s+WITH CHECK \(user_id = \(SELECT auth\.uid\(\)\)\)/);
        expect(sql).toMatch(/FOR SELECT TO authenticated\s+USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
        expect(sql).toMatch(/accepted_revision IN \('platform-tos-2026-03'\)/);
        expect(sql).toMatch(/UNIQUE \(user_id, terms_document\)/);
        expect(sql).toMatch(/accepted_at timestamptz NOT NULL DEFAULT now\(\)/);
    });
});
