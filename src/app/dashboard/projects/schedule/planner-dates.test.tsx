import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlannerPhase } from "@/lib/planner-phases";

const actions = vi.hoisted(() => ({ write: vi.fn(), read: vi.fn() }));
vi.mock("./actions", () => ({
    updatePhasesAction: actions.write,
    saveProgrammePhasesAction: actions.write,
    getEstimatePhasesAction: actions.read,
}));
vi.mock("./programme-ai-update", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import ClientSchedulePage from "./client-page";

const phase = (name: string, startOffset: number, days = 5): PlannerPhase => ({
    name, startOffset, calculatedDays: days, manualDays: days, manhours: 0,
});
const phases = [phase("Demo", 0), phase("Install", 7), phase("Finishing works", 14)];

function render(stages = phases, start = "2026-10-19", daysPerWeek = 5) {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => String(daysPerWeek) });
    const before = JSON.stringify(stages);
    const html = renderToStaticMarkup(<ClientSchedulePage
        project={{ id: "date-check", name: "Example", start_date: start, programme_phases: stages }}
        projectId="date-check" estimate={null}
    />);
    expect(JSON.stringify(stages)).toBe(before);
    return html;
}
afterEach(() => {
    expect(actions.write).not.toHaveBeenCalled();
    expect(actions.read).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
});

