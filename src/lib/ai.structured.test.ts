import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const create = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({ default: class { chat = { completions: { create } }; } }));

import { AiResponseError, generateStructured } from "./ai";

const Schema = z.object({ text: z.string().min(1) });
const reply = (content: string, extra: Record<string, unknown> = {}) => ({
    model: "gpt-4o-mini-2024-07-18",
    choices: [{ message: { content }, finish_reason: "stop", ...extra }],
    usage: { prompt_tokens: 120, completion_tokens: 40 },
});
const call = () => generateStructured({ feature: "test.feature", system: "RULES", user: '{"text":"hello"}', schema: Schema, maxOutputTokens: 300, timeoutMs: 5000 });

describe("generateStructured", () => {
    beforeEach(() => {
        create.mockReset();
        vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("keeps the rules and the contractor's text in separate roles, and bounds time and output", async () => {
        create.mockResolvedValue(reply('{"text":"tidy"}'));
        const result = await call();

        expect(create).toHaveBeenCalledTimes(1);
        const [body, options] = create.mock.calls[0];
        expect(body.messages).toEqual([{ role: "system", content: "RULES" }, { role: "user", content: '{"text":"hello"}' }]);
        expect(body).toMatchObject({ model: "gpt-4o-mini", max_tokens: 300, temperature: 0.2, response_format: { type: "json_object" } });
        expect(options).toEqual({ timeout: 5000, maxRetries: 0 });
        expect(result).toEqual({ data: { text: "tidy" }, model: "gpt-4o-mini-2024-07-18", usage: { promptTokens: 120, completionTokens: 40 } });
    });

    it.each([
        ["a provider failure", () => create.mockRejectedValue(new Error("timeout"))],
        ["a reply that is not JSON", () => create.mockResolvedValue(reply("not json"))],
        ["a reply of the wrong shape", () => create.mockResolvedValue(reply('{"other":1}'))],
        ["a reply cut off at the output limit", () => create.mockResolvedValue(reply('{"text":"cut', { finish_reason: "length" }))],
    ])("makes exactly one call and throws on %s", async (_name, arrange) => {
        arrange();
        await expect(call()).rejects.toThrow("AI generation failed (test.feature)");
        expect(create).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["not JSON", reply("not json"), "not-json"],
        ["the wrong shape", reply('{"other":1}'), "wrong-shape"],
        ["cut off at the output limit", reply('{"text":"cut', { finish_reason: "length" }), "cut-off"],
    ] as const)("a reply that is %s carries the usage the provider reported, and no reply text", async (_name, response, reason) => {
        create.mockResolvedValue(response);
        const error = await call().catch((caught) => caught);
        expect(error).toBeInstanceOf(AiResponseError);
        expect(error).toMatchObject({ reason, model: "gpt-4o-mini-2024-07-18", usage: { promptTokens: 120, completionTokens: 40 } });
        expect(JSON.stringify({ ...error, message: error.message })).not.toMatch(/not json|other|cut"/);
    });

    it("a failure with no response is a plain error with nothing known about its cost", async () => {
        create.mockRejectedValue(new Error("socket hang up"));
        const error = await call().catch((caught) => caught);
        expect(error).not.toBeInstanceOf(AiResponseError);
        expect(error).not.toHaveProperty("usage");
    });

    it("does not invent usage: a reply with no usage figure is unusable and says the usage is unknown", async () => {
        create.mockResolvedValue({ model: "gpt-4o-mini-2024-07-18", choices: [{ message: { content: '{"text":"tidy"}' }, finish_reason: "stop" }] });
        const error = await call().catch((caught) => caught);
        expect(error).toBeInstanceOf(AiResponseError);
        expect(error.usage).toBeNull();

        create.mockResolvedValue({ model: "gpt-4o-mini-2024-07-18", choices: [{ message: { content: "nope" }, finish_reason: "stop" }], usage: { prompt_tokens: 5 } });
        expect((await call().catch((caught) => caught)).usage).toBeNull();
    });

    it("makes no call without a configured key", async () => {
        vi.stubEnv("OPENAI_API_KEY", "");
        await expect(call()).rejects.toThrow("OPENAI_API_KEY is not configured");
        expect(create).not.toHaveBeenCalled();
    });
});
