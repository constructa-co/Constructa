/**
 * In-memory stand-in for the interview's tables, with the boundary the
 * migration draws: `user` can only read rows matching the filters a query
 * asks for (every write through it is refused), and `admin` offers only the
 * three server-only functions, with the rules the SQL functions have. Those
 * rules are proved against a real database in
 * `scripts/test-company-interview-sql.sh`; here they let the service and the
 * screen be exercised without one.
 *
 * `company_import_drafts` exists here too, holding a pending website
 * suggestion, so tests can prove the interview never reads it.
 */

import { createHash } from "node:crypto";

export type Row = Record<string, unknown>;

const TARGETS = ["introduction", "years_trading", "accreditations", "insurance_details"];

export function fakeInterviewDb(seed: {
    profiles: Row[];
    pendingImport?: Row[];
    /** The AI budget's ledger, when a test has one, so an 'ai' draft can be checked against a real attempt. */
    aiAttempts?: Row[];
}) {
    const aiAttempts = seed.aiAttempts ?? [];
    const tables: Record<string, Row[]> = {
        profiles: seed.profiles.map((row) => ({ ...row })),
        company_interview_answers: [],
        company_narrative_drafts: [],
        company_import_drafts: (seed.pendingImport ?? []).map((row) => ({ ...row })),
    };
    const reads: string[] = [];
    const deniedWrites: string[] = [];
    const profileWrites: Array<{ userId: string; field: string; value: unknown }> = [];
    const rpcCalls: Array<{ name: string; args: Row }> = [];
    const failures: Array<{ target: string; times: number }> = [];
    let nextId = 1;
    let clock = Date.parse("2026-10-08T09:00:00.000Z");

    const id = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
    const iso = () => new Date(clock).toISOString();
    const takeFailure = (target: string) => {
        const failure = failures.find((entry) => entry.target === target && entry.times > 0);
        if (failure) failure.times -= 1;
        return failure ? { code: "08006", message: "connection lost" } : null;
    };
    // As the SQL: the revision of every answer, and the saved business name.
    const fingerprint = (userId: unknown) => createHash("md5").update(
        `${tables.company_interview_answers
            .filter((row) => row.user_id === userId)
            .sort((a, b) => (String(a.question_key) < String(b.question_key) ? -1 : 1))
            .map((row) => `${row.question_key}:${row.revision}:${row.skipped}`)
            .join("|")}#${tables.profiles.find((row) => row.id === userId)?.company_name ?? ""}`,
    ).digest("hex");

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
            reads.push(table);
            const failure = takeFailure(`select:${table}`);
            if (failure) return { data: null, error: failure };
            let rows = (tables[table] ?? []).filter((row) => tests.every((test) => test(row))).map((row) => structuredClone(row));
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
            in: (column: string, values: unknown[]) => { tests.push((row) => values.includes(row[column])); return builder; },
            order: () => { newestFirst = true; return builder; },
            limit: (count: number) => { limit = count; return builder; },
            single: async () => one(true),
            maybeSingle: async () => one(false),
            then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
        };
        return builder;
    }

    const functions: Record<string, (args: Row) => unknown> = {
        company_interview_save_answer: ({ p_user_id, p_question_key, p_answer, p_skipped, p_expected_revision, p_question_set_version }) => {
            if (String(p_answer ?? "").length > 600) throw new Error("answer too long");
            const row = tables.company_interview_answers.find((entry) => entry.user_id === p_user_id && entry.question_key === p_question_key);
            if (!row) {
                if ((p_expected_revision ?? 0) !== 0) return { outcome: "conflict", revision: 0, answer: "", skipped: false };
                tables.company_interview_answers.push({ user_id: p_user_id, question_key: p_question_key, answer: p_answer ?? "", skipped: !!p_skipped, revision: 1, question_set_version: p_question_set_version });
                return { outcome: "saved", revision: 1 };
            }
            if (row.revision !== p_expected_revision) return { outcome: "conflict", revision: row.revision, answer: row.answer, skipped: row.skipped };
            Object.assign(row, { answer: p_answer ?? "", skipped: !!p_skipped, revision: Number(row.revision) + 1 });
            return { outcome: "saved", revision: row.revision };
        },
        company_narrative_save_draft: (args) => {
            if (String(args.p_draft_text).length > 2000) throw new Error("draft too long");
            if (typeof args.p_expected_fingerprint !== "string" || !/^[0-9a-f]{32}$/.test(args.p_expected_fingerprint)) throw new Error("sources must be stated");
            // Compared before anything is retired or inserted. A stale save leaves no trace.
            if (fingerprint(args.p_user_id) !== args.p_expected_fingerprint) return { outcome: "stale-source" };
            // Who wrote it, and the proof. As the SQL: checked after the sources, before anything is retired.
            if (args.p_generator === "template") {
                if (args.p_ai_attempt_id != null || args.p_model != null) return { outcome: "invalid-attempt" };
            } else if (args.p_generator === "ai") {
                const attempt = aiAttempts.find((row) => row.id === args.p_ai_attempt_id && row.user_id === args.p_user_id);
                if (!attempt || args.p_model == null || args.p_generator_version == null
                    || attempt.feature !== "company.introduction" || attempt.outcome !== "ok"
                    || attempt.source_fingerprint !== args.p_expected_fingerprint
                    || attempt.model !== args.p_model || attempt.prompt_version !== args.p_generator_version
                    || tables.company_narrative_drafts.some((row) => row.ai_attempt_id === args.p_ai_attempt_id)) {
                    return { outcome: "invalid-attempt" };
                }
            } else {
                return { outcome: "invalid-attempt" };
            }
            for (const row of tables.company_narrative_drafts) {
                if (row.user_id === args.p_user_id && row.section === args.p_section && row.status === "draft") row.status = "superseded";
            }
            clock += 1000;
            const draft = {
                id: id(), user_id: args.p_user_id, section: args.p_section, draft_text: args.p_draft_text,
                generator: args.p_generator, generator_version: args.p_generator_version, model: args.p_model,
                question_set_version: args.p_question_set_version, based_on: structuredClone(args.p_based_on), facts: structuredClone(args.p_facts),
                answers_fingerprint: args.p_expected_fingerprint, profile_baseline: args.p_profile_baseline,
                ai_attempt_id: args.p_ai_attempt_id ?? null,
                status: "draft", approved_text: null, approved_edited: null, approved_at: null, created_at: iso(),
            };
            tables.company_narrative_drafts.push(draft);
            return { outcome: "saved", draft: structuredClone(draft) };
        },
        company_narrative_approve: ({ p_user_id, p_draft_id, p_target, p_text, p_expected_existing }) => {
            if (typeof p_target !== "string" || !TARGETS.includes(p_target)) return { outcome: "unavailable" };
            const draft = tables.company_narrative_drafts.find((row) => row.id === p_draft_id && row.user_id === p_user_id);
            if (!draft) return { outcome: "not-found" };
            if (draft.status === "superseded" || draft.answers_fingerprint !== fingerprint(p_user_id)) return { outcome: "stale-answers" };
            const profile = tables.profiles.find((row) => row.id === p_user_id);
            const expected = p_expected_existing ?? null;
            // One transaction: if the record cannot be written, the profile is not changed either.
            const commit = (field: string, value: unknown) => {
                if (takeFailure("record-approval")) throw new Error("record write failed");
                profile![field] = value;
                profileWrites.push({ userId: String(p_user_id), field, value });
            };

            if (p_target === "introduction") {
                if (draft.status !== "draft") return { outcome: "unavailable" };
                const text = String(p_text ?? draft.draft_text).trim();
                if (!text || text.length > 2000 || /[<>]/.test(text)) return { outcome: "invalid-text" };
                if (!profile || (profile.capability_statement ?? null) !== expected) {
                    draft.profile_baseline = profile?.capability_statement ?? null;
                    return { outcome: "conflict", current: profile?.capability_statement ?? null };
                }
                const edited = text !== String(draft.draft_text).trim();
                commit("capability_statement", text);
                Object.assign(draft, { status: "approved", approved_text: text, approved_edited: edited, approved_at: iso(), profile_baseline: text });
                return { outcome: "applied", edited };
            }

            const fact = (draft.facts as Row[]).find((entry) => entry.field === p_target);
            if (!fact || fact.status === "applied" || !String(fact.proposed ?? "").trim()) return { outcome: "unavailable" };
            const current = profile?.[p_target] == null ? null : String(profile[p_target]);
            if (!profile || current !== expected) {
                fact.existing = current;
                return { outcome: "conflict", current };
            }
            commit(p_target, p_target === "years_trading" ? Number(fact.proposed) : fact.proposed);
            Object.assign(fact, { status: "applied", existing: fact.proposed, appliedAt: iso() });
            return { outcome: "applied" };
        },
    };

    // Something that happens "somewhere else" in the gap between the service
    // reading its sources and its next call to a function: another tab, the
    // Profile form. Each barrier runs once.
    const barriers: Array<{ name: string; run: () => void | Promise<void> }> = [];

    const rpc = async (name: string, args: Row) => {
        const barrier = barriers.findIndex((entry) => entry.name === name);
        if (barrier >= 0) await barriers.splice(barrier, 1)[0].run();
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
        reads,
        deniedWrites,
        profileWrites,
        rpcCalls,
        profile: (userId: string) => tables.profiles.find((row) => row.id === userId)!,
        /** Fails the next call to a function, the next read of a table (`select:<table>`), or the next approval record (`record-approval`). */
        fail: (target: string, times = 1) => failures.push({ target, times }),
        now: () => clock,
        /** Runs `run` once, immediately before the next call to the named function reaches the database. */
        beforeNext: (name: string, run: () => void | Promise<void>) => { barriers.push({ name, run }); },
    };
}
