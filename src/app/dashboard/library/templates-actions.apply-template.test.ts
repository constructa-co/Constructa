import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
}));
vi.mock("@/lib/supabase/extended-module-auth-utils", () => ({
    requireAuth: mocks.requireAuth,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { applyTemplateAction } from "./templates-actions";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const NEW_ESTIMATE_ID = "33333333-3333-4333-8333-333333333333";

type Row = Record<string, unknown>;

function fakeDb(seed: Partial<Record<string, Row[]>> = {}) {
    const tables: Record<string, Row[]> = {
        profiles: [{ id: USER_ID, markup_method: "compound" }],
        template_items: [
            {
                id: "item-1",
                template_id: TEMPLATE_ID,
                category: "General",
                description: "Scaffold allowance",
                unit: "wk",
                unit_cost: 450,
                quantity: 2,
            },
        ],
        estimates: [],
        estimate_lines: [],
        ...seed,
    };

    function from(table: string) {
        let op: "insert" | "select" = "select";
        let payload: Row | null = null;
        const filters: [string, unknown][] = [];

        const run = () => {
            const rows = tables[table];
            const matches = (row: Row) => filters.every(([column, value]) => row[column] === value);

            if (op === "insert") {
                const row = { id: table === "estimates" ? NEW_ESTIMATE_ID : `line-${rows.length + 1}`, ...payload! };
                rows.push(row);
                return { data: table === "estimates" ? [row] : null, error: null };
            }

            return { data: rows.filter(matches), error: null };
        };

        const one = (strict: boolean) => {
            const result = run();
            const rows = (result.data as Row[] | null) ?? [];
            if (rows.length === 0 && strict) return { data: null, error: { code: "PGRST116", message: "no rows" } };
            return { data: rows[0] ?? null, error: null };
        };

        const builder = {
            select: () => builder,
            insert: (row: Row | Row[]) => {
                op = "insert";
                payload = Array.isArray(row) ? null : row;
                if (Array.isArray(row)) {
                    row.forEach((r) => tables[table].push({ id: `${table}-${tables[table].length + 1}`, ...r }));
                    return Promise.resolve({ data: null, error: null });
                }
                return builder;
            },
            eq: (column: string, value: unknown) => {
                filters.push([column, value]);
                return builder;
            },
            order: () => builder,
            limit: () => builder,
            single: async () => one(true),
            maybeSingle: async () => one(false),
            then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(run()).then(resolve, reject),
        };
        return builder;
    }

    return { tables, supabase: { from } };
}

beforeEach(() => {
    mocks.requireAuth.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("applyTemplateAction — estimate bootstrap", () => {
    it("stores the company markup method when it creates the project's first estimate", async () => {
        const db = fakeDb();
        mocks.requireAuth.mockResolvedValue({ user: { id: USER_ID }, supabase: db.supabase });

        const result = await applyTemplateAction(TEMPLATE_ID, PROJECT_ID);

        expect(result).toEqual({ success: true, count: 1 });
        expect(db.tables.estimates).toEqual([
            {
                id: NEW_ESTIMATE_ID,
                project_id: PROJECT_ID,
                version_name: "Original Estimate",
                markup_method: "compound",
                total_cost: 0,
            },
        ]);
        expect(db.tables.estimate_lines).toHaveLength(1);
    });

    it("reuses an existing estimate and does not create another", async () => {
        const existingId = "est-existing";
        const db = fakeDb({
            estimates: [{ id: existingId, project_id: PROJECT_ID, created_at: "2026-01-01" }],
        });
        mocks.requireAuth.mockResolvedValue({ user: { id: USER_ID }, supabase: db.supabase });

        await applyTemplateAction(TEMPLATE_ID, PROJECT_ID);

        expect(db.tables.estimates).toHaveLength(1);
        expect(db.tables.estimates[0].id).toBe(existingId);
        expect(db.tables.estimates[0]).not.toHaveProperty("markup_method");
    });
});