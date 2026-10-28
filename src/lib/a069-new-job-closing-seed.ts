/**
 * A069 new-job closing seed — contract and blocker only at pin 335a56a.
 *
 * Approved source text is the contractor's saved profiles.md_message (exact
 * wording, same limit as proposal closing). There is no platform default string.
 * Seeding belongs only on atomic project create, never on proposal open/save.
 */

import { TEXT_LIMITS } from "./proposal-review";

/** Why create-time seed cannot ship without a bounded RPC change (no post-create UPDATE). */
export const A069_BLOCKER_PHASE1_CREATE_RPC_NO_CLOSING_STATEMENT_SLOT =
    "create_phase1_project_graph" as const;

/**
 * Columns written from p_project today (supabase/migrations/20260930120000…).
 * closing_statement exists on projects but is not in this INSERT list.
 */
export const PHASE1_CREATE_PROJECT_PERSISTED_FROM_PAYLOAD = [
    "name",
    "client_name",
    "client_email",
    "client_phone",
    "client_address",
    "site_address",
    "project_type",
    "start_date",
    "potential_value",
    "status",
    "proposal_complexity",
    "template_id",
    "brief_scope",
    "brief_trade_sections",
    "brief_completed",
    "proposal_introduction",
    "scope_text",
    "programme_phases",
] as const;

export const A069_RECOMMENDATION =
    "Add optional closing_statement to create_phase1_project_graph bounded INSERT and length check (20000); " +
    "then in createBlankProjectAction read profiles.md_message once and pass approvedClosingSeedFromProfile into buildBlankProjectGraph. " +
    "No seed on Review and Send open, no post-create UPDATE, no rewrite of legacy null rows.";

/** Same acceptance rules as explicit Use company message on Review & Send. */
export function approvedClosingSeedFromProfile(mdMessage: string | null | undefined): string | null {
    const message = mdMessage ?? "";
    if (!message.trim() || message.length > TEXT_LIMITS.closing) return null;
    return message;
}

export function phase1CreateRpcPersistsClosingStatement(): boolean {
    return (PHASE1_CREATE_PROJECT_PERSISTED_FROM_PAYLOAD as readonly string[]).includes("closing_statement");
}
