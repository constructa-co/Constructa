import "server-only";

import { z } from "zod";
import type { AssistantTurnMessage } from "@/lib/assistant-transport";
import type { JobAssistantOffReason } from "@/lib/job-assistant-readiness";

/**
 * A055 generation seam for the job assistant: one approved configuration, a
 * provider transport and a usage ledger, all chosen by the server. It is wired
 * into the pricing, planning and Brief request paths through
 * `job-assistant-transport.ts`. Production adapters (transport + RPC ledger) exist,
 * but activation is OFF: `APPROVED_GENERATION` is null for every feature, so each
 * activation point returns null until an approval is configured and every
 * prerequisite there is met.
 *
 * An attempt runs: bounds check, including the worst-case cost of this exact
 * request at the approved prices, which the reservation must cover ->
 * reservation -> one provider call under the configured timeout -> settle (the
 * provider reported the cost), release (the provider confirmed nothing was
 * sent) or retain (the paid outcome is unknown, so the whole reservation is
 * kept) -> the request path records its outcome. A reported cost above the
 * reservation is recorded as charged, counts against the caps, and the reply
 * is refused: there is no refund or cancellation guarantee.
 * Any missing piece or failed step refuses the reply; nothing is written to the
 * job and the existing review-before-apply rules are unchanged.
 */
export const JOB_ASSISTANT_FEATURES = ["pricing", "planning", "brief"] as const;
export type JobAssistantFeature = typeof JOB_ASSISTANT_FEATURES[number];

// Safety ceilings an approved configuration must sit within. They are not
// approved limits, and there are deliberately no model or money defaults.
const CEILING = { messages: 24, inputChars: 60_000, outputTokens: 4_000, timeoutMs: 60_000 } as const;

const ConfigSchema = z.object({
    feature: z.enum(JOB_ASSISTANT_FEATURES),
    approval: z.object({
        ref: z.string().trim().min(1).max(200),
        approvedBy: z.string().trim().min(1).max(200),
        approvedAt: z.string().datetime(),
    }).strict(),
    provider: z.string().trim().min(1).max(60),
    model: z.string().trim().min(1).max(100),
    maxOutputTokens: z.number().int().positive().max(CEILING.outputTokens),
    timeoutMs: z.number().int().positive().max(CEILING.timeoutMs),
    maxMessages: z.number().int().positive().max(CEILING.messages),
    maxInputChars: z.number().int().positive().max(CEILING.inputChars),
    // Approved provider prices, in pence per million tokens. Not defaults: an
    // approval states them, and the worst-case cost below is computed from them.
    prices: z.object({
        inputPencePerMillionTokens: z.number().positive().max(1_000_000),
        outputPencePerMillionTokens: z.number().positive().max(1_000_000),
    }).strict(),
    // Whole pence. One attempt reserves `attemptPence`; the ledger holds the caps.
    attemptPence: z.number().int().positive(),
    perJobPence: z.number().int().positive(),
    monthlyPence: z.number().int().positive(),
}).strict().refine(config => config.attemptPence <= config.perJobPence && config.perJobPence <= config.monthlyPence);
export type JobAssistantGenerationConfig = z.infer<typeof ConfigSchema>;

export type TransportResult =
    | { kind: "reply"; raw: unknown; costPence: number }
    // Only when the provider confirms the request was never sent or charged.
    | { kind: "not_sent" };
export type TransportRequest = {
    provider: string; model: string; maxOutputTokens: number; prices: JobAssistantGenerationConfig["prices"];
    context: unknown; messages: AssistantTurnMessage[]; signal: AbortSignal;
};
export interface JobAssistantTransport {
    /** An upper bound on the input tokens `send` would bill for this exact request, prompt included. */
    maxInputTokens(request: Pick<TransportRequest, "context" | "messages">): number;
    send(request: TransportRequest): Promise<TransportResult>;
}
/** One provider the server can call. `configured` checks its server prerequisites without making a client. */
export interface JobAssistantProvider {
    configured(): boolean;
    transport(systemPrompt: string): JobAssistantTransport;
}

/** The approved configuration for this feature, or null when it is missing, invalid or for another feature. */
export function approvedConfig(feature: JobAssistantFeature, config: unknown): JobAssistantGenerationConfig | null {
    const parsed = ConfigSchema.safeParse(config);
    return parsed.success && parsed.data.feature === feature ? parsed.data : null;
}

/** Whole pence, rounded up, for the given token counts at the approved prices. */
export function costPence(prices: JobAssistantGenerationConfig["prices"], inputTokens: number, outputTokens: number): number {
    return Math.ceil((inputTokens * prices.inputPencePerMillionTokens + outputTokens * prices.outputPencePerMillionTokens) / 1_000_000);
}

export type AttemptOutcome = "reply" | "rejected" | "stale" | "unavailable";
export type RetainReason = "cancelled" | "failed" | "unreadable_usage";
export interface UsageLedger {
    /** Atomically holds `pence` for the attempt within the per-job and monthly caps. */
    reserve(reservation: {
        attemptId: string; feature: JobAssistantFeature; userId: string; projectId: string; revision: string;
        provider: string; model: string; approvalRef: string; pence: number;
        caps: { perJobPence: number; monthlyPence: number };
    }): Promise<{ ok: boolean }>;
    settle(attemptId: string, pence: number): Promise<void>;
    release(attemptId: string): Promise<void>;
    retain(attemptId: string, reason: RetainReason): Promise<void>;
    conclude(attemptId: string, outcome: AttemptOutcome): Promise<void>;
}

