import { describe, expect, it, vi } from "vitest";
import { createLatestWriteQueue } from "./latest-write-queue";

describe("createLatestWriteQueue", () => {
    it("serialises writes and coalesces pending snapshots to the newest value", async () => {
        let releaseFirst!: () => void;
        const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
        const write = vi.fn(async (value: number) => {
            if (value === 1) await firstBlocked;
            return value;
        });
        const enqueue = createLatestWriteQueue(write);

        const first = enqueue(1);
        const second = enqueue(2);
        const third = enqueue(3);
        releaseFirst();

        await expect(Promise.all([first, second, third])).resolves.toEqual([3, 3, 3]);
        expect(write.mock.calls).toEqual([[1], [3]]);
    });

    it("accepts a retry after a failed drain", async () => {
        const write = vi.fn()
            .mockRejectedValueOnce(new Error("offline"))
            .mockResolvedValueOnce("saved");
        const enqueue = createLatestWriteQueue<string, string>(write);

        await expect(enqueue("draft one")).rejects.toThrow("offline");
        await expect(enqueue("draft two")).resolves.toBe("saved");
    });

    it("persists the newest queued snapshot after an in-flight write rejects", async () => {
        let rejectFirst!: (error: Error) => void;
        const firstBlocked = new Promise<string>((_, reject) => { rejectFirst = reject; });
        const write = vi.fn((value: string) => (
            value === "draft one" ? firstBlocked : Promise.resolve(value)
        ));
        const enqueue = createLatestWriteQueue(write);

        const first = enqueue("draft one");
        const latest = enqueue("draft two");
        rejectFirst(new Error("offline"));

        await expect(Promise.all([first, latest])).resolves.toEqual(["draft two", "draft two"]);
        expect(write.mock.calls).toEqual([["draft one"], ["draft two"]]);
    });
});
