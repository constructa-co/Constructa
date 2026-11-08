import { describe, expect, it } from "vitest";
import { briefContextFromProject, reviewBriefReply } from "./brief-conversation";
import { buildPlanningContext, reviewPlanningReply } from "./planning-conversation";
import { buildPricingReviewContext, pricingModelData } from "./pricing-review";
import { SITE_NOTES_HEADING } from "./guided-brief";
import type { Estimate } from "@/app/dashboard/projects/costs/types";

/**
 * A055 / A063 offline context coverage. These pin, with no provider and no paid
 * call, exactly which saved job details each assistant feature hands to the
 * model (the `context` the generator receives, which the transport sends as the
 * "Saved job data (JSON)" message). They are characterisation tests: where a
 * detail does NOT reach the assistant the test says so, so a gap is a recorded
 * fact rather than an assumption. See docs/delivery/2026-11-08/claude-batch2-handoff.md.
 */

const WORK = "Strip the kitchen, replace the floor and fit new units.";
const SITE = "Access through the side gate, park on the drive.";
const FULL_SCOPE = `${WORK}\n\n${SITE_NOTES_HEADING}\n${SITE}`;

const BRIEF_ROW = {
    id: "job-1", brief_scope: FULL_SCOPE, brief_trade_sections: ["Kitchen fitting", "Flooring"], client_type: "domestic",
    // Present on the saved row but not part of the brief fields the server selects: must never be sent.
    client_name: "Ms Patel", site_address: "1 High Street", postcode: "AB1 2CD", potential_value: 18000, start_date: "2026-11-02",
} as unknown as Parameters<typeof briefContextFromProject>[0];

const PLAN_ROW = {
    id: "job-1", name: "Rear extension", client_name: "Ms Patel", start_date: "2026-11-02",
    programme_phases: [{ name: "Groundworks", manualDays: 10, startOffset: 0 }, { name: "Kitchen fit", manualDays: 5, startOffset: 14 }],
};

const estimate = {
    id: "est-1", project_id: "job-1", is_active: true, is_client_boq: false, overhead_pct: 10, profit_pct: 15, risk_pct: 5, prelims_pct: 10,
    discount_pct: 0, total_cost: 12345,
    estimate_lines: [{
        id: "line-1", estimate_id: "est-1", description: "Fit kitchen units", trade_section: "Kitchen fitting", quantity: 12, unit: "nr",
        unit_rate: 321, line_total: 3852, pricing_mode: "simple", estimate_line_components: [],
    }],
} as unknown as Estimate;

describe("A055 Brief: what reaches the assistant", () => {
    const context = briefContextFromProject(BRIEF_ROW)!;

    it("sends the work description, the client type and the chosen trades", () => {
        expect(Object.keys(context).sort()).toEqual(["clientType", "job", "trades", "work"]);
        expect(context.work).toBe(WORK);
        expect(context.clientType).toBe("domestic");
        expect(context.trades).toEqual(["Kitchen fitting", "Flooring"]);
    });

    it("strips the site, access and assumption notes from the work text", () => {
        expect(JSON.stringify(context)).not.toContain("side gate");
        expect(JSON.stringify(context)).not.toContain(SITE_NOTES_HEADING);
    });

    it("does not send client name, address, postcode, value or dates even when the saved row holds them", () => {
        const sent = JSON.stringify(context);
        for (const secret of ["Ms Patel", "1 High Street", "AB1 2CD", "18000", "2026-11-02"]) expect(sent).not.toContain(secret);
    });

    it("sends no milestone, programme or procurement information (none belongs to the Brief context)", () => {
        const sent = JSON.stringify(context).toLowerCase();
        for (const word of ["milestone", "procure", "programme", "stage", "lead time"]) expect(sent).not.toContain(word);
    });

    it("lets the review quote the saved work, but drops a reply naming money or a date nobody gave", () => {
        expect(reviewBriefReply(context, ["what is missing?"], { message: "Check the floor.", facts: [{ start: 0, end: 11 }] }).ok).toBe(true);
        expect(reviewBriefReply(context, ["what is missing?"], { message: "Allow £4,000 for the floor." }).ok).toBe(false);
        expect(reviewBriefReply(context, ["what is missing?"], { message: "Start on 12 December." }).ok).toBe(false);
    });
});

