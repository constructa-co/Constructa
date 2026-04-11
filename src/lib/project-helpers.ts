/**
 * Shared project classification helpers.
 *
 * Sprint 58 Phase 1 item #5. Perplexity live-app walkthrough showed that
 * the "Active Projects" KPI was showing three different numbers on three
 * different pages (Home: 0, Pipeline: 1, Management Accounts: 0) because
 * each page had its own ad-hoc status-string check. Root cause: the
 * `projects.status` column stores capitalised strings (`"Active"`,
 * `"Estimating"`, `"Proposal Sent"`, `"Draft"`) but two of the pages
 * filtered on the lowercase `"active"` — always zero matches.
 *
 * This module is the single source of truth for project-state questions.
 */

/**
 * Canonical set of values the `projects.status` column is known to hold.
 * Kept open (`string | null | undefined`) at the helper-input level so
 * existing interfaces with `status: string | null` can call these helpers
 * without conversion gymnastics.
 */
export const CANONICAL_PROJECT_STATUSES = [
    "Lead",
    "Estimating",
    "Proposal Sent",
    "Active",
    "Won",
    "Completed",
    "Lost",
    "Draft",
    // Legacy lowercase values written by some earlier code paths — still
    // present in the DB for some older rows.
    "active",
] as const;

export type CanonicalProjectStatus = typeof CANONICAL_PROJECT_STATUSES[number];

/** Minimal row shape we need to classify — matches every relevant query. */
export interface ProjectLike {
    status?: string | null;
    is_archived?: boolean | null;
}

/**
 * Is this project "on site" / currently being delivered?
 *
 * Matches:
 *   - `"Active"` (canonical, current writers)
 *   - `"Won"` (transitional — set by markAsWonAction before the row
 *     is picked up by live project views)
 *   - `"active"` (legacy lowercase — still in the DB for some rows)
 *
 * Excludes archived rows so Home and Management Accounts never include
 * projects the user closed.
 */
export function isActiveProject(p: ProjectLike): boolean {
    if (p.is_archived) return false;
    const s = p.status;
    return s === "Active" || s === "Won" || s === "active";
}

/** In the pipeline (pre-construction / bidding stage). */
export function isPipelineProject(p: ProjectLike): boolean {
    if (p.is_archived) return false;
    const s = p.status;
    return (
        s === "Lead" ||
        s === "Estimating" ||
        s === "Proposal Sent" ||
        s === "Draft"
    );
}

/** Project close-out states. */
export function isClosedProject(p: ProjectLike): boolean {
    if (p.is_archived) return true;
    const s = p.status;
    return s === "Completed" || s === "Lost";
}

/**
 * Canonical set of statuses the active-project filter matches. Exported
 * so callers writing SQL/Supabase `.in()` clauses can stay aligned with
 * the TS logic without re-inventing the list.
 */
export const ACTIVE_PROJECT_STATUSES = ["Active", "Won", "active"] as const;
