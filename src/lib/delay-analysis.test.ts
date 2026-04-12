import { describe, it, expect } from "vitest";
import {
    analyseAsPlannedVsAsBuilt,
    analyseTimeImpact,
    analyseCollapsedAsBuilt,
    analyseWindows,
    type DelayPhase,
    type DelayEvent,
} from "./delay-analysis";

// ── Test fixtures ──────────────────────────────────────────────────────────
// 4-phase programme: Groundworks → Structure → M&E → Finishes
// Total baseline: 56 days (8 weeks)
// Project start: 2026-01-05 (Monday)

const PROJECT_START = "2026-01-05";

const PHASES: DelayPhase[] = [
    {
        name: "Groundworks",
        calculatedDays: 14,
        startOffset: 0,
        actual_start_date: "2026-01-05",
        actual_finish_date: "2026-01-26", // 7 days late (was due 19 Jan)
        delay_reason: "Weather",
        delay_category: "Neutral",
    },
    {
        name: "Structure",
        calculatedDays: 14,
        startOffset: 14,
        actual_start_date: "2026-01-26",
        actual_finish_date: "2026-02-13", // 5 days late (was due 2 Feb, started 7d late)
        delay_reason: "Client Variation",
        delay_category: "Employer",
    },
    {
        name: "M&E First Fix",
        calculatedDays: 14,
        startOffset: 28,
        actual_start_date: "2026-02-13",
        actual_finish_date: "2026-02-27", // on time from its actual start but 14 days late vs baseline
        delay_reason: null,
        delay_category: null,
    },
    {
        name: "Finishes",
        calculatedDays: 14,
        startOffset: 42,
        actual_start_date: "2026-02-27",
        actual_finish_date: "2026-03-16", // 3 days late from its new start
        delay_reason: "Material Shortage",
        delay_category: "Contractor",
    },
];

const EVENTS: DelayEvent[] = [
    {
        id: "ev-1",
        title: "Adverse weather — 7 days standing time",
        reference: "CE-001",
        date_raised: "2026-01-20",
        event_type: "compensation_event",
        status: "agreed",
        assessed_time: 7,
        agreed_time: 7,
    },
    {
        id: "ev-2",
        title: "Client instructed additional steelwork",
        reference: "CE-002",
        date_raised: "2026-02-05",
        event_type: "compensation_event",
        status: "agreed",
        assessed_time: 5,
        agreed_time: 5,
    },
];

// ── Methodology 1: As-Planned vs As-Built ──────────────────────────────────

describe("analyseAsPlannedVsAsBuilt", () => {
    it("computes delay per phase", () => {
        const result = analyseAsPlannedVsAsBuilt(PHASES, PROJECT_START);
        expect(result.methodology).toBe("as_planned_vs_as_built");
        expect(result.phases).toHaveLength(4);

        // Groundworks: planned finish 18 Jan (5 Jan + 14d), actual 26 Jan = 8 days late
        expect(result.phases[0].delayDays).toBe(8);
        // Structure: planned finish 1 Feb (5 Jan + 28d), actual 13 Feb = 12 days late
        expect(result.phases[1].delayDays).toBe(12);
    });

    it("computes total project delay", () => {
        const result = analyseAsPlannedVsAsBuilt(PHASES, PROJECT_START);
        // Baseline end: 5 Jan + 56 days = 1 Mar (exclusive), Actual end: 16 Mar
        // Total delay: 15 days
        expect(result.totalProjectDelay).toBe(15);
    });

    it("groups delay by category", () => {
        const result = analyseAsPlannedVsAsBuilt(PHASES, PROJECT_START);
        expect(result.delaySummaryByCategory["Neutral"]).toBe(8);
        expect(result.delaySummaryByCategory["Employer"]).toBe(12);
    });

    it("returns zero delay for phases without actual dates", () => {
        const noActuals: DelayPhase[] = [{
            name: "Test", calculatedDays: 10, startOffset: 0,
        }];
        const result = analyseAsPlannedVsAsBuilt(noActuals, PROJECT_START);
        expect(result.phases[0].delayDays).toBe(0);
    });
});

// ── Methodology 2: Time Impact Analysis ────────────────────────────────────

describe("analyseTimeImpact", () => {
    it("computes cumulative impact from events", () => {
        const result = analyseTimeImpact(PHASES, EVENTS, PROJECT_START);
        expect(result.methodology).toBe("time_impact");
        expect(result.events).toHaveLength(2);
        expect(result.cumulativeImpact).toBe(12); // 7 + 5
    });

    it("shows baseline vs adjusted completion", () => {
        const result = analyseTimeImpact(PHASES, EVENTS, PROJECT_START);
        expect(result.baselineCompletion).toBe("2026-03-01"); // 5 Jan + 55 days (last phase ends day 56 from start = 1 Mar)
        expect(result.adjustedCompletion).toBe("2026-03-12"); // 1 Mar + 12 days
    });

    it("handles events with no time impact gracefully", () => {
        const noImpact: DelayEvent[] = [
            { id: "x", title: "No impact", date_raised: "2026-01-10", event_type: "early_warning", status: "open" },
        ];
        const result = analyseTimeImpact(PHASES, noImpact, PROJECT_START);
        expect(result.events).toHaveLength(0);
        expect(result.cumulativeImpact).toBe(0);
    });
});

// ── Methodology 3: Collapsed As-Built ──────────────────────────────────────

describe("analyseCollapsedAsBuilt", () => {
    it("recovers days by removing events in reverse order", () => {
        const result = analyseCollapsedAsBuilt(PHASES, EVENTS, PROJECT_START);
        expect(result.methodology).toBe("collapsed_as_built");
        expect(result.steps).toHaveLength(2);
        expect(result.totalRecoverableDays).toBe(12); // 7 + 5

        // First step removes CE-002 (latest event)
        expect(result.steps[0].daysRecovered).toBe(5);
        // Second step removes CE-001
        expect(result.steps[1].daysRecovered).toBe(7);
    });

    it("as-built completion matches actual project end", () => {
        const result = analyseCollapsedAsBuilt(PHASES, EVENTS, PROJECT_START);
        expect(result.asBuiltCompletion).toBe("2026-03-16"); // latest actual finish
    });
});

// ── Methodology 4: Windows Analysis ────────────��───────────────────────────

describe("analyseWindows", () => {
    it("divides project into windows of given size", () => {
        const result = analyseWindows(PHASES, EVENTS, PROJECT_START, 28);
        expect(result.methodology).toBe("windows");
        expect(result.windowSizeDays).toBe(28);
        expect(result.windows.length).toBeGreaterThanOrEqual(2);
    });

    it("assigns events to the correct window", () => {
        const result = analyseWindows(PHASES, EVENTS, PROJECT_START, 28);
        // CE-001 raised 20 Jan → Window 1 (5 Jan – 2 Feb)
        expect(result.windows[0].events.some(e => e.includes("CE-001"))).toBe(true);
        // CE-002 raised 5 Feb → Window 2 (2 Feb – 2 Mar)
        expect(result.windows[1].events.some(e => e.includes("CE-002"))).toBe(true);
    });

    it("computes total delay across all windows", () => {
        const result = analyseWindows(PHASES, EVENTS, PROJECT_START, 28);
        expect(result.totalDelay).toBeGreaterThanOrEqual(0);
    });
});
