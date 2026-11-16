import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeClientBoQLines } from "@/lib/client-boq-normalize";
import { parseEstimateBatchCsv } from "@/lib/estimate-batch-csv";
import { createBoQEstimateAction } from "./boq-import-action";
import { loadAdvancedEstimatingDataAction } from "./simple-actions";

const mocks = vi.hoisted(() => ({
    requireAuth: vi.fn(),
    getActiveOrganizationId: vi.fn(),
    requireEditableProjectAccess: vi.fn(),
    requireLaunchCapability: vi.fn(),
    generateJSON: vi.fn(),
}));

vi.mock("@/lib/supabase/auth-utils", () => ({
    requireAuth: mocks.requireAuth,
    getActiveOrganizationId: mocks.getActiveOrganizationId,
}));
vi.mock("@/lib/supabase/project-resource-access", () => ({
    requireEditableProjectAccess: mocks.requireEditableProjectAccess,
}));
vi.mock("@/lib/launch-profile", () => ({
    requireLaunchCapability: mocks.requireLaunchCapability,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function fakeCatalogueDb(options: { legacyError?: boolean; momRate?: number; failTable?: string; emptyLegacy?: boolean }) {
    const momItem = {
        id: "mom-1",
        code: "GW01",
        description: "Excavate",
        unit: "m3",
        base_rate: options.momRate ?? 25,
        category_id: "cat-1",
    };
    const tables: Record<string, unknown[]> = {
        rate_buildups: [],
        mom_categories: [{ id: "cat-1", name: "Groundworks" }],
        mom_items: [momItem],
        mom_item_overrides: [],
        cost_library_items: [{ id: "leg-1", code: "L1", description: "Legacy", unit: "nr", base_rate: 9, category: "General", is_system_default: true }],
        labour_rates: [],
        profiles: [{ id: "user-1", preferred_trades: ["Groundworks"] }],
    };

    const from = (table: string) => {
        const builder = {
            select: () => builder,
            order: () => builder,
            or: () => builder,
            eq: () => builder,
            is: () => builder,
            single: async () => {
                if (table === "profiles") return { data: tables.profiles[0], error: null };
                return { data: null, error: null };
            },
            then: (resolve: (v: unknown) => unknown) => {
                if (table === "cost_library_items" && options.legacyError) {
                    return Promise.resolve(resolve({ data: null, error: { message: "legacy offline" } }));
                }
                if (table === options.failTable) {
                    return Promise.resolve(resolve({ data: null, error: { message: `${table} offline` } }));
                }
                if (table === "cost_library_items" && options.emptyLegacy) {
                    return Promise.resolve(resolve({ data: [], error: null }));
                }
                return Promise.resolve(resolve({ data: tables[table] ?? [], error: null }));
            },
        };
        return builder;
    };
    return { from };
}

describe("CON-181 integration paths", () => {
    const advanced = readFileSync(path.resolve(import.meta.dirname, "advanced-estimate.tsx"), "utf8");
    const dropdown = readFileSync(path.resolve(import.meta.dirname, "catalogue-library-dropdown.tsx"), "utf8");
    const css = readFileSync(path.resolve(import.meta.dirname, "../../../../components/estimating.module.css"), "utf8");

    it("renders catalogue matches through a body portal with fixed positioning", () => {
        expect(advanced).toContain("createPortal");
        expect(advanced).toContain("catalogueDropdownPanel");
        expect(dropdown).toMatch(/createPortal/);
        expect(dropdown).toMatch(/data-library-dropdown/);
        expect(advanced).toMatch(/className:\s*"fixed z-\[60\]/);
        expect(advanced).toMatch(/maxWidth:\s*"min\(100vw - 16px, 480px\)"/);
    });

    it("keeps priced CSV rows as lines with units and explicit totals", () => {
        const csv = `Section,Description,Qty,Unit,Rate,Total\nGroundworks,Dig out,2,m3,10,25\n`;
        const result = parseEstimateBatchCsv(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // 2 × £10 is stored; the file's £25 is reported, not persisted.
        expect(result.lines[0]).toMatchObject({ unit: "m3", quantity: 2, line_total: 20, total_mismatch: { stated: 25, computed: 20 } });
        expect(result.lines[0].parse_warnings).toBeUndefined();
    });

    it("stores qty × rate server-side when a posted total disagrees", async () => {
        mocks.requireLaunchCapability.mockImplementation(() => {});
        const inserted: Record<string, unknown>[] = [];
        const from = (table: string) => {
            const builder: Record<string, unknown> = {
                insert: (rows: unknown) => {
                    if (table === "estimate_lines") inserted.push(...(rows as Record<string, unknown>[]));
                    return builder;
                },
                update: () => builder,
                select: () => builder,
                eq: () => builder,
                neq: () => builder,
                single: async () => ({ data: table === "estimates" ? { id: "estimate-1" } : { status: "Estimating" }, error: null }),
                then: (resolve: (v: unknown) => unknown) => Promise.resolve(resolve({ data: null, error: null })),
            };
            return builder;
        };
        mocks.requireEditableProjectAccess.mockResolvedValue({ supabase: { from } });
        const line = { client_ref: "", section: "Groundworks", unit: "m3" };
        const result = await createBoQEstimateAction("11111111-1111-4111-8111-111111111111", {
            filename: "totals.csv",
            sections: ["Groundworks"],
            totalLines: 3,
            lines: [
                { ...line, description: "Dig out", quantity: 2, unit_rate: 10, line_total: 25 },
                { ...line, description: "Cart away", quantity: 2, unit_rate: 10, line_total: 20 },
                { ...line, description: "Provisional sum", quantity: null, unit_rate: 0, line_total: 500 },
            ],
        });
        expect(result).toMatchObject({ success: true, estimateId: "estimate-1" });
        expect(inserted.map(row => row.line_total)).toEqual([20, 20, 500]);
    });

    it("does not downgrade malformed priced CSV rows into headings", () => {
        const csv = `Section,Description,Qty,Unit,Rate\nWorks,Clear site,abc,m2,12\n`;
        const result = parseEstimateBatchCsv(csv);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.lines[0]).toMatchObject({ description: "Clear site", unit: "m2", parse_warnings: ["quantity"] });
        expect(result.lines[0].quantity).toBeNull();
    });

    it("blocks BoQ import server-side when parse warnings remain", async () => {
        mocks.requireLaunchCapability.mockImplementation(() => {});
        const result = await createBoQEstimateAction("project-id", {
            filename: "warned.csv",
            sections: ["General"],
            totalLines: 1,
            lines: [{ client_ref: "", section: "General", description: "Bad row", quantity: null, unit: "m2", unit_rate: 0, line_total: 0, parse_warnings: ["quantity"] }],
        });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/unreadable/i);
    });

    it("reconciles explicit AI line totals and keeps malformed rows priced", () => {
        const lines = normalizeClientBoQLines([
            { section: "A", description: "Paving", quantity: 4, unit: "m2", unit_rate: 10, line_total: 55 },
            { section: "A", description: "Edge", quantity: "lots", unit: "m", unit_rate: 5, line_total: 0 },
        ]);
        expect(lines[0]).toMatchObject({ unit: "m2", line_total: 40, total_mismatch: { stated: 55, computed: 40 } });
        expect(lines[1]).toMatchObject({ unit: "m", parse_warnings: ["quantity"], quantity: null });
    });

    describe("loadAdvancedEstimatingDataAction", () => {
        beforeEach(() => {
            mocks.requireAuth.mockResolvedValue({ supabase: fakeCatalogueDb({ legacyError: true, momRate: 30 }), user: { id: "user-1" } });
            mocks.getActiveOrganizationId.mockResolvedValue("org-1");
        });

        it("serves MoM catalogue when legacy cost_library_items fails", async () => {
            const result = await loadAdvancedEstimatingDataAction();
            expect(result.ok).toBe(true);
            if (!result.ok) return;
            expect(result.data.catalogueSource).toBe("mom");
            expect(result.data.costLibrary[0]).toMatchObject({ base_rate: 30, unit: "m3" });
        });

        it.each(["mom_categories", "mom_items", "mom_item_overrides"])(
            "serves the legacy catalogue when %s fails",
            async (failTable) => {
                vi.spyOn(console, "error").mockImplementation(() => {});
                mocks.requireAuth.mockResolvedValue({ supabase: fakeCatalogueDb({ failTable }), user: { id: "user-1" } });
                const result = await loadAdvancedEstimatingDataAction();
                expect(result.ok).toBe(true);
                if (!result.ok) return;
                expect(result.data.catalogueSource).toBe("legacy");
                expect(result.data.costLibrary).toEqual([expect.objectContaining({ id: "leg-1", base_rate: 9 })]);
            },
        );

        it("fails rather than serving an empty catalogue when MoM is down and legacy has no rows", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            mocks.requireAuth.mockResolvedValue({ supabase: fakeCatalogueDb({ failTable: "mom_items", emptyLegacy: true }), user: { id: "user-1" } });
            const result = await loadAdvancedEstimatingDataAction();
            expect(result.ok).toBe(false);
        });

        it("fails when both catalogues are down", async () => {
            vi.spyOn(console, "error").mockImplementation(() => {});
            mocks.requireAuth.mockResolvedValue({ supabase: fakeCatalogueDb({ failTable: "mom_items", legacyError: true }), user: { id: "user-1" } });
            const result = await loadAdvancedEstimatingDataAction();
            expect(result.ok).toBe(false);
        });
    });

    it("keeps sticky total dock above workspace chrome on narrow viewports", () => {
        expect(css).toMatch(/\.totalDock[\s\S]*z-index:\s*20/);
        expect(css).toMatch(/@media \(max-width: 540px\)[\s\S]*\.advancedWorkspaceWide[\s\S]*min-width:\s*0/);
        expect(css).toMatch(/@media \(max-width: 540px\)[\s\S]*\.advancedWorkspaceRoot[\s\S]*padding-bottom:/);
    });
});