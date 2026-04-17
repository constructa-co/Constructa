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
