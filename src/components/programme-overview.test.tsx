import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { computeProgrammePlan, formatDateRange, stageBar } from "@/lib/programme-plan";
import ProgrammeOverview from "./programme-overview";

const phases = [{ name: "Strip out", manualDays: 5, startOffset: 0 }, { name: "Install", manualDays: 5, startOffset: 7 }, { name: "Finish", manualDays: 5, startOffset: 14 }];
const plan = computeProgrammePlan("2026-10-19", phases)!;
describe("simple programme overview", () => {
    it.each([false, true])("renders the canonical stages as a labelled shared-axis visual, dark=%s", isDark => {
        const before = JSON.stringify(plan);
        const html = renderToStaticMarkup(<ProgrammeOverview plan={plan} isDark={isDark} />);
        expect(html).toContain('data-programme-overview');
        expect(html).toContain('aria-label="Programme activities"');
        expect(html.match(/data-overview-stage=/g)).toHaveLength(3);
        for (const stage of plan.stages) {
            expect(html).toContain(stage.name);
            expect(html).toContain(formatDateRange(stage.start_date, stage.end_date));
            const bar = stageBar(plan, stage);
            expect(html).toContain(`inset-inline-start:${bar.leftPct}%;width:${bar.widthPct}%`);
        }
        expect(html).toContain("3 weeks"); expect(html).toContain("6 Nov 2026");
        expect(html).not.toMatch(/bg-blue|Critical path|Baseline|Final inspection/);
        expect(JSON.stringify(plan)).toBe(before);
    });

    it("has no invented programme activity or dependency when one named activity was saved", () => {
        const one = computeProgrammePlan("2026-10-19", [{ name: "Replace door", manualDays: 1, startOffset: 0 }])!;
        const html = renderToStaticMarkup(<ProgrammeOverview plan={one} isDark={false} />);
        expect(html.match(/data-overview-stage=/g)).toHaveLength(1);
        expect(html).toContain("Replace door"); expect(html).toContain("1 working day");
        expect(html).toContain('inset-inline-start:0%;width:100%');
        expect(html).not.toContain("Final inspection"); expect(html).not.toContain("<button");
    });

    it("keeps actual overlapping calendar positions and escaped contractor labels", () => {
        const overlap = computeProgrammePlan("2026-10-19", [{ name: '<script>alert("x")</script>', manualDays: 10, startOffset: 0 }, { name: "Second crew", manualDays: 2, startOffset: 2 }])!;
        const html = renderToStaticMarkup(<ProgrammeOverview plan={overlap} isDark={true} />);
        expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>");
        const bar = stageBar(overlap, overlap.stages[1]);
        expect(html).toContain(`inset-inline-start:${bar.leftPct}%;width:${bar.widthPct}%`);
        expect(html).not.toContain("dependsOn");
    });
});
