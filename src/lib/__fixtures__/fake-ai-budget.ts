/**
 * In-memory stand-in for the AI budget's two database functions, with the
 * rules the SQL has. Those rules are proved against a real database in
 * `scripts/test-ai-budget-sql.sh`; this lets the wrapper and its callers be
 * exercised without one. It is the service-role side only: there is nothing
 * here a browser client could reach, as in the database.
 */

export type Row = Record<string, unknown>;

const OUTCOMES = ["ok", "rejected:schema", "rejected:tripwire", "sources-moved", "error"];
const HOUR = 60 * 60 * 1000;

export function fakeAiBudget(options: { introductionEnabled?: boolean } = {}) {
    const features: Record<string, { enabled: boolean; max: number }> = {
        "profile.rewrite": { enabled: true, max: 700 },
        "company.introduction": { enabled: options.introductionEnabled ?? false, max: 500 },
    };
    const limits = {
        contractor: { perHour: 6 as number | null, perDay: 20, perDayTokens: 12_000 },
        global: { perDay: 2000, perDayTokens: 1_000_000 },
    };
    const attempts: Row[] = [];
    const rpcCalls: Array<{ name: string; args: Row }> = [];
    const failures: Array<{ name: string; times: number }> = [];
    let nextId = 1;
    let clock = Date.parse("2026-10-09T09:00:00.000Z");

    const charged = (row: Row) => Number(row.completion_tokens ?? row.reserved_output_tokens);
    const since = (rows: Row[], ms: number) => rows.filter((row) => Number(row.started_at) > clock - ms);

    const functions: Record<string, (args: Row) => unknown> = {
        ai_generation_reserve: ({ p_user_id, p_feature, p_reserve_output_tokens, p_source_fingerprint }) => {
            if (!p_user_id) throw new Error("A contractor is required.");
            const feature = features[String(p_feature)];
            if (!feature || !feature.enabled) return { status: "disabled" };
            const reserve = Number(p_reserve_output_tokens);
            if (!Number.isInteger(reserve) || reserve < 1 || reserve > feature.max) throw new Error("reservation out of bounds");
            if (p_feature === "company.introduction" ? !/^[0-9a-f]{32}$/.test(String(p_source_fingerprint)) : p_source_fingerprint != null) throw new Error("fingerprint rule");

            const mine = attempts.filter((row) => row.user_id === p_user_id);
            for (const row of mine) {
                if (row.finished_at == null && Number(row.started_at) < clock - 2 * 60 * 1000) Object.assign(row, { finished_at: clock, outcome: "abandoned" });
            }
            if (mine.some((row) => row.finished_at == null)) return { status: "in-flight" };
            const day = since(mine, 24 * HOUR);
            if ((limits.contractor.perHour !== null && since(mine, HOUR).length >= limits.contractor.perHour) || day.length >= limits.contractor.perDay) return { status: "attempt-limit" };
            if (day.reduce((sum, row) => sum + charged(row), 0) + reserve > limits.contractor.perDayTokens) return { status: "token-limit" };
            const everyone = since(attempts, 24 * HOUR);
            if (everyone.length >= limits.global.perDay || everyone.reduce((sum, row) => sum + charged(row), 0) + reserve > limits.global.perDayTokens) return { status: "service-limit" };

            const attempt: Row = {
                id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`, user_id: p_user_id, feature: p_feature, started_at: clock,
                finished_at: null, outcome: null, reserved_output_tokens: reserve, prompt_tokens: null, completion_tokens: null, model: null, prompt_version: null,
                source_fingerprint: p_source_fingerprint ?? null,
            };
            attempts.push(attempt);
            return { status: "reserved", attempt_id: attempt.id };
        },
        ai_generation_finish: ({ p_user_id, p_attempt_id, p_outcome, p_prompt_tokens, p_completion_tokens, p_model, p_prompt_version }) => {
            if (!OUTCOMES.includes(String(p_outcome))) throw new Error("Unknown AI attempt outcome.");
            if (p_outcome === "ok" && p_completion_tokens == null) throw new Error("A successful AI attempt must record its usage.");
            const attempt = attempts.find((row) => row.id === p_attempt_id && row.user_id === p_user_id && row.finished_at == null);
            if (!attempt) return false;
            Object.assign(attempt, { finished_at: clock, outcome: p_outcome, prompt_tokens: p_prompt_tokens ?? null, completion_tokens: p_completion_tokens ?? null, model: p_model ?? null, prompt_version: p_prompt_version ?? null });
            return true;
        },
    };

    const rpc = async (name: string, args: Row) => {
        rpcCalls.push({ name, args: structuredClone(args) });
        const failure = failures.find((entry) => entry.name === name && entry.times > 0);
        if (failure) {
            failure.times -= 1;
            return { data: null, error: { code: "08006", message: "connection lost" } };
        }
        try {
            return { data: functions[name](args), error: null };
        } catch (error) {
            return { data: null, error: { code: "P0001", message: error instanceof Error ? error.message : "error" } };
        }
    };

    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        admin: { rpc } as any,
        attempts,
        rpcCalls,
        features,
        limits,
        calls: (name: string) => rpcCalls.filter((call) => call.name === name),
        /** What each attempt is charged against the allowance. */
        charged: () => attempts.map(charged),
        fail: (name: string, times = 1) => failures.push({ name, times }),
        advance: (ms: number) => { clock += ms; },
    };
}
