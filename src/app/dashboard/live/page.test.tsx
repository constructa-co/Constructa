import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("server-only", () => ({}));

interface Call { table: string; filters: ["eq" | "in", string, unknown][]; orders: string[]; count?: string; range?: [number, number] }

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    results: {} as Record<string, { data: unknown; error: unknown }>,
    /** Most rows the fake API returns per request, like `max_rows` in supabase/config.toml. */
    cap: 1000,
    /** Per table: a ranged request starting at or after this offset fails. */
    failFrom: {} as Record<string, number>,
    calls: [] as Call[],
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({
    redirect: (path: string) => { throw Error(`NEXT_REDIRECT:${path}`); },
    useRouter: () => ({ refresh: () => undefined }),
}));
vi.mock("../projects/p-and-l/actions", () => ({ logCostAction: vi.fn(), updateInvoiceStatusAction: vi.fn() }));

import LiveProjectsPage from "./page";
import { liveFigures, totalOrUnavailable, type LiveFigures, type LiveUnavailable } from "./live-data";

const dbError = { code: "57014", message: "canceling statement due to statement timeout" };
const ok = (data: unknown) => ({ data, error: null });
const fail = (error: unknown = dbError) => ({ data: null, error });

// An estimate whose contract sum and budget are both £10,000 of direct cost plus margins.
const estimate = {
    id: "est-1", project_id: "job-1", is_active: true, total_cost: 0, created_at: "2026-11-01T00:00:00Z",
    overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0,
};
const estimateLine = { id: "line-1", estimate_id: "est-1", trade_section: "Groundworks", line_total: 10000, line_type: "measured" };
const project = { id: "job-1", user_id: "user-1", name: "Kitchen extension", client_name: "A Client", potential_value: 50000, created_at: "2026-11-01T00:00:00Z" };

