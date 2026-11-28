import { describe, expect, it } from "vitest";
import { readComplete, readCompleteForIds, type PageResult } from "./live-read";

const dbError = { code: "57014", message: "canceling statement due to statement timeout" };
const rows = (n: number, prefix = "r") => Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${String(i).padStart(5, "0")}`, amount: 1 }));

/**
 * A fake paged table: returns at most `cap` rows per request (like the
 * database API's `max_rows`), with an exact count, and records each range asked for.
 */
function table(all: { id: string }[], options: { cap?: number; failFrom?: number; count?: (page: number) => number | null | undefined } = {}) {
    const ranges: [number, number][] = [];
    const page = async (from: number, to: number): Promise<PageResult<{ id: string }>> => {
        ranges.push([from, to]);
        if (options.failFrom !== undefined && from >= options.failFrom) return { data: null, error: dbError, count: null };
        const count = options.count ? options.count(ranges.length - 1) : all.length;
        return { data: all.slice(from, Math.min(to + 1, from + (options.cap ?? 1000))), error: null, count };
    };
    return { page, ranges };
}

describe("readComplete", () => {
    it("reads every row past the 1,000-row cap, page by page", async () => {
        const all = rows(2500);
        const fake = table(all);
        const read = await readComplete(fake.page);
        expect(read).toEqual({ ok: true, rows: all });
        expect(fake.ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    });

    it("keeps reading when the server returns fewer rows than asked, instead of taking a short page as the end", async () => {
        const all = rows(1300);
        const fake = table(all, { cap: 400 });
        const read = await readComplete(fake.page);
        expect(read.ok && read.rows.length).toBe(1300);
        expect(fake.ranges.map(([from]) => from)).toEqual([0, 400, 800, 1200]);
    });

    it("returns a genuine empty result, in one request, when the count is zero", async () => {
        const fake = table([]);
        expect(await readComplete(fake.page)).toEqual({ ok: true, rows: [] });
        expect(fake.ranges).toHaveLength(1);
    });

    it("fails, with no partial rows, when a later page errors", async () => {
        const read = await readComplete(table(rows(2500), { failFrom: 1000 }).page);
        expect(read).toEqual({ ok: false, reason: "error", detail: dbError });
    });

    it("fails when the read does not report an exact count, since completeness cannot be proven", async () => {
        const read = await readComplete(table(rows(10), { count: () => null }).page);
        expect(read).toMatchObject({ ok: false, reason: "incomplete" });
    });

    it("fails when the count changes between pages", async () => {
        const read = await readComplete(table(rows(1500), { count: (page) => (page === 0 ? 1500 : 1501) }).page);
        expect(read).toMatchObject({ ok: false, reason: "incomplete", detail: "the row count changed while reading" });
    });

    it("fails when a page comes back empty before every counted row is read", async () => {
        const read = await readComplete(table(rows(1000), { count: () => 1200 }).page);
        expect(read).toMatchObject({ ok: false, reason: "incomplete" });
    });

    it("fails when more rows arrive than were counted", async () => {
        const read = await readComplete(table(rows(5), { count: () => 3 }).page);
        expect(read).toMatchObject({ ok: false, reason: "incomplete" });
    });

    it("fails when a row arrives twice across pages", async () => {
        const all = rows(1500);
        const repeated = [...all.slice(0, 1000), all[999], ...all.slice(1000, 1499)];
        const read = await readComplete(table(repeated).page);
        expect(read).toMatchObject({ ok: false, reason: "incomplete", detail: "a row was returned twice across pages" });
    });

    it("reports a source above the safe row limit as too large after one request, rather than reading it", async () => {
        const fake = table(rows(30));
        const read = await readComplete(fake.page, { maxRows: 20 });
        expect(read).toMatchObject({ ok: false, reason: "too-large", detail: { count: 30, maxRows: 20 } });
        expect(fake.ranges).toHaveLength(1);
    });

    it("stops at the page limit when the server cap is tiny, rather than looping", async () => {
        const fake = table(rows(100), { cap: 1 });
        const read = await readComplete(fake.page, { maxPages: 10 });
        expect(read).toMatchObject({ ok: false, reason: "too-large" });
        expect(fake.ranges).toHaveLength(10);
    });
});

describe("readCompleteForIds", () => {
    it("reads each chunk of ids in full and never sends more than the chunk size in one filter", async () => {
        const ids = Array.from({ length: 250 }, (_, i) => `job-${i}`);
        const chunks: string[][] = [];
        const read = await readCompleteForIds(ids, async (chunk, from, to) => {
            if (from === 0) chunks.push(chunk);
            const all = chunk.flatMap((id) => rows(12, id));
            return { data: all.slice(from, Math.min(to + 1, from + 1000)), error: null, count: all.length };
        });
        expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 50]);
        expect(read.ok && read.rows.length).toBe(250 * 12);
    });

    it("makes no request and returns a genuine empty result for no ids", async () => {
        let requests = 0;
        const read = await readCompleteForIds([], async () => { requests += 1; return { data: [], error: null, count: 0 }; });
        expect(read).toEqual({ ok: true, rows: [] });
        expect(requests).toBe(0);
    });

    it("fails the whole read when a later chunk fails", async () => {
        const ids = Array.from({ length: 150 }, (_, i) => `job-${i}`);
        const read = await readCompleteForIds(ids, async (chunk) =>
            chunk[0] === "job-100" ? { data: null, error: dbError, count: null } : { data: rows(1, chunk[0]), error: null, count: 1 });
        expect(read).toEqual({ ok: false, reason: "error", detail: dbError });
    });

    it("shares one request budget across chunks and stops at it, with no further query", async () => {
        const ids = Array.from({ length: 250 }, (_, i) => `job-${i}`);
        const requested: string[] = [];
        // One row per request, three rows per chunk: each chunk alone needs three requests.
        const read = await readCompleteForIds(ids, async (chunk, from) => {
            requested.push(`${chunk[0]}@${from}`);
            const all = rows(3, chunk[0]);
            return { data: all.slice(from, from + 1), error: null, count: all.length };
        }, { maxPages: 5 });
        expect(read).toMatchObject({ ok: false, reason: "too-large" });
        // Three for the first chunk, the two left for the second, none for the third.
        expect(requested).toEqual(["job-0@0", "job-0@1", "job-0@2", "job-100@0", "job-100@1"]);
    });

    it("shares one row limit across chunks", async () => {
        const ids = Array.from({ length: 150 }, (_, i) => `job-${i}`);
        const read = await readCompleteForIds(ids, async (chunk, from, to) => {
            const all = chunk.flatMap((id) => rows(1, id));
            return { data: all.slice(from, to + 1), error: null, count: all.length };
        }, { maxRows: 120 });
        expect(read).toMatchObject({ ok: false, reason: "too-large" });
    });
});