export type GenerationInput<C> = {
    userId: string; projectId: string; revision: string; attemptId: string;
    context: C; messages: AssistantTurnMessage[]; signal: AbortSignal;
};
/** A server generator. `conclude` records what the request path did with the reply; false means it could not. */
export interface JobAssistantGenerator<C> {
    (input: GenerationInput<C>): Promise<unknown>;
    conclude?: (attemptId: string, outcome: AttemptOutcome) => Promise<boolean>;
}

/** A generator, or how to prepare one; the request path prepares it only after the request is verified. */
export type GeneratorSource<G> = G | { prepare(): Promise<G | null>; refusal?(): JobAssistantOffReason | null };
export async function resolveGenerator<G>(source: GeneratorSource<G> | undefined): Promise<G | undefined> {
    if (!source || typeof source === "function") return source as G | undefined;
    try {
        return (await (source as { prepare(): Promise<G | null> }).prepare()) ?? undefined;
    } catch {
        return undefined;
    }
}
/** Why `resolveGenerator` found nothing, when the source can say. Asked only for a verified owner's turn. */
export function generatorRefusal<G>(source: GeneratorSource<G> | undefined): JobAssistantOffReason | null {
    if (!source || typeof source === "function") return null;
    return (source as { refusal?(): JobAssistantOffReason | null }).refusal?.() ?? null;
}

/** Thrown when an attempt is refused; the request path answers "unavailable". */
export class GenerationRefused extends Error {
    constructor(readonly reason: "bounds" | "cost" | "reservation" | "transport" | "not_sent" | "usage" | "overspend" | "cancelled" | "ledger") {
        super(`Job assistant generation refused: ${reason}`);
        this.name = "GenerationRefused";
    }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[a-f0-9]{64}$/;

/** Null unless the configuration is approved and valid for this feature and both a transport and a ledger exist. */
export function createJobAssistantGenerator<C>(feature: JobAssistantFeature, deps: {
    config: unknown; transport: JobAssistantTransport | null; ledger: UsageLedger | null;
}): JobAssistantGenerator<C> | null {
    const config = approvedConfig(feature, deps.config);
    if (!config || !deps.transport || !deps.ledger
        || typeof deps.transport.maxInputTokens !== "function" || typeof deps.transport.send !== "function") return null;
    const transport = deps.transport;
    const ledger = deps.ledger;
    /** Attempt ids this generator instance successfully reserved; only those may be concluded here. */
    const confirmedReservations = new Set<string>();

    const generate: JobAssistantGenerator<C> = async input => {
        const size = JSON.stringify(input.context ?? null).length + input.messages.reduce((total, item) => total + item.content.length, 0);
        if (!UUID.test(input.attemptId) || !UUID.test(input.projectId) || !SHA256.test(input.revision) || !input.userId
            || !input.messages.length || input.messages.length > config.maxMessages || size > config.maxInputChars) throw new GenerationRefused("bounds");
        // P2-3: the reservation must cover the worst this exact request can cost, before anything is held or sent.
        let worst = Number.NaN;
        try {
            worst = costPence(config.prices, transport.maxInputTokens({ context: input.context, messages: input.messages }), config.maxOutputTokens);
        } catch {
            worst = Number.NaN;
        }
        if (!Number.isFinite(worst) || worst > config.attemptPence) throw new GenerationRefused("cost");

        let held = false;
        try {
            held = (await ledger.reserve({
                attemptId: input.attemptId, feature, userId: input.userId, projectId: input.projectId, revision: input.revision,
                provider: config.provider, model: config.model, approvalRef: config.approval.ref, pence: config.attemptPence,
                caps: { perJobPence: config.perJobPence, monthlyPence: config.monthlyPence },
            })).ok === true;
        } catch {
            held = false;
        }
        if (!held) throw new GenerationRefused("reservation");
        confirmedReservations.add(input.attemptId);

        const signal = AbortSignal.any([input.signal, AbortSignal.timeout(config.timeoutMs)]);
        const record = async (step: () => Promise<void>) => {
            try { await step(); } catch { throw new GenerationRefused("ledger"); }
        };
        let result: TransportResult;
        try {
            if (signal.aborted) throw new Error("aborted");
            result = await transport.send({
                provider: config.provider, model: config.model, maxOutputTokens: config.maxOutputTokens, prices: config.prices,
                context: input.context, messages: input.messages, signal,
            });
        } catch {
            // Whether the provider charged is unknown: keep the whole reservation.
            await record(() => ledger.retain(input.attemptId, signal.aborted ? "cancelled" : "failed"));
            throw new GenerationRefused(signal.aborted ? "cancelled" : "transport");
        }
        if (result?.kind === "not_sent") {
            await record(() => ledger.release(input.attemptId));
            throw new GenerationRefused("not_sent");
        }
        if (result?.kind !== "reply" || !Number.isInteger(result.costPence) || result.costPence < 0) {
            await record(() => ledger.retain(input.attemptId, "unreadable_usage"));
            throw new GenerationRefused("usage");
        }
        // Recorded as charged even above the reservation, so it counts against the caps.
        await record(() => ledger.settle(input.attemptId, result.costPence));
        if (result.costPence > config.attemptPence) throw new GenerationRefused("overspend");
        // Paid for, but the request was cancelled meanwhile: do not use the reply.
        if (signal.aborted) throw new GenerationRefused("cancelled");
        return result.raw;
    };
    generate.conclude = async (attemptId, outcome) => {
        if (!confirmedReservations.delete(attemptId)) return false;
        try {
            await ledger.conclude(attemptId, outcome);
            return true;
        } catch {
            return false;
        }
    };
    return generate;
}
