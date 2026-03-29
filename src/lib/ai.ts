/**
 * Shared AI utility for Constructa
 * Uses OpenAI gpt-4o-mini as primary — fast, cheap, reliable, stable API
 */

import OpenAI from "openai";

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

export async function generateJSON<T>(prompt: string): Promise<T> {
    const client = getAIClient();
    const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
    });
    const text = response.choices[0]?.message?.content?.trim() || "{}";
    return JSON.parse(text) as T;
}
