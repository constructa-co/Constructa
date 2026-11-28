import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
    createClient: vi.fn(),
    results: {} as Record<string, { data: unknown; error: unknown }>,
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
    id: "est-1", project_id: "job-1", is_active: true, total_cost: 0,
    overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0,
    estimate_lines: [{ trade_section: "Groundworks", line_total: 10000, line_type: "measured" }],
};
const project = { id: "job-1", name: "Kitchen extension", client_name: "A Client", potential_value: 50000, created_at: "2026-11-01T00:00:00Z" };

function supabase() {
    return {
        auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) },
        from: (table: string) => {
            const query: Record<string, unknown> = {};
            const settle = () => Promise.resolve(mocks.results[table] ?? ok([]));
            for (const method of ["select", "eq", "in", "order"]) query[method] = () => query;
            query.single = settle;
            query.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => settle().then(resolve, reject);
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
            project_expenses: ok([{ id: "c1", description: "Skip hire", amount: 12000, cost_type: "plant", expense_date: "2026-11-10" }]),
            invoices: ok([{ id: "i1", invoice_number: "INV-1", type: "Interim", amount: 4000, status: "Sent", created_at: "2026-11-12T00:00:00Z" }]),
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
            project_expenses: ok([{ project_id: "job-1", amount: 12000 }]),
            invoices: ok([{ project_id: "job-1", amount: 4000, status: "Sent" }]),
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
