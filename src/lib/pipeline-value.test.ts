import { describe, expect, it } from "vitest";
import { kanbanFinancialsFromEstimates, openOpportunityValue, totalHomePipelineValue, totalKanbanPipelineValue } from "./pipeline-value";

describe("pipeline value helpers", () => {
    const projects = [
        { id: "p1", status: "Lead", potential_value: 10_000 },
        { id: "p2", status: "Won", potential_value: 5_000 },
        { id: "p3", status: "Lost", potential_value: 99_000 },
    ];
    const estimates = [{
        project_id: "p1",
        estimate_lines: [{ trade_section: "General", line_total: 4000 }],
        total_cost: 4000,
        overhead_pct: 0,
        profit_pct: 0,
        risk_pct: 0,
        prelims_pct: 0,
        discount_pct: 0,
    }];

    it("uses contract sum when an estimate exists", () => {
        expect(openOpportunityValue(projects[0], estimates[0])).toBe(4000);
        expect(openOpportunityValue(projects[0], estimates[0])).not.toBe(projects[0].potential_value);
    });

    it("falls back to potential_value without an estimate", () => {
        expect(openOpportunityValue({ id: "x", potential_value: 1234 }, undefined)).toBe(1234);
    });

    it("Home pipeline sums pipeline projects with estimate-aware values", () => {
        const total = totalHomePipelineValue(projects, estimates);
        expect(total).toBe(4000);
        expect(total).not.toBe(10_000);
    });

    it("kanban totals exclude Lost and Completed", () => {
        const financials = kanbanFinancialsFromEstimates(projects, estimates);
        expect(totalKanbanPipelineValue(projects, financials)).toBeGreaterThan(4000);
        expect(totalKanbanPipelineValue(projects, {})).toBe(15_000);
    });
});