/** Synthetic rows with unique ids: `n` copies of `row`, each with its own id. */
const many = <R extends object>(n: number, prefix: string, row: (i: number) => R) =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${String(i).padStart(5, "0")}`, ...row(i) }));

/**
 * A fake Supabase client. List results are filtered by the query's `eq`/`in`
 * filters, sliced by `range`, capped at `mocks.cap` rows per request, and
 * carry an exact count when one is asked for: the behaviour the live page must
 * not mistake for a complete read. `single()` returns the result as given.
 */
function supabase() {
    return {
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        from: (table: string) => {
            const call: Call = { table, filters: [], orders: [] };
            mocks.calls.push(call);
            const query: Record<string, unknown> = {};
            query.select = (_columns: string, options?: { count?: string }) => { call.count = options?.count; return query; };
            query.eq = (column: string, value: unknown) => { call.filters.push(["eq", column, value]); return query; };
            query.in = (column: string, values: unknown[]) => { call.filters.push(["in", column, values]); return query; };
            query.order = (column: string) => { call.orders.push(column); return query; };
            query.range = (from: number, to: number) => { call.range = [from, to]; return query; };
            const list = () => {
                const result = mocks.results[table] ?? ok([]);
                if (result.error) return { data: null, error: result.error, count: null };
                const rows = (result.data as Record<string, unknown>[]).filter((row) => call.filters.every(([op, column, value]) =>
                    op === "eq" ? row[column] === value : (value as unknown[]).includes(row[column])));
                const count = call.count === "exact" ? rows.length : null;
                if (!call.range) return { data: rows.slice(0, mocks.cap), error: null, count };
                const [from, to] = call.range;
                if (mocks.failFrom[table] !== undefined && from >= mocks.failFrom[table]) return { data: null, error: dbError, count: null };
                return { data: rows.slice(from, Math.min(to + 1, from + mocks.cap)), error: null, count };
            };
            query.single = () => Promise.resolve(mocks.results[table] ?? ok(null));
            query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve().then(list).then(resolve, reject);
            return query;
        },
    };
}

async function render(projectId?: string) {
    const page = (await LiveProjectsPage({ searchParams: Promise.resolve({ projectId }) })) as ReactElement;
    return { page, html: renderToStaticMarkup(page) };
}

/** The client component's props: the page wraps it in one layout div (portfolio adds a heading first). */
interface ClientProps {
    figures: LiveFigures;
    costs: unknown[];
    unavailable: LiveUnavailable;
    projects: LiveFigures[];
    totalCosts: number | null;
    totalInvoiced: number | null;
    totalOutstanding: number | null;
}

function clientProps(page: ReactElement): ClientProps {
    const children = (page.props as { children: unknown }).children;
    const list = Array.isArray(children) ? children : [children];
    return (list.at(-1) as ReactElement).props as ClientProps;
}

beforeEach(() => {
    mocks.results = {};
    mocks.cap = 1000;
    mocks.failFrom = {};
    mocks.calls = [];
    mocks.createClient.mockResolvedValue(supabase());
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("live figures keep unknown apart from zero", () => {
    it("returns null, not 0, for every figure that depends on a source that could not be loaded", () => {
        const figures = liveFigures({ contractValue: 1000, budgetCost: 800, expenses: null, invoices: null, variations: null });
        expect(figures).toMatchObject({
            costsPosted: null, budgetBurnPct: null, invoicedTotal: null, receivedTotal: null, outstanding: null,
            approvedVariations: null, revisedValue: null, completionPct: null, hasActivity: null,
            contractValue: 1000, budgetCost: 800,
        });
    });

    it("returns real zeros for sources that loaded and were empty", () => {
        const figures = liveFigures({ contractValue: 1000, budgetCost: 800, expenses: [], invoices: [], variations: [] });
        expect(figures).toMatchObject({ costsPosted: 0, budgetBurnPct: 0, invoicedTotal: 0, outstanding: 0, approvedVariations: 0, revisedValue: 1000, completionPct: 0, hasActivity: false });
    });

    it("keeps known activity when another source is missing, and marks completion unknown without variations", () => {
        const figures = liveFigures({ contractValue: 1000, budgetCost: 800, expenses: [{ amount: 400 }], invoices: [{ amount: 300, status: "Paid" }], variations: null });
        expect(figures).toMatchObject({ costsPosted: 400, budgetBurnPct: 50, invoicedTotal: 300, receivedTotal: 300, outstanding: 0, completionPct: null, hasActivity: true });
    });

    it("totals are unavailable when any part is unknown", () => {
        expect(totalOrUnavailable([100, null, 50])).toBeNull();
        expect(totalOrUnavailable([100, 0, 50])).toBe(150);
        expect(totalOrUnavailable([])).toBe(0);
    });
});

describe("per-project live view", () => {
    beforeEach(() => {
        mocks.results = {
            projects: ok(project),
            estimates: ok([estimate]),
            estimate_lines: ok([estimateLine]),
            project_expenses: ok([{ id: "c1", project_id: "job-1", description: "Skip hire", amount: 12000, cost_type: "plant", expense_date: "2026-11-10" }]),
            invoices: ok([{ id: "i1", project_id: "job-1", invoice_number: "INV-1", type: "Interim", amount: 4000, status: "Sent", created_at: "2026-11-12T00:00:00Z" }]),
            variations: ok([]),
        };
    });

    it("throws to the error boundary when the project read fails, rather than redirecting or showing zeros", async () => {
        mocks.results.projects = fail();
        await expect(render("job-1")).rejects.toThrow("Live Projects could not load this project.");
    });

    it("still redirects when the project simply does not exist for this user", async () => {
        mocks.results.projects = fail({ code: "PGRST116", message: "no rows" });
        await expect(render("job-1")).rejects.toThrow("NEXT_REDIRECT:/dashboard/live");
    });

    it("throws when the estimates cannot be read, instead of a £0 contract value", async () => {
        mocks.results.estimates = fail();
        await expect(render("job-1")).rejects.toThrow("Live Projects could not load this project's estimates.");
    });

    it("shows cost entries as unavailable, never £0 or 'No costs posted yet', when that read fails", async () => {
        mocks.results.project_expenses = fail();
        const { page, html } = await render("job-1");
        const props = clientProps(page);
        expect(props.unavailable).toEqual({ costs: true, invoices: false, variations: false });
        expect(props.figures.costsPosted).toBeNull();
        expect(props.figures.budgetBurnPct).toBeNull();
        expect(props.figures.invoicedTotal).toBe(4000);
        expect(html).toContain("Some figures could not be loaded: cost entries.");
        expect(html).toContain("Cost entries could not be loaded. Refresh to try again.");
        expect(html).toContain("Status unavailable");
        expect(html).not.toContain("No costs posted yet");
        expect(html).not.toContain("Not Started");
        expect(html).not.toMatch(/Costs to Date<\/span>[\s\S]*?<div[^>]*>£0</);
    });

    it("shows invoice figures and completion as unavailable when invoices fail, keeping known costs", async () => {
        mocks.results.invoices = fail();
        const { page, html } = await render("job-1");
        const props = clientProps(page);
        expect(props.figures).toMatchObject({ invoicedTotal: null, receivedTotal: null, outstanding: null, completionPct: null, costsPosted: 12000 });
        expect(html).toContain("Invoices could not be loaded. Refresh to try again.");
        expect(html).not.toContain("No invoices yet");
        // Costs are known and over budget, so that warning still stands.
        expect(html).toContain("Over Budget");
    });

    it("shows a loaded but empty project as real zeros, with no warning", async () => {
        mocks.results.project_expenses = ok([]);
        mocks.results.invoices = ok([]);
        const { page, html } = await render("job-1");
        expect(clientProps(page).unavailable).toEqual({ costs: false, invoices: false, variations: false });
        expect(html).not.toContain("could not be loaded");
        expect(html).toContain("No costs posted yet");
        expect(html).toContain("Not Started");
    });
});

describe("portfolio live view", () => {
    beforeEach(() => {
        mocks.results = {
            projects: ok([project]),
            estimates: ok([estimate]),
            estimate_lines: ok([estimateLine]),
            project_expenses: ok([{ id: "c1", project_id: "job-1", amount: 12000 }]),
            invoices: ok([{ id: "i1", project_id: "job-1", amount: 4000, status: "Sent" }]),
            variations: ok([]),
        };
    });

    it("throws when the project list cannot be read, instead of saying there are no projects", async () => {
        mocks.results.projects = fail();
        await expect(render()).rejects.toThrow("Live Projects could not load your projects.");
    });

    it("throws when estimates cannot be read, instead of guessing contract values", async () => {
        mocks.results.estimates = fail();
        await expect(render()).rejects.toThrow("Live Projects could not load your estimates.");
    });

    it("reports failed invoices and variations as unavailable totals, never £0", async () => {
        mocks.results.invoices = fail();
        mocks.results.variations = fail();
        const { page, html } = await render();
        const props = clientProps(page);
        expect(props.unavailable).toEqual({ costs: false, invoices: true, variations: true });
        expect(props.totalCosts).toBe(12000);
        expect(props.totalInvoiced).toBeNull();
        expect(props.totalOutstanding).toBeNull();
        expect(props.projects[0]).toMatchObject({ invoicedTotal: null, approvedVariations: null, revisedValue: null, completionPct: null });
        expect(html).toContain("Some figures could not be loaded: invoices, variations.");
        expect(html).toContain("Invoices could not be loaded");
        expect(html).not.toMatch(/Invoiced<\/span>[\s\S]*?<div[^>]*>£0</);
    });

    it("marks status unavailable, not 'Not Started', when costs are unknown", async () => {
        mocks.results.project_expenses = fail();
        mocks.results.invoices = ok([]);
        const { page, html } = await render();
        expect(clientProps(page).totalCosts).toBeNull();
        expect(clientProps(page).projects[0].hasActivity).toBeNull();
        expect(html).toContain("Status unavailable");
        expect(html).not.toContain("Not Started");
    });

    it("shows a healthy portfolio with no warning when every read succeeds", async () => {
        const { page, html } = await render();
        const props = clientProps(page);
        expect(props).toMatchObject({ totalCosts: 12000, totalInvoiced: 4000, totalOutstanding: 4000 });
        expect(html).not.toContain("could not be loaded");
        expect(html).not.toContain("Unavailable");
    });
});

describe("reads past the 1,000-row cap are complete or unavailable, never silently short (D130)", () => {
    describe("per-project view", () => {
        beforeEach(() => {
            mocks.results = {
                projects: ok(project),
                estimates: ok([estimate]),
                estimate_lines: ok([estimateLine]),
                project_expenses: ok([]),
                invoices: ok([]),
                variations: ok([]),
            };
        });

        it("totals all 1,500 cost entries, not the first 1,000", async () => {
            mocks.results.project_expenses = ok(many(1500, "c", () => ({ project_id: "job-1", amount: 10, expense_date: "2026-11-10" })));
            const { page } = await render("job-1");
            const props = clientProps(page);
            expect(props.figures.costsPosted).toBe(15000);
            expect(props.costs).toHaveLength(1500);
            expect(props.unavailable.costs).toBe(false);
            const expenseReads = mocks.calls.filter((call) => call.table === "project_expenses");
            expect(expenseReads.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]]);
            // Every page is counted, kept to this project, and in a total order ending in the unique id.
            for (const call of expenseReads) {
                expect(call.count).toBe("exact");
                expect(call.filters).toEqual([["eq", "project_id", "job-1"]]);
                expect(call.orders).toEqual(["expense_date", "id"]);
            }
        });

        it("shows cost entries as unavailable, not a partial £10,000, when a later page fails", async () => {
            mocks.results.project_expenses = ok(many(1500, "c", () => ({ project_id: "job-1", amount: 10, expense_date: "2026-11-10" })));
            mocks.failFrom.project_expenses = 1000;
            const { page, html } = await render("job-1");
            const props = clientProps(page);
            expect(props.unavailable).toEqual({ costs: true, invoices: false, variations: false });
            expect(props.figures.costsPosted).toBeNull();
            expect(props.costs).toEqual([]);
            expect(html).toContain("Cost entries could not be loaded. Refresh to try again.");
        });

        it("prices the contract from all 1,200 estimate lines, read apart from the estimate", async () => {
            mocks.results.estimate_lines = ok(many(1200, "line", () => ({ estimate_id: "est-1", trade_section: "Groundworks", line_total: 10, line_type: "measured" })));
            const { page } = await render("job-1");
            expect(clientProps(page).figures).toMatchObject({ contractValue: 12000, budgetCost: 12000 });
            const lineReads = mocks.calls.filter((call) => call.table === "estimate_lines");
            expect(lineReads).toHaveLength(2);
            expect(lineReads.every((call) => call.filters[0][2] === "est-1" && call.orders.at(-1) === "id")).toBe(true);
        });

        it("throws rather than pricing from part of the estimate when a later page of lines fails", async () => {
            mocks.results.estimate_lines = ok(many(1200, "line", () => ({ estimate_id: "est-1", trade_section: "Groundworks", line_total: 10, line_type: "measured" })));
            mocks.failFrom.estimate_lines = 1000;
            await expect(render("job-1")).rejects.toThrow("Live Projects could not load this project's estimate lines.");
        });

        it("reads only the active estimate's lines, and still uses the first estimate made when none is active", async () => {
            mocks.results.estimates = ok([
                { ...estimate, id: "est-old", is_active: false, created_at: "2026-10-01T00:00:00Z" },
                { ...estimate, id: "est-new", is_active: false, created_at: "2026-11-01T00:00:00Z" },
            ]);
            mocks.results.estimate_lines = ok([
                { ...estimateLine, id: "line-old", estimate_id: "est-old", line_total: 3000 },
                { ...estimateLine, id: "line-new", estimate_id: "est-new", line_total: 9000 },
            ]);
            const { page } = await render("job-1");
            expect(clientProps(page).figures.contractValue).toBe(3000);
            expect(mocks.calls.find((call) => call.table === "estimates")?.orders).toEqual(["created_at", "id"]);
        });
    });

    describe("portfolio view", () => {
        const projects = many(1001, "job", (i) => ({ user_id: "user-1", name: `Job ${i}`, potential_value: 1000, created_at: "2026-11-01T00:00:00Z" }));

        beforeEach(() => {
            mocks.results = {
                // One other account's project, which must never be counted.
                projects: ok([...projects, { id: "other-job", user_id: "user-2", name: "Not yours", potential_value: 999999, created_at: "2026-11-01T00:00:00Z" }]),
                estimates: ok([]),
                estimate_lines: ok([]),
                project_expenses: ok(projects.flatMap((p) => many(2, `${p.id}-c`, () => ({ project_id: p.id, amount: 5 })))),
                invoices: ok(projects.map((p) => ({ id: `${p.id}-i`, project_id: p.id, amount: 100, status: "Sent" }))),
                variations: ok([]),
            };
        });

        it("lists all 1,001 of this account's projects and totals every row beyond the first 1,000", async () => {
            const { page } = await render();
            const props = clientProps(page);
            expect(props.projects).toHaveLength(1001);
            expect(props).toMatchObject({ totalCosts: 10010, totalInvoiced: 100100, totalOutstanding: 100100 });
            const projectReads = mocks.calls.filter((call) => call.table === "projects");
            expect(projectReads.map((call) => call.range)).toEqual([[0, 999], [1000, 1999]]);
            expect(projectReads.every((call) => call.filters.some(([op, column, value]) => op === "eq" && column === "user_id" && value === "user-1"))).toBe(true);
        });

        it("keeps every id filter short, in chunks of at most 100 projects", async () => {
            await render();
            const filtered = mocks.calls.filter((call) => call.filters.some(([op]) => op === "in"));
            expect(filtered.length).toBeGreaterThan(0);
            for (const call of filtered) expect((call.filters.find(([op]) => op === "in")![2] as unknown[]).length).toBeLessThanOrEqual(100);
            const expenseIds = new Set(mocks.calls.filter((call) => call.table === "project_expenses").flatMap((call) => call.filters[0][2] as string[]));
            expect(expenseIds.size).toBe(1001);
            expect(expenseIds.has("other-job")).toBe(false);
        });

        it("reads in full when the server returns fewer rows per request than asked", async () => {
            mocks.cap = 50;
            const { page } = await render();
            expect(clientProps(page)).toMatchObject({ totalCosts: 10010, totalInvoiced: 100100 });
        });

        it("shows invoice totals as unavailable, not a partial sum, when a later page fails", async () => {
            mocks.cap = 50;
            mocks.failFrom.invoices = 50;
            const { page, html } = await render();
            const props = clientProps(page);
            expect(props.unavailable).toEqual({ costs: false, invoices: true, variations: false });
            expect(props).toMatchObject({ totalCosts: 10010, totalInvoiced: null, totalOutstanding: null });
            expect(html).toContain("Some figures could not be loaded: invoices.");
        });

        it("throws rather than listing part of the portfolio when a later page of projects fails", async () => {
            mocks.failFrom.projects = 1000;
            await expect(render()).rejects.toThrow("Live Projects could not load your projects.");
        });

        it("prices from all 1,200 lines of a large estimate, and throws when a later page of lines fails", async () => {
            mocks.results.estimates = ok([{ ...estimate, id: "est-big", project_id: "job-00000" }]);
            mocks.results.estimate_lines = ok(many(1200, "line", () => ({ estimate_id: "est-big", trade_section: "Groundworks", line_total: 10, line_type: "measured" })));
            const { page } = await render();
            expect(clientProps(page).projects.find((p) => (p as unknown as { id: string }).id === "job-00000")).toMatchObject({ contractValue: 12000, budgetCost: 12000 });

            mocks.calls = [];
            mocks.failFrom.estimate_lines = 1000;
            await expect(render()).rejects.toThrow("Live Projects could not load your estimate lines.");
        });
    });
});
