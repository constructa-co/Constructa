import { describe, expect, it } from "vitest";
import type { Estimate, EstimateLine } from "@/app/dashboard/projects/costs/types";
import { EMPTY_PRICE_LINE_DRAFT } from "./simple-estimate";
import { savedLineReuseContext, reviewSavedLine, prepareSavedLineReuse } from "./saved-line-reuse";
const project = { id: "job", brief_scope: "Saved brief" };
const line: EstimateLine = { id: "source", estimate_id: "estimate", description: "Fit doors, excluding frames", trade_section: "Carpentry", quantity: 321, unit: "nr", unit_rate: 79.123, line_total: 25398.483, pricing_mode: "simple", line_type: "general", estimate_line_components: [] };
const estimate = (): Estimate => ({ id: "estimate", project_id: "job", version_name: "Current", is_active: true, overhead_pct: 4, profit_pct: 5, risk_pct: 2, prelims_pct: 1, discount_pct: 0, discount_reason: "", total_cost: 26000, estimate_lines: [{ ...line }] });
function context(input = estimate()) { const result = savedLineReuseContext(project, input); if (!result.ok) throw Error(result.error); return result.value; }
describe("saved line source reuse without pricing", () => {
    it("whitelists only wording/activity in a fresh empty unpriced draft,and mutates nothing", () => {
        const input = estimate(), before = JSON.stringify(input), source = context(input);
        const result = prepareSavedLineReuse(reviewSavedLine(source.sources[0], source), source, false);
        expect(result).toEqual({ ok: true, value: { ...EMPTY_PRICE_LINE_DRAFT, description: line.description, activity: "Carpentry" } });
        expect(JSON.stringify(input)).toBe(before); if (result.ok) expect(result.value).not.toHaveProperty("lineId");
    });
    it("reuses the established whitespace review without dropping qualifiers or guessing prices", () => {
        const input = estimate(); input.estimate_lines[0].description = "  Fit\n doors\t excluding frames  "; const source = context(input);
        expect(prepareSavedLineReuse(reviewSavedLine(source.sources[0], source), source, false)).toMatchObject({ ok: true, value: { description: "Fit doors excluding frames", amount: "", quantity: "", rate: "" } });
    });
    it.each(["", " \n ", "Bad\u0000text", "x".repeat(501)])("refuses invalid/overlong wording without truncation %s", description => {
        const input = estimate(); input.estimate_lines[0].description = description; const source = context(input);
        expect(prepareSavedLineReuse(reviewSavedLine(source.sources[0], source), source, false).ok).toBe(false);
        expect(source.sources[0].description).toBe(description);
    });
    it.each(["Preliminaries", " Preliminaries ", "x".repeat(101)])("preserves reserved/activity limits %s", activity => {
        const input = estimate(); input.estimate_lines[0].trade_section = activity; const source = context(input);
        expect(prepareSavedLineReuse(reviewSavedLine(source.sources[0], source), source, false).ok).toBe(false);
    });
    it("retains blank activity as the existing General default and allows exact 500/100 bounds", () => {
        const input = estimate(); input.estimate_lines[0].description = "x".repeat(500); input.estimate_lines[0].trade_section = "y".repeat(100); let source = context(input);
        expect(prepareSavedLineReuse(reviewSavedLine(source.sources[0], source), source, false).ok).toBe(true);
        input.estimate_lines[0].trade_section = ""; source = context(input);
        expect(prepareSavedLineReuse(reviewSavedLine(source.sources[0], source), source, false)).toMatchObject({ ok: true, value: { activity: "" } });
    });
    it("refuses built-up/BoQ/cross-job/cross-estimate/duplicate identities", () => {
        const input = estimate(); input.estimate_lines[0].pricing_mode = "buildup"; expect(context(input).sources).toEqual([]);
        input.is_client_boq = true; expect(context(input).sources).toEqual([]);
        input.project_id = "other"; expect(savedLineReuseContext(project, input).ok).toBe(false);
        input.project_id = "job"; input.estimate_lines[0].estimate_id = "other"; expect(savedLineReuseContext(project, input).ok).toBe(false);
        input.estimate_lines[0].estimate_id = input.id; input.estimate_lines.push({ ...input.estimate_lines[0] }); expect(savedLineReuseContext(project, input).ok).toBe(false);
        expect(savedLineReuseContext(project, null).ok).toBe(false);
    });
    it.each(["description", "activity", "lineId", "revision", "projectId", "estimateId"])("refuses tampered reviewed %s", field => {
        const source = context(), pending = reviewSavedLine(source.sources[0], source);
        expect(prepareSavedLineReuse({ ...pending, [field]: "Changed" }, source, false).ok).toBe(false);
    });
    it("rechecks the entire existing source revision,including noncopied prices/resources and open work", () => {
        const input = estimate(), source = context(input), pending = reviewSavedLine(source.sources[0], source);
        expect(prepareSavedLineReuse(pending, source, true).ok).toBe(false);
        input.estimate_lines[0].unit_rate = 100; expect(prepareSavedLineReuse(pending, context(input), false).ok).toBe(false);
        const changedBrief = savedLineReuseContext({ ...project, brief_scope: "New brief" }, estimate()); if (!changedBrief.ok) throw Error(changedBrief.error);
        expect(prepareSavedLineReuse(pending, changedBrief.value, false).ok).toBe(false);
    });
});
