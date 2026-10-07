/**
 * In-memory stand-in for the two tables the import touches. It applies the
 * filters a query asks for and nothing else, so a query that forgets to name
 * the contractor would be caught reading or writing another one's rows.
 */

export type Row = Record<string, unknown>;
type Op = "select" | "insert" | "update";

export function fakeDb(seed: { profiles: Row[]; company_import_drafts?: Row[] }) {
    const tables: Record<string, Row[]> = {
        profiles: seed.profiles.map((row) => ({ ...row })),
        company_import_drafts: (seed.company_import_drafts ?? []).map((row) => ({ ...row })),
    };
    const writes: Array<{ table: string; op: Op; values: Row }> = [];
    const failures: Array<{ table: string; op: Op; times: number }> = [];
    let nextId = 1;
    let clock = Date.parse("2026-10-07T09:00:00.000Z");

    function from(table: string) {
        let op: Op = "select";
        let values: Row = {};
        let countOnly = false;
        let limit: number | null = null;
        let newestFirst = false;
        const tests: Array<(row: Row) => boolean> = [];

        const run = () => {
            const failure = failures.find((entry) => entry.table === table && entry.op === op && entry.times > 0);
            if (failure) {
                failure.times -= 1;
                return { data: null, count: null, error: { code: "08006", message: "connection lost" } };
            }
            if (op === "insert") {
                clock += 1000;
                const row = { id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`, created_at: new Date(clock).toISOString(), ...values };
                tables[table].push(row);
                writes.push({ table, op, values: { ...values } });
                return { data: [{ ...row }], count: null, error: null };
            }
            const hit = tables[table].filter((row) => tests.every((test) => test(row)));
            if (op === "update") {
                if (hit.length > 0) writes.push({ table, op, values: { ...values } });
                hit.forEach((row) => Object.assign(row, values));
                return { data: hit.map((row) => ({ ...row })), count: null, error: null };
            }
            let rows = hit.map((row) => ({ ...row }));
            if (newestFirst) rows = rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            if (limit !== null) rows = rows.slice(0, limit);
            return countOnly ? { data: null, count: rows.length, error: null } : { data: rows, count: null, error: null };
        };

        const one = (strict: boolean) => {
            const result = run();
            if (result.error) return { data: null, error: result.error };
            const rows = result.data ?? [];
            if (rows.length === 0 && strict) return { data: null, error: { code: "PGRST116", message: "no rows" } };
            return { data: rows[0] ?? null, error: null };
        };

        const builder = {
            select: (_columns?: string, options?: { head?: boolean }) => { if (options?.head) countOnly = true; return builder; },
            insert: (row: Row) => { op = "insert"; values = row; return builder; },
            update: (row: Row) => { op = "update"; values = row; return builder; },
            eq: (column: string, value: unknown) => { tests.push((row) => row[column] === value); return builder; },
            is: (column: string, value: null) => { tests.push((row) => (row[column] ?? null) === value); return builder; },
            gte: (column: string, value: string) => { tests.push((row) => String(row[column]) >= value); return builder; },
            order: () => { newestFirst = true; return builder; },
            limit: (count: number) => { limit = count; return builder; },
            single: async () => one(true),
            maybeSingle: async () => one(false),
            then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
        };
        return builder;
    }

    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client: { from } as any,
        tables,
        writes,
        profile: (id: string) => tables.profiles.find((row) => row.id === id)!,
        fail: (table: string, op: Op, times = 1) => failures.push({ table, op, times }),
    };
}
