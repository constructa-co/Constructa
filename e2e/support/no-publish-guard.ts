/**
 * Fail-closed prerequisites and publish-boundary classification for the
 * hosted Phase 1 no-publish variant. Does not weaken the disposable-project
 * gate in env.ts; adds QA identity and explicit publish refusal labels.
 */

import { E2EConfigurationError, SYNTHETIC_EMAIL_DOMAIN, readE2EEnv, type E2EEnv } from "./env";

/** Protected runtime variable names (values are never logged by the harness). */
export const SYNTHETIC_QA_EMAIL_VAR = "E2E_SYNTHETIC_QA_EMAIL";
export const SYNTHETIC_QA_PASSWORD_VAR = "E2E_SYNTHETIC_PASSWORD";

const FORBIDDEN_PUBLISH_RPC_SEGMENTS = [
    "/rpc/publish_proposal_publication",
    "/rpc/publish_proposal",
] as const;

export interface NoPublishEnv extends E2EEnv {
    qaEmail: string;
    qaPassword: string;
}

/** The QA mailbox must be synthetic and explicitly labelled in the local part. */
export function isSyntheticQaLabel(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`)) return false;
    const local = normalized.slice(0, -(SYNTHETIC_EMAIL_DOMAIN.length + 1));
    return /e2e-qa/.test(local);
}

/**
 * Hosted publication RPCs this variant must never reach. Browser abort alone is
 * not a server-side guarantee; this classifier records what the harness blocks.
 */
export function isForbiddenHostedPublishRequest(url: string, method: string): boolean {
    if (method.toUpperCase() !== "POST") return false;
    try {
        const path = new URL(url).pathname;
        return FORBIDDEN_PUBLISH_RPC_SEGMENTS.some((segment) => path.includes(segment));
    } catch {
        return false;
    }
}

const proposalPath = "/dashboard/projects/proposal";

/**
 * Every Next.js server action on the proposal route (Save draft, Send, etc.).
 * The no-publish variant aborts these before transport; draft PDF uses
 * downloadDraftPdf → buildPreviewSnapshot locally (review-send-client.tsx).
 */
export function isForbiddenProposalServerActionPost(
    url: string,
    method: string,
    headers: Record<string, string | undefined>,
): boolean {
    if (method.toUpperCase() !== "POST") return false;
    const action = headers["next-action"] ?? headers["Next-Action"];
    if (!action) return false;
    try {
        return new URL(url).pathname.startsWith(proposalPath);
    } catch {
        return false;
    }
}

export function readNoPublishEnv(source: NodeJS.ProcessEnv = process.env): NoPublishEnv {
    const base = readE2EEnv(source);
    const problems: string[] = [];
    const qaEmail = source[SYNTHETIC_QA_EMAIL_VAR]?.trim() ?? "";
    const qaPassword = source[SYNTHETIC_QA_PASSWORD_VAR]?.trim() ?? "";
    if (!qaEmail) problems.push(`${SYNTHETIC_QA_EMAIL_VAR} is not set.`);
    if (!qaPassword) problems.push(`${SYNTHETIC_QA_PASSWORD_VAR} is not set.`);
    if (qaEmail && !isSyntheticQaLabel(qaEmail)) {
        problems.push(
            `${SYNTHETIC_QA_EMAIL_VAR} must be a labelled synthetic @${SYNTHETIC_EMAIL_DOMAIN} identity (local part contains e2e-qa).`,
        );
    }
    if (problems.length > 0) throw new E2EConfigurationError(problems);
    return { ...base, qaEmail, qaPassword };
}