describe("A055 pricing: what reaches the assistant", () => {
    const built = buildPricingReviewContext({ id: "job-1", brief_scope: FULL_SCOPE }, estimate, "price the units");
    if (!built.ok) throw new Error("fixture must build");
    const data = pricingModelData(built.value);

    it("sends only the work text, the contractor's message and each line's description and trade section", () => {
        expect(Object.keys(data).sort()).toEqual(["contractorMessage", "existingWork", "work"]);
        expect(data.work).toBe(WORK);
        expect(data.existingWork).toEqual([{ description: "Fit kitchen units", section: "Kitchen fitting" }]);
    });

    it("does not send quantities, units, rates, totals, margins, the revision or the site notes", () => {
        const sent = JSON.stringify(data);
        for (const hidden of ["3852", "321", "12345", "overhead", "profit", "revision", "side gate"]) expect(sent).not.toContain(hidden);
    });

    it("does NOT send the Brief's chosen trades: only trade sections on existing lines can reach it (recorded gap)", () => {
        expect(JSON.stringify(data)).not.toContain("Flooring");
        expect(Object.keys(data)).not.toContain("trades");
    });

    it("sends no milestone or procurement information (recorded gap)", () => {
        const sent = JSON.stringify(data).toLowerCase();
        for (const word of ["milestone", "procure", "lead time", "programme"]) expect(sent).not.toContain(word);
    });
});

describe("A063 planning: what reaches the assistant", () => {
    const context = buildPlanningContext(PLAN_ROW)!;

    it("sends job name, client name, start/finish/duration and each stage's name, dates and duration", () => {
        expect(Object.keys(context).sort()).toEqual(["basis", "duration", "finish", "job", "stages", "start"]);
        expect(context.job).toEqual({ id: "job-1", name: "Rear extension", client: "Ms Patel" });
        expect(context.stages.map(stage => stage.name)).toEqual(["Groundworks", "Kitchen fit"]);
        for (const stage of context.stages) expect(Object.keys(stage).sort()).toEqual(["duration", "from", "name", "to"]);
    });

    it("sends the client's name here although the Brief context withholds it (recorded inconsistency, intentional per the existing planning test)", () => {
        expect(JSON.stringify(context)).toContain("Ms Patel");
        expect(JSON.stringify(briefContextFromProject(BRIEF_ROW))).not.toContain("Ms Patel");
    });

    it("does NOT send the Brief work text or chosen trades, so planning cannot be grounded in the actual work (recorded gap)", () => {
        const sent = JSON.stringify(context);
        for (const absent of ["Strip the kitchen", "replace the floor", "Flooring", "Kitchen fitting", "trades"]) expect(sent).not.toContain(absent);
        expect(Object.keys(context)).not.toContain("work");
    });

    it("has no procurement or lead-time data in the saved programme: milestones are only stage names (recorded gap)", () => {
        const sent = JSON.stringify(context).toLowerCase();
        for (const word of ["procure", "lead", "supplier", "order", "milestone"]) expect(sent).not.toContain(word);
    });

    it("turns a procurement suggestion with no contractor-given timing into an open question, never an assumed lead time", () => {
        const result = reviewPlanningReply(context, ["we need to order the kitchen"], {
            message: "Order the kitchen ahead of Kitchen fit.", questions: [],
            suggestions: [{ topic: "procurement", title: "Order the kitchen", stage: "Kitchen fit", timing: null }],
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.suggestions[0].timing).toBeNull();
            expect(result.value.questions.join("\n")).toContain("What timing applies");
        }
    });

    it("drops a reply that invents a six-week lead time the contractor never gave, but accepts one they stated", () => {
        const reply = { message: "Kitchens usually take 6 weeks.", questions: [], suggestions: [] };
        expect(reviewPlanningReply(context, ["order the kitchen"], reply).ok).toBe(false);
        expect(reviewPlanningReply(context, ["the supplier says 6 weeks"], reply).ok).toBe(true);
    });

    it("gives a job with no saved programme an empty stage list, so there is nothing to attach a milestone to", () => {
        const none = buildPlanningContext({ id: "job-2", name: "New job", start_date: null, programme_phases: [] })!;
        expect(none).toMatchObject({ basis: "none", stages: [] });
    });
});
