import "server-only";

import type OpenAI from "openai";
import { getAIClient } from "@/lib/ai";
import { costPence, type JobAssistantProvider, type JobAssistantTransport, type TransportRequest, type TransportResult } from "./job-assistant-generation";

/** The part of the installed OpenAI SDK this transport uses. Tests pass a fake. */
export type ChatClient = Pick<OpenAI, "chat">;

// Per-message framing the provider adds to the billed input, as a generous allowance.
const MESSAGE_OVERHEAD_TOKENS = 16;

/**
 * A055/A063 provider transport over the installed OpenAI SDK, for one job
 * assistant feature. It holds no key and makes no client until `send` runs,
 * which the generation seam calls only after an approved configuration and a
 * reservation. One call, no SDK retries, the seam's signal and timeout.
 *
 * Reply mapping: the provider's JSON object is returned as the raw reply for
 * the request path to review against the server's context. A reply that is
 * cut off or not JSON is returned as `null` (so it is rejected) with its cost.
 * The cost is the provider's reported token usage at the approved prices; when
 * usage is missing, or the reply names another model, the cost is unreadable
 * and the seam keeps the whole reservation.
 */
export function createOpenAIJobAssistantTransport(options: {
    systemPrompt: string;
    client?: () => ChatClient;
}): JobAssistantTransport {
    const client = options.client ?? getAIClient;
    const dataMessage = (context: unknown) => `Saved job data (JSON):\n${JSON.stringify(context ?? null)}`;

    return {
        maxInputTokens({ context, messages }) {
            // A billed token is at least one byte of UTF-8, so bytes bound tokens from above.
            const texts = [options.systemPrompt, dataMessage(context), ...messages.map(item => item.content)];
            return texts.reduce((total, text) => total + Buffer.byteLength(text, "utf8") + MESSAGE_OVERHEAD_TOKENS, MESSAGE_OVERHEAD_TOKENS);
        },

        async send(request: TransportRequest): Promise<TransportResult> {
            // Refused here, before any client exists: nothing was sent or charged.
            if (request.provider !== "openai" || request.signal.aborted) return { kind: "not_sent" };
            const response = await client().chat.completions.create(
                {
                    model: request.model,
                    messages: [
                        { role: "system", content: options.systemPrompt },
                        { role: "user", content: dataMessage(request.context) },
                        ...request.messages.map(item => ({ role: item.role, content: item.content })),
                    ],
                    max_completion_tokens: request.maxOutputTokens,
                    response_format: { type: "json_object" },
                },
                { signal: request.signal, maxRetries: 0 },
            );
            const usage = response.usage;
            const sameModel = typeof response.model === "string"
                && (response.model === request.model || response.model.startsWith(`${request.model}-`));
            const cost = sameModel && Number.isInteger(usage?.prompt_tokens) && Number.isInteger(usage?.completion_tokens)
                ? costPence(request.prices, usage!.prompt_tokens, usage!.completion_tokens)
                : Number.NaN;
            const choice = response.choices?.[0];
            let raw: unknown = null;
            if (choice?.finish_reason === "stop" && typeof choice.message?.content === "string") {
                try {
                    raw = JSON.parse(choice.message.content);
                } catch {
                    raw = null;
                }
            }
            return { kind: "reply", raw, costPence: cost };
        },
    };
}

/**
 * The OpenAI provider for the activation point. `configured` says whether the
 * server has a key, the same check `getAIClient` makes, without making a
 * client or using the key. Nothing here is approved; the activation point asks
 * only once a feature has an approved configuration naming this provider.
 */
export const openAIJobAssistantProvider: JobAssistantProvider = {
    configured: () => Boolean(process.env.OPENAI_API_KEY?.trim()),
    transport: systemPrompt => createOpenAIJobAssistantTransport({ systemPrompt }),
};
