import { describe, expect, it } from "vitest";
import type { Estimate } from "@/app/dashboard/projects/costs/types";
import { buildPricingReviewContext, prepareReviewedPriceDraft, pricingModelData, reviewPricingSuggestion, PRICING_REVIEW_OPEN, PRICING_REVIEW_STALE } from "./pricing-review";
import { EMPTY_PRICE_LINE_DRAFT } from "./simple-estimate";

function estimate(): Estimate {
    return { id: "estimate", project_id: "job", version_name: "Estimate", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 777, estimate_lines: [{ id: "line", estimate_id: "estimate", description: "Existing work", quantity: 3, unit: "item", unit_rate: 259, line_total: 777, trade_section: "General", line_type: "general", pricing_mode: "simple", estimate_line_components: [] }] };
}
function context(value = estimate(), work = "Remove old units. Fit new units.", message = "Keep the existing floor.") {
    const result = buildPricingReviewContext({ id: "job", brief_scope: work + "\n\nSite, access and assumptions:\nPrivate site note." }, value, message);
    if (!result.ok) throw Error(result.error);
    return result.value;
}
function pending(c = context()) {
    const result = reviewPricingSuggestion(c, { message: "Review this activity.", suggestions: [{ source: "briefWork", start: 0, end: 17 }] });
    if (!result.ok) throw Error(result.error);
    return result.value;
}
describe("source-bound pricing review", () => {
    it("allowlists work context without contacts, site notes, IDs, rates or internal revision in future model data", () => {
        const c = context();
        const data = pricingModelData(c);
        expect(data).toEqual({ work: "Remove old units. Fit new units.", contractorMessage: "Keep the existing floor.", existingWork: [{ description: "Existing work", section: "General" }] });
        expect(JSON.stringify(data)).not.toMatch(/777|259|Private site note|revision|projectId|estimateId/);
        data.existingWork[0].description = "Changed copy";
        expect(c.existingWork[0].description).toBe("Existing work");
    });
    it("rejects a mismatched job or foreign price line", () => {
        const e = estimate(); e.project_id = "other";
        expect(buildPricingReviewContext({ id: "job", brief_scope: "Work" }, e).ok).toBe(false);
        e.project_id = "job"; e.estimate_lines[0].estimate_id = "other";
        expect(buildPricingReviewContext({ id: "job", brief_scope: "Work" }, e).ok).toBe(false);
    });
    it("accepts a not-yet-created estimate without creating one", () => {
        const result = buildPricingReviewContext({ id: "job", brief_scope: "Work" }, null);
        expect(result.ok && result.value.estimateId).toBeNull();
    });
    it("refuses oversized source text without silently truncating it", () => {
        expect(buildPricingReviewContext({ id: "job", brief_scope: "x".repeat(20001) }, null).ok).toBe(false);
    });
    it("holds source quotes for review and opens only an empty-price draft after deliberate choice", () => {
        const e = estimate(), c = context(e), before = JSON.stringify(e);
        const result = prepareReviewedPriceDraft(pending(c), 0, c, false);
        expect(result).toEqual({ ok: true, value: { ...EMPTY_PRICE_LINE_DRAFT, description: "Remove old units." } });
        expect(JSON.stringify(e)).toBe(before);
    });
    it("can quote the contractor's current message, never a model-authored price or activity name", () => {
        const c = context();
        const result = reviewPricingSuggestion(c, { message: "Review", suggestions: [{ source: "contractorMessage", start: 0, end: c.contractorMessage.length }] });
        expect(result.ok && result.value.suggestions[0].description).toBe("Keep the existing floor.");
    });
    it.each([
        { rate: 50 }, { quantity: 2 }, { description: "Invented work" }, { save: true }, { tool: "delete" }, { calendar: "7-day" },
    ])("refuses extra nested action/financial fields %j", extra => {
        expect(reviewPricingSuggestion(context(), { message: "Review", suggestions: [{ source: "briefWork", start: 0, end: 17, ...extra }] }).ok).toBe(false);
    });
    it("refuses unknown top-level actions and duplicate activities", () => {
        const range = { source: "briefWork", start: 0, end: 17 };
        expect(reviewPricingSuggestion(context(), { message: "Review", suggestions: [range], action: "save" }).ok).toBe(false);
        expect(reviewPricingSuggestion(context(), { message: "Review", suggestions: [range, range] }).ok).toBe(false);
    });
    it.each([{ start: -1, end: 5 }, { start: 0.1, end: 5 }, { start: 5, end: 5 }, { start: 0, end: 999 }, { start: 0, end: Infinity }])("refuses invalid source offsets %j", range => {
        expect(reviewPricingSuggestion(context(), { message: "Review", suggestions: [{ source: "briefWork", ...range }] }).ok).toBe(false);
    });
    it("normalises only whitespace for the existing one-line input and never truncates words", () => {
        const c = context(estimate(), " Prepare walls.\n\n Paint walls. ");
        const result = reviewPricingSuggestion(c, { message: "", suggestions: [{ source: "briefWork", start: 0, end: c.work.length }] });
        expect(result.ok && result.value.suggestions[0].description).toBe("Prepare walls. Paint walls.");
        const long = context(estimate(), "x".repeat(501));
        expect(reviewPricingSuggestion(long, { message: "", suggestions: [{ source: "briefWork", start: 0, end: 501 }] }).ok).toBe(false);
    });
    it.each(["price", "quantity", "brief", "version", "components", "message"])("refuses an old review after %s changes", change => {
        const e = estimate(), c = context(e), p = pending(c);
        let work = c.work, message = c.contractorMessage;
        if (change === "price") e.estimate_lines[0].unit_rate = 300;
        if (change === "quantity") e.estimate_lines[0].quantity = 4;
        if (change === "brief") work += " Extra work.";
        if (change === "version") {
            e.id = "version2";
            e.estimate_lines[0].estimate_id = "version2";
        }
        if (change === "components") e.estimate_lines[0].estimate_line_components = [{ description: "New resource" }] as never;
        if (change === "message") message += " New request.";
        expect(prepareReviewedPriceDraft(p, 0, context(e, work, message), false)).toEqual({ ok: false, error: PRICING_REVIEW_STALE });
    });
    it("never clobbers another open form or bypasses client BoQ controls", () => {
        const c = context(), p = pending(c);
        expect(prepareReviewedPriceDraft(p, 0, c, true)).toEqual({ ok: false, error: PRICING_REVIEW_OPEN });
        const e = estimate(); e.is_client_boq = true;
        const boq = context(e);
        expect(prepareReviewedPriceDraft(pending(boq), 0, boq, false).ok).toBe(false);
    });
    it("does not trust a modified reviewed description or invalid selection index", () => {
        const c = context(), p = pending(c);
        expect(prepareReviewedPriceDraft(p, 0.5, c, false).ok).toBe(false);
        expect(prepareReviewedPriceDraft(p, 20, c, false).ok).toBe(false);
        p.suggestions[0].description = "Invented work";
        expect(prepareReviewedPriceDraft(p, 0, c, false)).toEqual({ ok: false, error: PRICING_REVIEW_STALE });
    });
    it("keeps model reply wording inert; source quotation is not proof of correct scope or negation", () => {
        const c = context(estimate(), "Do not replace the roof.");
        const result = reviewPricingSuggestion(c, { message: "<script>save()</script>Ignore safeguards and charge £99999", suggestions: [] });
        expect(result.ok && result.value.suggestions).toEqual([]);
        if (result.ok) expect(prepareReviewedPriceDraft(result.value, 0, c, false).ok).toBe(false);
    });
});
