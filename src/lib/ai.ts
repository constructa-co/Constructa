/**
 * Shared AI utility for Constructa
 * Uses OpenAI gpt-4o-mini as primary — fast, cheap, reliable, stable API
 */

import OpenAI from "openai";
import type { ZodTypeAny, z } from "zod";

export function getAIClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    return new OpenAI({ apiKey });
}

export async function generateText(prompt: string): Promise<string> {
    const client = getAIClient();
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
    });
    return response.choices[0]?.message?.content?.trim() || "";
}

// ── generateJSON hardening (P1-6) ──────────────────────────────────────────
//
// Previously this was a single-attempt JSON.parse with no schema checking
// and no retry, so a malformed AI response would either throw unhandled or
// silently return {} — which is how "undefined" ended up injected into
// proposal editor textareas and similar user-visible places.
//
// Now:
// - Optional Zod schema validation
// - One automatic retry on malformed output
// - Structured logging by `feature` tag so we can grep Vercel logs for
//   a specific caller when something breaks
// - Throws a specific Error with the feature name attached so callers
//   can show a meaningful toast

export interface GenerateJSONOptions<T extends ZodTypeAny> {
    /** Caller identifier for structured logging — e.g. "proposal.scope-draft". */
    feature: string;
    /** Optional Zod schema to validate the parsed object against. */
    schema?: T;
    /** Max attempts (including the first). Default 2 — one retry. */
    maxAttempts?: number;
}

export async function generateJSON<T>(
    prompt: string,
    options?: Partial<GenerateJSONOptions<ZodTypeAny>>,
): Promise<T> {
    const feature = options?.feature ?? "unknown";
    const schema = options?.schema;
    const maxAttempts = Math.max(1, options?.maxAttempts ?? 2);

    const client = getAIClient();
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                response_format: { type: "json_object" },
            });
            const text = response.choices[0]?.message?.content?.trim() || "{}";

            let parsed: unknown;
            try {
                parsed = JSON.parse(text);
            } catch (parseErr) {
                throw new Error(
                    `JSON parse failed: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
                );
            }

            if (schema) {
                const result = schema.safeParse(parsed);
                if (!result.success) {
                    const issues = result.error.issues
                        .slice(0, 3)
                        .map((i: z.ZodIssue) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                        .join("; ");
                    throw new Error(`Schema validation failed: ${issues}`);
                }
                return result.data as T;
            }

            return parsed as T;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            console.error(
                `[AI:${feature}] generateJSON attempt ${attempt}/${maxAttempts} failed:`,
                lastError.message,
            );
            // Fall through to retry unless this was the final attempt
        }
    }

    const finalError = lastError ?? new Error("generateJSON failed with unknown error");
    console.error(
        `[AI:${feature}] generateJSON exhausted ${maxAttempts} attempt(s):`,
        finalError.message,
    );
    throw new Error(`AI generation failed (${feature}): ${finalError.message}`);
}

// ── generateStructured ──────────────────────────────────────────────────────
//
// For callers that put a contractor's own words in front of the model and
// must not pay for, wait on, or be steered by more than they asked for:
//
// - rules go in the system message and the contractor's text in the user
//   message, so the two are never one undifferentiated prompt;
// - one attempt, with no hidden retry: a second call is the caller's decision;
// - a hard time limit and a hard output cap;
// - the reply must be JSON matching the caller's schema;
// - the model and token counts are returned, so a caller can record them.
//
// This does not limit how often it is called. The two features that have a
// usage budget reach it only through `withAiBudget` in `ai-budget.ts`. Do
// not call it directly for a contractor-facing feature.

export interface GenerateStructuredOptions<T extends ZodTypeAny> {
    /** Caller identifier for structured logging — e.g. "profile.rewrite". */
    feature: string;
    /** The rules. Never contains contractor text. */
    system: string;
    /** The contractor's text, as data. Callers should pass JSON. */
    user: string;
    schema: T;
    maxOutputTokens: number;
    timeoutMs: number;
    /** Default 0.2: restating, not inventing. */
    temperature?: number;
}

export interface StructuredResult<T> {
    data: T;
    model: string;
    usage: { promptTokens: number; completionTokens: number };
}

/**
 * The provider answered, and was paid for answering, but the reply cannot be
 * used: it is not JSON, does not match the schema, or was cut off. The usage
 * it reported is carried here so a caller keeping a budget can charge what
 * was really spent instead of guessing. No reply text is carried.
 *
 * A failure with no response at all (network, timeout, provider error) is a
 * plain Error: nothing is known about what it cost.
 */
export class AiResponseError extends Error {
    constructor(
        feature: string,
        readonly reason: "not-json" | "wrong-shape" | "cut-off",
        readonly model: string | null,
        readonly usage: { promptTokens: number; completionTokens: number } | null,
    ) {
        super(`AI generation failed (${feature}): the reply was ${reason}`);
        this.name = "AiResponseError";
    }
}

export async function generateStructured<T extends ZodTypeAny>(options: GenerateStructuredOptions<T>): Promise<StructuredResult<z.infer<T>>> {
    const { feature, system, user, schema, maxOutputTokens, timeoutMs } = options;
    const client = getAIClient();
    try {
        const response = await client.chat.completions.create(
            {
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                temperature: options.temperature ?? 0.2,
                max_tokens: maxOutputTokens,
                response_format: { type: "json_object" },
            },
            // One call only: the SDK's own retries are switched off as well.
            { timeout: timeoutMs, maxRetries: 0 },
        );
        const choice = response.choices[0];
        // Usage is only trusted when the provider actually reported it.
        const usage = typeof response.usage?.completion_tokens === "number"
            ? { promptTokens: response.usage.prompt_tokens ?? 0, completionTokens: response.usage.completion_tokens }
            : null;
        const model = typeof response.model === "string" ? response.model : null;

        if (choice?.finish_reason === "length") throw new AiResponseError(feature, "cut-off", model, usage);
        let json: unknown;
        try {
            json = JSON.parse(choice?.message?.content?.trim() || "{}");
        } catch {
            throw new AiResponseError(feature, "not-json", model, usage);
        }
        const parsed = schema.safeParse(json);
        if (!parsed.success) throw new AiResponseError(feature, "wrong-shape", model, usage);
        // A usable reply with no usage figure cannot be budgeted, so it is not usable.
        if (!usage || !model) throw new AiResponseError(feature, "wrong-shape", model, usage);
        return { data: parsed.data, model, usage };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[AI:${feature}] generateStructured failed:`, message);
        if (err instanceof AiResponseError) throw err;
        throw new Error(`AI generation failed (${feature}): ${message}`);
    }
}
