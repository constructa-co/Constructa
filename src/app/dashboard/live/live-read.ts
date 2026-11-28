/**
 * Complete reads for Live Projects (D130, the D124 N2.5 residual).
 *
 * The database API caps every response (`max_rows = 1000` in
 * supabase/config.toml) and a capped response carries no error. A plain read
 * of a large job's cost entries, or of a large portfolio's invoices, would
 * quietly return the first 1,000 rows and every total built on it would look
 * complete while being short.
 *
 * `readComplete` reads page by page in a fixed order and only returns rows when
 * it can prove it has all of them:
 *  - every page asks for an exact count, and the count must be present and the
 *    same on every page;
 *  - it keeps reading until it holds exactly that many rows, advancing by the
 *    rows actually received, so a server cap smaller than the page size is
 *    still read in full rather than mistaken for the last page;
 *  - no row may arrive twice, and an empty page before the count is reached
 *    stops the read.
 * Anything else (an error on any page, a missing or changed count, a short or
 * long read, or more rows than the safe limit) returns `ok: false`, and the
 * page shows that figure as unavailable or throws, never a partial total.
 *
 * Limits, stated rather than hidden:
 *  - a source with more than LIVE_READ_MAX_ROWS rows, or needing more than
 *    LIVE_READ_MAX_PAGES requests in all (shared across every id chunk), is
 *    reported as unavailable instead of being read;
 *  - this proves a counted, paged read is complete while the data is stable.
 *    It is not a transactional snapshot: pages are separate requests, and an
 *    edit between them that keeps the count the same (an update, an insert
 *    plus a delete, or a change to an ordering column) may evade these checks.
 *    Only edits that change the count, or that repeat or drop a row in a way
 *    the count or duplicate check sees, fail the read.
 */

/** Rows asked for per request; equal to the configured database API cap. */
export const LIVE_READ_PAGE_SIZE = 1000;
/** Most rows one source may hold before it is reported unavailable rather than read. */
export const LIVE_READ_MAX_ROWS = 20_000;
/** Most requests one source may take, so a smaller server cap cannot cause an unbounded loop. */
export const LIVE_READ_MAX_PAGES = 50;
/** Ids per `in` filter, so a long project or estimate list stays a short request. */
export const LIVE_READ_ID_CHUNK = 100;

export type IncompleteReason = "error" | "too-large" | "incomplete";

export type CompleteRead<T> =
    | { ok: true; rows: T[] }
    | { ok: false; reason: IncompleteReason; detail: unknown };

/** What one page of a Supabase read resolves to when it was made with `count: "exact"`. */
export interface PageResult<T> {
    data: T[] | null;
    error: unknown;
    count?: number | null;
}

/**
 * Builds one page: a fresh query with the caller's filters, a total order that
 * ends in a unique column, `select(…, { count: "exact" })`, and `.range(from, to)`.
 */
export type PageQuery<T> = (from: number, to: number) => PromiseLike<PageResult<T>>;

export interface ReadOptions {
    pageSize?: number;
    maxRows?: number;
    maxPages?: number;
}

const incomplete = (detail: string): CompleteRead<never> => ({ ok: false, reason: "incomplete", detail });

export async function readComplete<T extends { id: string }>(page: PageQuery<T>, options: ReadOptions = {}): Promise<CompleteRead<T>> {
    const pageSize = options.pageSize ?? LIVE_READ_PAGE_SIZE;
    const maxRows = options.maxRows ?? LIVE_READ_MAX_ROWS;
    const maxPages = options.maxPages ?? LIVE_READ_MAX_PAGES;

    const rows: T[] = [];
    let expected: number | null = null;

    for (let pages = 0; expected === null || rows.length < expected; pages++) {
        if (pages >= maxPages) return { ok: false, reason: "too-large", detail: { pages, rows: rows.length, expected } };

        const result = await page(rows.length, rows.length + pageSize - 1);
        if (result.error) return { ok: false, reason: "error", detail: result.error };

        const count = result.count;
        if (typeof count !== "number" || !Number.isInteger(count) || count < 0) return incomplete("the read did not report an exact row count");
        if (expected === null) {
            if (count > maxRows) return { ok: false, reason: "too-large", detail: { count, maxRows } };
            expected = count;
        } else if (count !== expected) {
            return incomplete("the row count changed while reading");
        }

        const data = result.data ?? [];
        if (data.length === 0 && rows.length < expected) return incomplete("a page came back empty before every counted row was read");
        rows.push(...data);
    }

    if (rows.length !== expected) return incomplete("more rows were returned than were counted");
    if (new Set(rows.map((row) => row.id)).size !== rows.length) return incomplete("a row was returned twice across pages");
    return { ok: true, rows };
}

/**
 * `readComplete` over a list of ids, a chunk at a time, under one shared row
 * limit and one shared request budget: LIVE_READ_MAX_PAGES counts every
 * request made for this source, across all chunks, not per chunk. Each chunk's
 * page gets only its own ids; the chunks never overlap. No ids means nothing
 * to read, which is a genuine empty result.
 */
export async function readCompleteForIds<T extends { id: string }>(
    ids: readonly string[],
    page: (chunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
    options: ReadOptions & { chunkSize?: number } = {},
): Promise<CompleteRead<T>> {
    const unique = [...new Set(ids)];
    const chunkSize = options.chunkSize ?? LIVE_READ_ID_CHUNK;
    const maxRows = options.maxRows ?? LIVE_READ_MAX_ROWS;
    const maxPages = options.maxPages ?? LIVE_READ_MAX_PAGES;

    const rows: T[] = [];
    let requests = 0;
    for (let start = 0; start < unique.length; start += chunkSize) {
        const chunk = unique.slice(start, start + chunkSize);
        const read = await readComplete<T>(
            (from, to) => { requests += 1; return page(chunk, from, to); },
            { ...options, maxRows: maxRows - rows.length, maxPages: maxPages - requests },
        );
        if (!read.ok) return read;
        rows.push(...read.rows);
    }
    return { ok: true, rows };
}
