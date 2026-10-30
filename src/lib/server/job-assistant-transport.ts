import type { BriefConversationContext } from "@/lib/brief-conversation";
import type { PlanningContext } from "@/lib/planning-conversation";
import type { pricingModelData } from "@/lib/pricing-review";
import { aiEmergencyStop } from "@/lib/ai-budget";
import {
    approvedConfig, createJobAssistantGenerator, JOB_ASSISTANT_FEATURES, type JobAssistantFeature,
    type JobAssistantGenerator, type JobAssistantProvider,
} from "./job-assistant-generation";
import { createRpcUsageLedger, type ActivationLedger } from "./job-assistant-ledger";
import { BRIEF_SYSTEM_PROMPT, PLANNING_SYSTEM_PROMPT, PRICING_SYSTEM_PROMPT } from "./job-assistant-prompts";
import { deepSeekJobAssistantProvider, openAIJobAssistantProvider } from "./openai-job-assistant-transport";

/**
 * A055 server-side activation point for the job assistant.
 *
 * A generator receives only context the server rebuilt from saved rows for
 * the authenticated owner, plus the conversation, the job and the revision it
 * was checked against. It is chosen here, never by the request, and it runs
 * through the generation seam in `job-assistant-generation.ts`: bounds,
 * reservation, one provider call, settle/release/retain, recorded outcome.
 *
 * On non-QA targets every activation point still returns null until the
 * ledger and Preview prerequisites are met. Each feature already has its
 * its OpenAI transport adapter and prompt here; reply JSON is mapped in
 * `openai-job-assistant-transport` and reviewed on the request path. The usage
 * ledger migration is source only (NOT applied, disabled).
 *
 * One readiness contract, `prepare` below, decides both what the pages offer
 * and what the request handlers get, so a page never offers a feature the
 * handler would refuse for a missing prerequisite. In order, each failing
 * closed before the next is touched: the operator's emergency stop is off;
 * this feature's approval is valid; every approved feature states the same
 * combined per-job and monthly caps (the ledger counts all three together);
 * the approved provider has an adapter here and its key is on the server; the
 * usage ledger's settings row is enabled with ceilings that admit the caps.
 * No client, key, provider call or ledger write happens before all of these.
 * The existing `AiFeature` budgets (`brief.suggest`, the weekly client update
 * `schedule.programme-update` and the rest) are other features and must not be
 * borrowed. This module holds no secret or provider today.
 *
 * DeepSeek QA (Rob, 2026-10-29T16:02:32.065Z QA approval reread): `deepseek-flash`
 * on the verified QA Preview target only, with peak uncached budget prices
 * (25p / 100p per million input/output tokens), attempt/per-job/monthly caps
 * 10 / 10 / 2000 pence, and original technical ceilings. Production and other
 * targets stay OFF (`null` approvals). Ledger migration apply + enabled row
 * remain prerequisites before `covers()` passes.
 */
const QA_DEEPSEEK_APPROVAL_AT = "2026-10-29T16:02:32.065Z";
const QA_DEEPSEEK_APPROVAL_REF = "rob-qa-deepseek-flash-20261029T160232065Z";

function deepSeekQaApproval(feature: JobAssistantFeature) {
    if (!deepSeekJobAssistantProvider.configured()) return null;
    return {
        feature,
        approval: { ref: QA_DEEPSEEK_APPROVAL_REF, approvedBy: "Rob", approvedAt: QA_DEEPSEEK_APPROVAL_AT },
        provider: "deepseek",
        model: "deepseek-flash",
        maxOutputTokens: 4_000,
        timeoutMs: 60_000,
        maxMessages: 24,
        maxInputChars: 60_000,
        prices: { inputPencePerMillionTokens: 25, outputPencePerMillionTokens: 100 },
        attemptPence: 10,
        perJobPence: 10,
        monthlyPence: 2_000,
    };
}

export const APPROVED_GENERATION = {
    get pricing() { return deepSeekQaApproval("pricing"); },
    get planning() { return deepSeekQaApproval("planning"); },
    get brief() { return deepSeekQaApproval("brief"); },
} satisfies Record<JobAssistantFeature, unknown>;

// No client or key is made here: the transport makes its client only inside a send.
const FEATURE_PROMPTS: Record<JobAssistantFeature, string> = {
    pricing: PRICING_SYSTEM_PROMPT,
    planning: PLANNING_SYSTEM_PROMPT,
    brief: BRIEF_SYSTEM_PROMPT,
};

/** What the activation point depends on. Only tests pass anything other than the server's own. */
export type JobAssistantActivation = {
    approvals: Record<JobAssistantFeature, unknown>;
    stopped: () => boolean;
    providers: Record<string, JobAssistantProvider>;
    // The service-role client is made only inside a ledger step or the settings read.
    ledger: () => ActivationLedger;
};
/** The providers the server can call. An approval names one; none is chosen automatically after another. */
export const JOB_ASSISTANT_PROVIDERS: Record<string, JobAssistantProvider> = {
    openai: openAIJobAssistantProvider,
    deepseek: deepSeekJobAssistantProvider,
};
const SERVER_ACTIVATION: JobAssistantActivation = {
    approvals: APPROVED_GENERATION,
    stopped: aiEmergencyStop,
    providers: JOB_ASSISTANT_PROVIDERS,
    ledger: () => createRpcUsageLedger(),
};

export type ServerPricingGenerator = JobAssistantGenerator<ReturnType<typeof pricingModelData>>;
export type ServerPlanningGenerator = JobAssistantGenerator<PlanningContext>;
export type ServerBriefGenerator = JobAssistantGenerator<BriefConversationContext>;

async function prepare<C>(feature: JobAssistantFeature, activation: JobAssistantActivation): Promise<JobAssistantGenerator<C> | null> {
    if (activation.stopped()) return null;
    const config = approvedConfig(feature, activation.approvals[feature]);
    if (!config) return null;
    for (const other of JOB_ASSISTANT_FEATURES) {
        if (activation.approvals[other] == null) continue;
        const theirs = approvedConfig(other, activation.approvals[other]);
        if (!theirs || theirs.perJobPence !== config.perJobPence || theirs.monthlyPence !== config.monthlyPence) return null;
    }
    const provider = Object.hasOwn(activation.providers, config.provider) ? activation.providers[config.provider] : undefined;
    if (!provider || !provider.configured()) return null;
    const ledger = activation.ledger();
    if (!await ledger.covers(config)) return null;
    return createJobAssistantGenerator<C>(feature, { config, transport: provider.transport(FEATURE_PROMPTS[feature]), ledger });
}

export function approvedPricingGenerator(activation = SERVER_ACTIVATION): Promise<ServerPricingGenerator | null> {
    return prepare("pricing", activation);
}

export function approvedPlanningGenerator(activation = SERVER_ACTIVATION): Promise<ServerPlanningGenerator | null> {
    return prepare("planning", activation);
}

/** A055 Brief. Not approved either: same requirements as above, for its own feature. */
export function approvedBriefGenerator(activation = SERVER_ACTIVATION): Promise<ServerBriefGenerator | null> {
    return prepare("brief", activation);
}

/** What a page tells the browser: the same contract the handler meets again on every request. */
export async function jobAssistantAvailable(feature: JobAssistantFeature, activation = SERVER_ACTIVATION): Promise<boolean> {
    try {
        return (await prepare(feature, activation)) !== null;
    } catch {
        return false;
    }
}
