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

    it.each([4, 6, 7])("leaves the existing %i-day planner calculation unchanged", days => {
        const html = render(phases, "2026-10-19", days);
        expect(html).toContain(days === 4 ? "16 Nov 26" : days === 6 ? "9 Nov 26" : "7 Nov 26");
        expect(html).not.toContain("15 working days / 19 calendar days");
    });

    it("keeps an undated stage visible instead of presenting a partial canonical plan", () => {
        const html = render([phase("Valid", 0), phase("Needs duration", 7, 0)]);
        expect(html).toContain('value="Needs duration"');
        expect(html).not.toContain("working days / ");
    });
});
