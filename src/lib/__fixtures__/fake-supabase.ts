/**
 * A small in-memory stand-in for the Supabase client, for action tests:
 * enough of the query builder for these actions, an RPC hook, a log of
 * every operation, and failures that can be injected per table and
 * operation. No network and no database.
 */

export type Row = Record<string, unknown>;
type Op = "select" | "update" | "insert" | "delete" | "rpc";
interface Failure { target: string; op: Op; code: string; message?: string; times: number }

export function fakeSupabase(seed: Record<string, Row[]>) {
    const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
    const failures: Failure[] = [];
    const log: string[] = [];
    const updates: Array<{ table: string; values: Row; filters: Row }> = [];
    const rpcCalls: Array<{ name: string; args: Row }> = [];
    let rpcHandler: (name: string, args: Row) => { data: unknown; error: { code: string; message: string } | null } =
        () => ({ data: null, error: null });

    const takeFailure = (target: string, op: Op) => {
        const failure = failures.find((f) => f.target === target && f.op === op && f.times > 0);
        if (!failure) return null;
        failure.times -= 1;
        return { code: failure.code, message: failure.message ?? "injected failure" };
    };

    function from(table: string) {
        let op: Op = "select";
        let values: Row | null = null;
        let limit: number | null = null;
        let order: { column: string; ascending: boolean } | null = null;
        const filters: Row = {};

        const run = () => {
            log.push(`${op}:${table}`);
            const injected = takeFailure(table, op);
            if (injected) return { data: null, error: injected };
            const rows = tables[table] ?? [];
            const hit = rows.filter((row) => Object.entries(filters).every(([column, value]) => row[column] === value));
            if (op === "update") {
                updates.push({ table, values: { ...values! }, filters: { ...filters } });
                hit.forEach((row) => Object.assign(row, values));
                return { data: hit.map((row) => ({ ...row })), error: null };
            }
            let found = hit.map((row) => ({ ...row }));
            if (order) {
                const { column, ascending } = order;
                found = found.sort((a, b) => (Number(a[column]) - Number(b[column])) * (ascending ? 1 : -1));
            }
            if (limit !== null) found = found.slice(0, limit);
            return { data: found, error: null };
        };

        const one = (strict: boolean) => {
            const result = run();
            if (result.error) return result;
            const rows = (result.data as Row[] | null) ?? [];
            if (rows.length === 0 && strict) return { data: null, error: { code: "PGRST116", message: "no rows" } };
            return { data: rows[0] ?? null, error: null };
        };

        const builder = {
            select: () => builder,
            update: (row: Row) => { op = "update"; values = row; return builder; },
            eq: (column: string, value: unknown) => { filters[column] = value; return builder; },
            order: (column: string, options?: { ascending?: boolean }) => { order = { column, ascending: options?.ascending !== false }; return builder; },
            limit: (count: number) => { limit = count; return builder; },
            single: async () => one(true),
            maybeSingle: async () => one(false),
            then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(run()).then(resolve, reject),
        };
        return builder;
    }

    const rpc = async (name: string, args: Row) => {
        log.push(`rpc:${name}`);
        rpcCalls.push({ name, args });
        const injected = takeFailure(name, "rpc");
        if (injected) return { data: null, error: injected };
        return rpcHandler(name, args);
    };

    return {
        client: { from, rpc },
        tables,
        log,
        updates,
        rpcCalls,
        fail: (target: string, op: Op, code = "XX000", times = 1, message?: string) => failures.push({ target, op, code, times, message }),
        onRpc: (handler: typeof rpcHandler) => { rpcHandler = handler; },
    };
}
