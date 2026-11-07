// A023 — trusted platform terms document descriptor.
//
// This module is the ONLY place the application names the platform terms
// document and its current technical revision. The server-side acceptance
// recorder (platform-terms-acceptance.ts) and the migration CHECK constraint
// both validate against these values, so a forged or stale revision from a
// browser cannot be recorded.
//
// IMPORTANT — what this revision is and is not:
//
//   - The user-visible terms page (src/app/terms-of-service/page.tsx) is
//     prose whose only dating is "Last updated: March 2026.". There is no
//     business-approved legal version identifier anywhere in the product.
//   - "platform-tos-2026-03" is therefore a TECHNICAL document descriptor
//     that identifies the March 2026 revision of that visible document. It
//     is NOT a claim that a legal/compliance authority approved that
//     version, and it is NOT derived from anything the browser sends.
//   - When a new revision of the visible document is published, a
//     coordinated change is required: add the new descriptor here, and add
//     it to the CHECK constraint in the platform_terms_acceptance migration.
//     Until both exist, the new revision is refused at every boundary.
//
// This is the platform terms of service only. It has nothing to do with the
// twelve STANDARD_PROPOSAL_TERMS contract clauses (src/lib/proposal-terms.ts),
// which are unchanged.

/** Stable identifier of the platform terms document this record refers to. */
export const PLATFORM_TERMS_DOCUMENT_ID = "constructa-platform-terms-of-service";

/** Technical descriptor of the current revision of the visible document. */
export const PLATFORM_TERMS_REVISION_MARCH_2026 = "platform-tos-2026-03";

/**
 * The revision the server will currently accept and record. Derived solely
 * from the trusted constant above — never from request data.
 */
export const PLATFORM_TERMS_CURRENT_REVISION = PLATFORM_TERMS_REVISION_MARCH_2026;

/**
 * Every revision the server recognizes as recordable. Kept as an explicit
 * allow-list so that a withdrawn or never-approved revision cannot be
 * recorded even if a caller guesses its name.
 */
export const PLATFORM_TERMS_RECOGNIZED_REVISIONS: ReadonlyArray<string> = [
    PLATFORM_TERMS_REVISION_MARCH_2026,
];

/** True only when `revision` is one of the trusted recognized revisions. */
export function isRecognizedPlatformTermsRevision(revision: unknown): revision is string {
    return typeof revision === "string" && PLATFORM_TERMS_RECOGNIZED_REVISIONS.includes(revision);
}