describe("five-day detailed planner date presentation", () => {
    it("retains the existing invalid-date rejection", () => {
        expect(() => render(phases, "not-a-date")).toThrow(RangeError);
    });

    it("uses the local Monday in the actual rendered date input", () => {
        const input = /<input[^>]*type="date"[^>]*value="([^"]*)"/.exec(render());
        expect(input?.[1]).toBe("2026-10-19");
    });

    it("finishes the reported three-stage programme on 6 November, not the next Monday", () => {
        const html = render();
        expect(html).toContain("6 Nov 26");
        expect(html).not.toContain("9 Nov 26");
        expect(html).toContain("3 weeks");
        expect(html).toContain("15 working days / 19 calendar days");
        expect(html).not.toContain("4 calendar weeks");
    });

    it("labels every stage by its first and last working day", () => {
        const html = render();
        expect(html).toContain("19 Oct</span>");
        expect(html).toContain("19 Oct – 23 Oct");
        expect(html).toContain("26 Oct – 30 Oct");
        expect(html).toContain("2 Nov – 6 Nov");
    });

    it("does not call the four-column minimum viewport the length of a one-week job", () => {
        const html = render([phase("Works", 0)]);
        expect(html).toContain("23 Oct 26");
        expect(html).toContain("1 week");
        expect(html).toContain("5 working days / 5 calendar days");
        expect(html).not.toContain("4 calendar weeks");
    });

    it("uses actual working dates for a partial week", () => {
        const html = render([phase("Works", 0, 3)]);
        expect(html).toContain("21 Oct 26");
        expect(html).toContain("3 working days / 3 calendar days");
    });

    it("keeps gaps in the canonical programme duration", () => {
        const html = render([phase("First", 0), phase("Last", 14)]);
        expect(html).toContain("6 Nov 26");
        expect(html).toContain("15 working days / 19 calendar days");
    });

    it("handles a year boundary without adding the trailing weekend", () => {
        const html = render(phases, "2026-12-28");
        expect(html).toContain("15 Jan 27");
        expect(html).not.toContain("18 Jan 27");
    });

    it.each([4, 6, 7])("ignores an old browser-only %i-day override rather than diverging from the saved job", days => {
        const html = render(phases, "2026-10-19", days);
        expect(html).toContain("6 Nov 26");
        expect(html).toContain("15 working days / 19 calendar days");
    });

    it.each([[1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5, 6]].map(weekdays => ({ weekdays })))("uses the saved weekend pattern $weekdays and shows all seven calendar days without writes", ({ weekdays }) => {
        const html = renderToStaticMarkup(<ClientSchedulePage project={{ id: "weekend", name: "Example", start_date: "2026-10-16",
            programme_phases: [phase("Works", 0, 2)], programme_working_pattern: { version: 1, weekdays } }} projectId="weekend" estimate={null} />);
        expect(html).toContain('value="2026-10-16"');
        expect(html).toContain("16 Oct – 17 Oct");
        expect(html).toContain("2 working days / 2 calendar days");
        expect(html).toContain('aria-label="W1: 2026-10-12 to 2026-10-18"');
        for (const day of [0, 1, 2, 3, 4, 5, 6]) expect(html).toContain(`data-planner-calendar-day="${day}" data-working-day="${weekdays.includes(day) ? "true" : "false"}"`);
        expect(html).toContain("Bank holidays are not allowed for.");
        expect(html).not.toContain("prog_dpw_");
    });

    it("keeps a saved Wednesday start instead of moving it to the next Monday", () => {
        const html = renderToStaticMarkup(<ClientSchedulePage project={{ id: "midweek", name: "Example", start_date: "2026-10-21",
            programme_phases: [phase("Works", 0, 1)], programme_working_pattern: { version: 1, weekdays: [1, 2, 3, 4, 5] } }} projectId="midweek" estimate={null} />);
        expect(html).toContain('value="2026-10-21"');
        expect(html).toContain("21 Oct – 21 Oct");
        expect(html).toContain('aria-label="W1: 2026-10-19 to 2026-10-25"');
    });

    it("does not add the Friday axis lead twice when an explicit-calendar plan is incomplete", () => {
        const html = renderToStaticMarkup(<ClientSchedulePage project={{ id: "partial", name: "Example", start_date: "2026-10-16",
            programme_phases: [phase("Works", 0, 2), phase("Needs duration", 0, 0)],
            programme_working_pattern: { version: 1, weekdays: [1, 2, 3, 4, 5, 6] } }} projectId="partial" estimate={null} />);
        expect(html).toContain("19 Oct 26");
        expect(html).not.toContain("23 Oct 26");
        expect(html).toContain('value="Needs duration"');
    });

    it("keeps an undated stage visible instead of presenting a partial canonical plan", () => {
        const html = render([phase("Valid", 0), phase("Needs duration", 7, 0)]);
        expect(html).toContain('value="Needs duration"');
        expect(html).not.toContain("working days / ");
    });

    it("keeps a saved Sunday-only working week finishing on Sunday 25 October, not Saturday 17 October", () => {
        vi.stubGlobal("window", {});
        vi.stubGlobal("localStorage", { getItem: () => "6" });
        const saved = [phase("Works", 0, 2)], before = JSON.stringify(saved);
        const html = renderToStaticMarkup(<ClientSchedulePage project={{ id: "sunday-only", name: "Example", start_date: "2026-10-16",
            programme_phases: saved, programme_working_pattern: { version: 1, weekdays: [0] } }} projectId="sunday-only" estimate={null} />);
        expect(JSON.stringify(saved)).toBe(before);
        expect(html).toContain('value="2026-10-16"');
        expect(html).toContain("18 Oct – 25 Oct");
        expect(html).not.toContain("17 Oct");
        expect(html).toContain("2 weeks");
        expect(html).toContain("2 working days / 8 calendar days");
        expect(html).toContain('aria-label="W1: 2026-10-12 to 2026-10-18"');
        expect(html).toContain('aria-label="W2: 2026-10-19 to 2026-10-25"');
        expect([...html.matchAll(/data-planner-calendar-day="(\d)"/g)].slice(0, 7).map(match => Number(match[1]))).toEqual([1, 2, 3, 4, 5, 6, 0]);
        for (const day of [1, 2, 3, 4, 5, 6, 0]) expect(html).toContain(`data-planner-calendar-day="${day}" data-working-day="${day === 0 ? "true" : "false"}"`);
        expect(html).not.toContain("prog_dpw_");
    });
});
