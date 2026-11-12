import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/__fixtures__/fake-supabase";
import { computeContractSum } from "@/lib/financial";
import { minimalInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { buildProposalDocument } from "@/lib/proposal-document";

const access = vi.hoisted(() => ({ requireEstimateAccess: vi.fn(), requireEditableAccessForVerifiedProject: vi.fn() }));
vi.mock("@/lib/supabase/project-resource-access", () => access);
import { savePriceLineActivityAction } from "./activity-actions";

const estimateId = "11111111-1111-4111-8111-111111111111", lineId = "22222222-2222-4222-8222-222222222222";
const request = { estimateId, lineId, expectedSection: "General", section: " Kitchen preparation " };
function setup(section: string | null = "General", mode: string | null = "simple", boq = false) {
    const db = fakeSupabase({ estimates: [{ id: estimateId, project_id: "job", is_client_boq: boq }], estimate_lines: [
        { id: lineId, estimate_id: estimateId, trade_section: section, pricing_mode: mode, description: "Saved work", quantity: 2, unit_rate: 12.34, line_total: 24.68, estimate_line_components: [{ id: "resource", quantity: 7 }] },
        { id: "other-line", estimate_id: "other-estimate", trade_section: "Keep", quantity: 9 },
    ] });
    access.requireEstimateAccess.mockResolvedValue({ supabase: db.client, projectId: "job" });
    access.requireEditableAccessForVerifiedProject.mockResolvedValue({});
    return db;
}
beforeEach(() => { Object.values(access).forEach(mock => mock.mockReset()); });
describe("explicit single-line activity assignment", () => {
    it("requires existing owner/edit locks and writes only trade_section with old section/mode membership guards", async () => {
        const db = setup(), before = JSON.stringify(db.tables);
        expect(await savePriceLineActivityAction(request)).toEqual({ ok: true, estimateId, lineId, section: "Kitchen preparation" });
        expect(access.requireEstimateAccess).toHaveBeenCalledWith(estimateId);
        expect(access.requireEditableAccessForVerifiedProject).toHaveBeenCalledWith(expect.objectContaining({ projectId: "job" }), "job");
        expect(db.updates).toEqual([{ table: "estimate_lines", values: { trade_section: "Kitchen preparation" }, filters: { id: lineId, estimate_id: estimateId, trade_section: "General", pricing_mode: "simple" } }]);
        const restored = JSON.parse(JSON.stringify(db.tables)); restored.estimate_lines[0].trade_section = "General";
        expect(JSON.stringify(restored)).toBe(before); expect(db.rpcCalls).toEqual([]);
    });
    it("carries the confirmed activity into the existing proposal grouping with the same money and line identity", async () => {
        const db = setup(), source = minimalInput();
        source.estimate = { id: estimateId, version_name: "Existing estimate", prelims_pct: 10, overhead_pct: 5, profit_pct: 7, risk_pct: 3, discount_pct: 0,
            estimate_lines: [{ id: lineId, trade_section: "General", description: "Saved work", quantity: 2, unit: "item", line_total: 24.68 }] };
        const before = buildProposalPublicationSnapshot(source);
        const result = await savePriceLineActivityAction(request);
        expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
        source.estimate.estimate_lines[0].trade_section = String(db.tables.estimate_lines[0].trade_section);
        const snapshot = buildProposalPublicationSnapshot(source), document = buildProposalDocument(snapshot);
        expect(snapshot.commercial.contract_sum_ex_vat).toBe(before.commercial.contract_sum_ex_vat);
        expect(snapshot.commercial.fee_items[0]).toMatchObject({ id: lineId, trade_section: result.section });
        const price = document.sections.flatMap(section => section.blocks).find(block => block.type === "price");
        expect(price?.type).toBe("price"); if (price?.type !== "price") throw Error("Missing price block");
        expect(price.groups[0].title).toBe(result.section);
    });
    it.each([null, "", "__proto__", "constructor", "toString", "Legacy ".repeat(20)])("preserves exact previous activity %s for CAS and never reclassifies other lines", async section => {
        const db = setup(section);
        expect((await savePriceLineActivityAction({ ...request, expectedSection: section })).ok).toBe(true);
        expect(db.updates[0].filters.trade_section).toBe(section);
        expect(db.tables.estimate_lines[1].trade_section).toBe("Keep");
    });
    it("handles legacy null pricing_mode without normalizing it", async () => {
        const db = setup("General", null); expect((await savePriceLineActivityAction(request)).ok).toBe(true);
        expect(db.updates[0].filters.pricing_mode).toBeNull(); expect(db.tables.estimate_lines[0].pricing_mode).toBeNull();
    });
    it("preserves canonical money with percentage prelims and refuses moving into/out of explicit Preliminaries", async () => {
        const db = setup();
        const estimate = { total_cost: 24.68, prelims_pct: 10, overhead_pct: 12, profit_pct: 7, risk_pct: 3, discount_pct: 2 };
        const before = computeContractSum(estimate, [{ trade_section: "General", line_total: 24.68 }]);
        expect((await savePriceLineActivityAction(request)).ok).toBe(true);
        expect(computeContractSum(estimate, [{ trade_section: String(db.tables.estimate_lines[0].trade_section), line_total: 24.68 }])).toEqual(before);
        db.updates.length = 0;
        expect((await savePriceLineActivityAction({ ...request, section: "Preliminaries" })).ok).toBe(false);
        expect((await savePriceLineActivityAction({ ...request, expectedSection: "Preliminaries" })).ok).toBe(false);
        expect(db.updates).toEqual([]);
    });
    it.each(["", " ", "x".repeat(101)])("refuses invalid new names without touching auth or storage: %s", async section => {
        setup(); expect((await savePriceLineActivityAction({ ...request, section })).ok).toBe(false);
        expect(access.requireEstimateAccess).not.toHaveBeenCalled();
    });
    it("accepts exactly 100 characters and makes an unchanged activity a read-confirmed no-write", async () => {
        const db = setup(); expect((await savePriceLineActivityAction({ ...request, section: "x".repeat(100) })).ok).toBe(true);
        db.updates.length = 0;
        expect((await savePriceLineActivityAction({ ...request, expectedSection: "x".repeat(100), section: "x".repeat(100) })).ok).toBe(true);
        expect(db.updates).toEqual([]);
    });
    it.each(["owner", "lock", "boq", "buildup", "missing-line", "wrong-estimate", "stale-section", "read-error"])("refuses %s before writing", async reason => {
        const db = setup("General", reason === "buildup" ? "buildup" : "simple", reason === "boq");
        if (reason === "owner") access.requireEstimateAccess.mockRejectedValueOnce(Error("Not owned"));
        if (reason === "lock") access.requireEditableAccessForVerifiedProject.mockRejectedValueOnce(Error("Locked"));
        if (reason === "missing-line") db.tables.estimate_lines = [];
        if (reason === "wrong-estimate") db.tables.estimates[0].project_id = "other";
        if (reason === "stale-section") db.tables.estimate_lines[0].trade_section = "Newer section";
        if (reason === "read-error") db.fail("estimate_lines", "select");
        expect((await savePriceLineActivityAction(request)).ok).toBe(false); expect(db.updates).toEqual([]);
    });
    it("requires a returned matching row and reports missing/error acknowledgement as uncertain", async () => {
        const db = setup(); db.fail("estimate_lines", "update");
        expect(await savePriceLineActivityAction(request)).toMatchObject({ ok: false, uncertain: true });
        expect(db.tables.estimate_lines[0].trade_section).toBe("General");
    });
    it.each(["section", "mode", "lost-reply"])("fences concurrent %s or uncertain acknowledgement without definite-unsaved claims", async reason => {
        const db = setup();
        const client = { from: (table: string) => {
            const builder = db.client.from(table), update = builder.update;
            builder.update = values => {
                if (reason === "section") db.tables.estimate_lines[0].trade_section = "Other client";
                if (reason === "mode") db.tables.estimate_lines[0].pricing_mode = "buildup";
                const result = update(values);
                if (reason === "lost-reply") {
                    const one = result.maybeSingle;
                    result.maybeSingle = async () => { await one(); throw Error("Reply lost after commit"); };
                }
                return result;
            };
            return builder;
        } };
        access.requireEstimateAccess.mockResolvedValueOnce({ supabase: client, projectId: "job" });
        const result = await savePriceLineActivityAction(request);
        expect(result).toMatchObject({ ok: false, uncertain: true });
        if (reason === "lost-reply") expect(db.tables.estimate_lines[0].trade_section).toBe("Kitchen preparation");
        else expect(db.tables.estimate_lines[0].trade_section).not.toBe("Kitchen preparation");
    });
});
