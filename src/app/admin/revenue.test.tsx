import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";

const dependencies = vi.hoisted(() => ({
    requireAdmin: vi.fn(),
    createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: dependencies.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: dependencies.createAdminClient }));
vi.mock("./admin-client", () => ({ default: () => null }));
vi.mock("./actions", () => ({ saveCostEntryAction: vi.fn(), sendReportEmailAction: vi.fn() }));

import AdminPage from "./page";
import { gbpOrUnavailable, grossMarginPct, revenueWithoutVerifiedBilling, ruleOf40Score } from "./revenue";
import type { AdminData } from "./types";
import OverviewTab from "./tabs/overview-tab";
import RevenueTab from "./tabs/revenue-tab";
import CostsTab from "./tabs/costs-tab";
import { generateReportText, type ReportType } from "./tabs/reports-tab";

const NOW = new Date();
const thisMonth = `${NOW.getUTCFullYear()}-${String(NOW.getUTCMonth() + 1).padStart(2, "0")}`;

/** Builds a service-role client double with `count` signed-up accounts and one £120 cost entry this month. */
function adminClientWith(count: number) {
    const ids = Array.from({ length: count }, (_, i) => `user-${i}`);
    const created = (i: number) => new Date(NOW.getTime() - (i % 400) * 86_400_000).toISOString();
    const tables: Record<string, unknown[]> = {
        profiles: ids.map((id, i) => ({ id, company_name: `Co ${i}`, country: "GB", signup_source: null, created_at: created(i), data_consent: true })),
        admin_costs: [{ id: "c1", month: `${thisMonth}-01`, category: "Supabase", description: "Database", amount_gbp: 120 }],
    };
    return {
        auth: {
            admin: {
                listUsers: async () => ({
                    data: { users: ids.map((id, i) => ({ id, email: `${id}@example.test`, created_at: created(i), last_sign_in_at: created(i) })) },
                    error: null,
                }),
            },
        },
        from: (table: string) => {
            const query: Record<string, unknown> = {};
            for (const method of ["select", "eq", "in", "order", "neq", "not", "gte", "lte"]) query[method] = () => query;
            query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve);
            return query;
        },
    };
}

async function adminData(signups: number): Promise<AdminData> {
    dependencies.createAdminClient.mockReturnValue(adminClientWith(signups));
    const page = (await AdminPage()) as ReactElement<{ data: AdminData }>;
    return page.props.data;
}

beforeEach(() => {
    dependencies.requireAdmin.mockResolvedValue(undefined);
    // No hosted calls: no provider keys, and any network attempt fails the test.
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("PLAUSIBLE_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network call attempted in test"); }));
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

describe("revenue truth helpers", () => {
    it("has no revenue without verified billing: every figure is unknown, not zero", () => {
        expect(revenueWithoutVerifiedBilling()).toEqual({
            status: "no_verified_billing",
            mrr: null, arr: null, arpu: null, ltv: null, mrrByMonth: [],
            momGrowthPct: null, qoqGrowthPct: null, yoyGrowthPct: null, projectedArrEoy: null,
        });
    });

    it("keeps unknown revenue distinct from a real £0", () => {
        const fmt = (n: number) => `£${n}`;
        expect(gbpOrUnavailable(null, fmt)).toBe("Unavailable");
        expect(gbpOrUnavailable(0, fmt)).toBe("£0");
    });

    it("gives no margin or Rule of 40 without real revenue", () => {
        expect(grossMarginPct(null, 120)).toBeNull();
        expect(grossMarginPct(0, 120)).toBeNull();
        expect(grossMarginPct(1000, 250)).toBe(75);
        expect(ruleOf40Score(null, 75)).toBeNull();
        expect(ruleOf40Score(10, null)).toBeNull();
        expect(ruleOf40Score(10, 30)).toBe(40);
    });
});

describe("admin page: signups never become revenue", () => {
    it("still denies a non-admin before constructing a privileged client", async () => {
        dependencies.requireAdmin.mockRejectedValueOnce(new Error("Unauthorized admin access."));
        dependencies.createAdminClient.mockClear();
        await expect(AdminPage()).rejects.toThrow("Unauthorized admin access.");
        expect(dependencies.createAdminClient).not.toHaveBeenCalled();
    });

    it.each([0, 3, 500])("reports %i signups with revenue unavailable and no derived margin", async (signups) => {
        const data = await adminData(signups);
        expect(data.totalSubscribers).toBe(signups);
        expect(data.revenue).toEqual(revenueWithoutVerifiedBilling());
        expect(data.costs.grossMarginPct).toBeNull();
        expect(data.ruleOf40Score).toBeNull();
        // Real cost data is still reported.
        expect(data.costs.totalMonthlyCostGbp).toBe(120);
    });

    it("keeps real cost per account, which is cost and not revenue", async () => {
        const data = await adminData(4);
        expect(data.costs.costPerUserGbp).toBe(30);
    });
});

describe("admin surfaces show unavailable revenue, never an assumed price", () => {
    // 500 signups at the old assumed £49 would have read as £24,500 MRR and £294,000 ARR.
    const fabricated = /£49\b|£24,500|£294,000|£24500|£294000/;

    it("overview, revenue and costs tabs render Unavailable instead of signup-priced figures", async () => {
        const data = await adminData(500);
        for (const [name, element] of [
            ["overview", <OverviewTab key="o" data={data} />],
            ["revenue", <RevenueTab key="r" data={data} />],
            ["costs", <CostsTab key="c" data={data} />],
        ] as const) {
            const html = renderToStaticMarkup(element);
            expect(html, name).not.toMatch(fabricated);
            expect(html, name).toContain("Unavailable");
        }
        const revenue = renderToStaticMarkup(<RevenueTab data={data} />);
        expect(revenue).toContain("No verified billing data. Signups are accounts, not revenue.");
        expect(revenue).toContain("Accounts, not paying customers");
        const costs = renderToStaticMarkup(<CostsTab data={data} />);
        expect(costs).not.toMatch(/Revenue \(MRR\)<\/td><td[^>]*>£/);
        expect(costs).not.toMatch(/Gross Margin<\/span><span[^>]*>-?\d/);
    });

    it.each(["daily", "weekly", "monthly", "quarterly", "annual"] as ReportType[])(
        "the %s report states revenue is unavailable and never prices signups",
        async (type) => {
            const text = generateReportText(type, await adminData(500));
            expect(text).not.toMatch(fabricated);
            expect(text).not.toMatch(/(MRR|ARR|ARPU|LTV \(est\.\)|Gross Profit|EBITDA \(est\.\)):?\s+£/);
            expect(text).toMatch(/MRR:\s+Unavailable/);
        },
    );
});
