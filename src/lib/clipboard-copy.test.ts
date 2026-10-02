import { describe, expect, it } from "vitest";
import { copyTextWithFallback } from "./clipboard-copy";

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("copyTextWithFallback", () => {
    it("reports copied when the write resolves", async () => {
        const writes: string[] = [];
        const outcome = await copyTextWithFallback("https://example.com/proposal/abc", {
            writeText: async (text) => {
                writes.push(text);
            },
        });
        expect(outcome).toBe("copied");
        expect(writes).toEqual(["https://example.com/proposal/abc"]);
    });

    it("reports failed when the write rejects", async () => {
        const outcome = await copyTextWithFallback("x", {
            writeText: () => Promise.reject(new Error("denied")),
        });
        expect(outcome).toBe("failed");
    });

    it("reports failed when the write throws synchronously", async () => {
        const outcome = await copyTextWithFallback("x", {
            writeText: () => {
                throw new Error("sync boom");
            },
        });
        expect(outcome).toBe("failed");
    });

    it("reports unavailable when no clipboard implementation exists", async () => {
        // Vitest runs in the node environment: no navigator.clipboard.
        const outcome = await copyTextWithFallback("x");
        expect(outcome).toBe("unavailable");
    });

    it("times out a write that never settles", async () => {
        const outcome = await copyTextWithFallback("x", {
            writeText: () => new Promise<void>(() => {}),
            timeoutMs: 25,
        });
        expect(outcome).toBe("timeout");
    });

    it("a write that rejects after the timeout does not surface an unhandled rejection", async () => {
        const outcome = await copyTextWithFallback("x", {
            writeText: async () => {
                await tick(50);
                throw new Error("late denial");
            },
            timeoutMs: 10,
        });
        expect(outcome).toBe("timeout");
        // Let the late rejection fire; vitest fails the run on unhandled rejections.
        await tick(100);
    });

    it("a write that resolves after the timeout still reports timeout and does not throw", async () => {
        const outcome = await copyTextWithFallback("x", {
            writeText: async () => {
                await tick(50);
            },
            timeoutMs: 10,
        });
        expect(outcome).toBe("timeout");
        await tick(100);
    });
});
