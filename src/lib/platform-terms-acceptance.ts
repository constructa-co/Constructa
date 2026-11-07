import { createClient } from "@/lib/supabase/server";
import {
    PLATFORM_TERMS_DOCUMENT_ID,
    isRecognizedPlatformTermsRevision,
} from "@/lib/platform-terms";

// A023 — durable, server-side record of platform terms acceptance.
//
// Trust boundaries, all enforced here or in the migration
// (supabase/migrations/*platform_terms_acceptance.sql):
//
//   - Authenticated identity: the user id is taken ONLY from
//     supabase.auth.getUser() on the server. The caller never supplies a
//     user id; anything extra in the input is ignored.
//   - Server time: accepted_at is a database DEFAULT now() that the
//     application never sends. A browser timestamp is never read or stored.
//   - Trusted revision: the caller names the revision it was shown, but it
//     is accepted only when it equals the trusted current document
//     descriptor from platform-terms.ts (also enforced by a CHECK
//     constraint in the migration).
//   - Explicit acceptance: `acceptance` must be exactly true — a present
//     but falsy value is a refusal, not a record.
//   - No session, no record: when getUser() yields no user (e.g. a signup
//     whose email is not yet confirmed and therefore has no server session),
//     the result says unauthenticated and NOTHING is inserted. We never
//     claim a record exists without a server acknowledgement.
//   - Thrown transport: createClient(), getUser() and insert() may THROW
//     (network/transport failure) instead of returning an error value.
//     Throws are caught and mapped to honest typed failures —
//     unauthenticated when identity could not be established, storage-error
//     when the write could not be confirmed — never a persistence claim.
//   - Idempotence: one current record per (user, document). A repeat
//     acceptance is reported as already-recorded, not an error.
//
// This module records platform terms of service acceptance only; the
// twelve proposal contract clauses are unaffected.

export type RecordPlatformTermsAcceptanceResult =
    | { ok: true; outcome: "recorded" | "already-recorded"; userId: string; revision: string }
    | {
          ok: false;
          code: "refused" | "unauthenticated" | "unrecognized-revision" | "storage-error";
      };

export interface RecordPlatformTermsAcceptanceInput {
    /** The caller's explicit, affirmative acceptance. Must be exactly true. */
    acceptance: unknown;
    /** The revision the user was shown. Must match the trusted current revision. */
    revision: unknown;
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface RecordPlatformTermsAcceptanceDeps {
    /** Injectable for offline tests. Defaults to the cookie-bound server client. */
    createSupabaseClient?: () => Promise<ServerClient>;
}

const UNIQUE_VIOLATION = "23505";

export async function recordPlatformTermsAcceptance(
    input: RecordPlatformTermsAcceptanceInput,
    deps: RecordPlatformTermsAcceptanceDeps = {},
): Promise<RecordPlatformTermsAcceptanceResult> {
    // 1. Refusal — checked before anything touches auth or the database, so
    //    an unchecked box never produces a record and never even asks who
    //    the caller is.
    if (input?.acceptance !== true) {
        return { ok: false, code: "refused" };
    }

    // 2. Authenticated identity from the server session only.
    const createSupabaseClient = deps.createSupabaseClient ?? createClient;
    let supabase: ServerClient;
    let user: { id: string } | null = null;
    try {
        supabase = await createSupabaseClient();
        const {
            data: { user: sessionUser },
            error: authError,
        } = await supabase.auth.getUser();
        if (authError) return { ok: false, code: "unauthenticated" };
        user = sessionUser;
    } catch {
        // Identity could not be established (client construction or the
        // getUser call itself threw). No persistence is claimed.
        console.error("recordPlatformTermsAcceptance auth transport failed");
        return { ok: false, code: "unauthenticated" };
    }
    if (!user) {
        // No server-verified session — e.g. email-confirmation pending.
        // Honest answer: unauthenticated, and no insert is attempted.
        return { ok: false, code: "unauthenticated" };
    }

    // 3. Trusted revision boundary. A forged or stale revision is refused
    //    even though the caller is authenticated.
    const revision = input.revision;
    if (!isRecognizedPlatformTermsRevision(revision)) {
        return { ok: false, code: "unrecognized-revision" };
    }

    // 4. Record with the server-side user id and the database's own clock.
    //    No client timestamp, no caller-supplied identity.
    let error: unknown = null;
    try {
        ({ error } = await supabase
            .from("platform_terms_acceptances")
            .insert({
                user_id: user.id,
                terms_document: PLATFORM_TERMS_DOCUMENT_ID,
                accepted_revision: revision,
            }));
    } catch {
        // The write could not be confirmed — report failure, not success.
        console.error("recordPlatformTermsAcceptance insert transport failed");
        return { ok: false, code: "storage-error" };
    }

    if (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
            return { ok: true, outcome: "already-recorded", userId: user.id, revision };
        }
        console.error("recordPlatformTermsAcceptance failed", {
            code: (error as { code?: string }).code,
        });
        return { ok: false, code: "storage-error" };
    }

    return { ok: true, outcome: "recorded", userId: user.id, revision };
}
