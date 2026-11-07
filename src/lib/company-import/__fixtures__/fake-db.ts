/**
 * In-memory stand-in for the import's tables, with the same boundary the
 * migration draws:
 *
 *   - `user` is a contractor's own client. It can read rows that match the
 *     filters a query asks for, and every write through it is refused, as
 *     the grants refuse it in the database.
 *   - `admin` is the service role. It offers only the four server-only
 *     functions, with the rules the SQL functions have. Those rules are
 *     proved against a real database in `scripts/test-company-import-sql.sh`;
 *     here they let the service be exercised without one.
 */

export type Row = Record<string, unknown>;

const FIELDS = ["company_name", "website", "company_number", "vat_number", "specialisms", "phone", "sales_email", "address"];
const HOUR = 60 * 60 * 1000;
const comparable = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function fakeDb(seed: { profiles: Row[] }) {
    const tables: Record<string, Row[]> = {
        profiles: seed.profiles.map((row) => ({ ...row })),
        company_import_drafts: [],
        company_import_attempts: [],
    };
    const profileWrites: Array<{ userId: string; field: string; value: unknown }> = [];
    const deniedWrites: string[] = [];
    const rpcCalls: Array<{ name: string; args: Row }> = [];
    const failures: Array<{ target: string; times: number }> = [];
    let nextId = 1;
    let clock = Date.parse("2026-10-07T10:00:00.000Z");

    const id = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
    const iso = (ms = clock) => new Date(ms).toISOString();
    const takeFailure = (target: string) => {
        const failure = failures.find((entry) => entry.target === target && entry.times > 0);
        if (failure) failure.times -= 1;
        return failure ? { code: "08006", message: "connection lost" } : null;
    };

    // ── The contractor's client: reads only ──────────────────────────────────
    function from(table: string) {
        let write: string | null = null;
        let limit: number | null = null;
        let newestFirst = false;
        const tests: Array<(row: Row) => boolean> = [];

        const run = () => {
            if (write) {
                deniedWrites.push(`${write}:${table}`);
                return { data: null, error: { code: "42501", message: `permission denied for table ${table}` } };
            }
            const failure = takeFailure(`select:${table}`);
            if (failure) return { data: null, error: failure };
            let rows = (tables[table] ?? []).filter((row) => tests.every((test) => test(row))).map((row) => ({ ...row }));
            if (newestFirst) rows = rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
            if (limit !== null) rows = rows.slice(0, limit);
            return { data: rows, error: null };
        };
        const one = (strict: boolean) => {
            const result = run();
            if (result.error) return { data: null, error: result.error };
            const rows = result.data ?? [];
            if (rows.length === 0 && strict) return { data: null, error: { code: "PGRST116", message: "no rows" } };
            return { data: rows[0] ?? null, error: null };
        };
        const builder = {
            select: () => builder,
            insert: () => { write = "insert"; return builder; },
            update: () => { write = "update"; return builder; },
            delete: () => { write = "delete"; return builder; },
            eq: (column: string, value: unknown) => { tests.push((row) => row[column] === value); return builder; },
            is: (column: string, value: null) => { tests.push((row) => (row[column] ?? null) === value); return builder; },
            order: () => { newestFirst = true; return builder; },
            limit: (count: number) => { limit = count; return builder; },
            single: async () => one(true),
            maybeSingle: async () => one(false),
            then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
        };
        return builder;
    }

    // ── The service role: the four functions ─────────────────────────────────
    const functions: Record<string, (args: Row) => unknown> = {
        company_import_reserve_attempt: ({ p_user_id }) => {
            const mine = tables.company_import_attempts.filter((row) => row.user_id === p_user_id);
            for (const row of mine) {
                if (!row.finished_at && Date.parse(String(row.started_at)) < clock - 2 * 60 * 1000) Object.assign(row, { finished_at: iso(), outcome: "abandoned" });
            }
            if (mine.some((row) => !row.finished_at)) return { status: "in-flight" };
            if (mine.filter((row) => Date.parse(String(row.started_at)) > clock - HOUR).length >= 6) return { status: "rate-limited" };
            const attempt = { id: id(), user_id: p_user_id, started_at: iso(), finished_at: null, outcome: null };
            tables.company_import_attempts.push(attempt);
            return { status: "reserved", attempt_id: attempt.id };
        },
        company_import_finish_attempt: ({ p_user_id, p_attempt_id, p_outcome }) => {
            const attempt = tables.company_import_attempts.find((row) => row.id === p_attempt_id && row.user_id === p_user_id && !row.finished_at);
            if (attempt) Object.assign(attempt, { finished_at: iso(), outcome: String(p_outcome).slice(0, 60) });
            return null;
        },
        company_import_save_draft: (args) => {
            const attempt = tables.company_import_attempts.find((row) => row.id === args.p_attempt_id && row.user_id === args.p_user_id && !row.finished_at);
            if (!attempt) throw new Error("No reserved read exists for this draft.");
            Object.assign(attempt, { finished_at: iso(), outcome: "drafted" });
            clock += 1000;
            const draft = {
                id: id(),
                user_id: args.p_user_id,
                source_url: args.p_source_url,
                website: args.p_website,
                permission_confirmed_at: args.p_permission_confirmed_at,
                fetched_at: args.p_fetched_at,
                pages: structuredClone(args.p_pages),
                items: structuredClone(args.p_items),
                created_at: iso(),
                expires_at: iso(clock + 24 * HOUR),
            };
            tables.company_import_drafts.push(draft);
            return structuredClone(draft);
        },
        company_import_approve_item: ({ p_user_id, p_draft_id, p_field, p_expected_existing }) => {
            if (typeof p_field !== "string" || !FIELDS.includes(p_field)) return { outcome: "unavailable" };
            const draft = tables.company_import_drafts.find((row) => row.id === p_draft_id && row.user_id === p_user_id);
            if (!draft) return { outcome: "not-found" };
            if (Date.parse(String(draft.expires_at)) <= clock) return { outcome: "expired" };
            const item = (draft.items as Row[]).find((entry) => entry.field === p_field);
            if (!item || item.status === "applied" || !item.proposed) return { outcome: "unavailable" };
            const profile = tables.profiles.find((row) => row.id === p_user_id);
            if (profile && (profile[p_field] ?? null) === (p_expected_existing ?? null)) {
                // One transaction: if the approval cannot be recorded, the profile is not changed either.
                if (takeFailure("record-approval")) throw new Error("audit write failed");
                profile[p_field] = item.proposed;
                profileWrites.push({ userId: String(p_user_id), field: p_field, value: item.proposed });
                Object.assign(item, { status: "applied", existing: item.proposed, appliedAt: iso() });
                return { outcome: "applied" };
            }
            const current = profile ? profile[p_field] ?? null : null;
            Object.assign(item, { existing: current, status: comparable(current) === comparable(item.proposed) ? "same" : "pending" });
            return { outcome: "conflict", current };
        },
    };

    const rpc = async (name: string, args: Row) => {
        rpcCalls.push({ name, args: structuredClone(args) });
        const failure = takeFailure(name);
        if (failure) return { data: null, error: failure };
        try {
            return { data: functions[name](args), error: null };
        } catch (error) {
            return { data: null, error: { code: "P0001", message: error instanceof Error ? error.message : "error" } };
        }
    };

    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        user: { from } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        admin: { rpc } as any,
        tables,
        profileWrites,
        deniedWrites,
        rpcCalls,
        profile: (userId: string) => tables.profiles.find((row) => row.id === userId)!,
        /** Fails the next call to a function, the next read of a table (`select:<table>`), or the next approval record (`record-approval`). */
        fail: (target: string, times = 1) => failures.push({ target, times }),
        advance: (ms: number) => { clock += ms; },
        now: () => clock,
    };
}
