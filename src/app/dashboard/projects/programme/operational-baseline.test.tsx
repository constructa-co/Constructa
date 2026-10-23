import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { computeProgrammePlan } from "@/lib/programme-plan";

const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, save: vi.fn(), refresh: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useMemo: (fn: () => unknown) => fn(),
    useTransition: () => [false, (fn: () => unknown) => fn()],
    useState: (initial: unknown) => { const i = hooks.cursor++; if (!(i in hooks.slots)) hooks.slots[i] = typeof initial === "function" ? initial() : initial;
        return [hooks.slots[i], (next: unknown) => { hooks.slots[i] = typeof next === "function" ? next(hooks.slots[i]) : next; }]; },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: hooks.refresh }) }));
vi.mock("./actions", () => ({ saveAsBuiltPhasesAction: hooks.save }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import ProgrammeClient from "./programme-client";

type Props = Parameters<typeof ProgrammeClient>[0];
type Phase = Props["initialPhases"][number];
type Element = ReactElement<Record<string, unknown>>;
const phase = (name: string, startOffset: number, days = 5): Phase => ({ name, startOffset, calculatedDays: days, manualDays: days, manhours: 40 });
const example = () => [phase("Demo", 0), phase("Install", 7), phase("Finishing works", 14)];
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element; return [node, ...nodes(node.props.children)];
}
function setup(phases = example(), startDate: string | null = "2026-10-19") {
    const props: Props = { projectId: "job", projectName: "Kitchen", initialPhases: phases, startDate };
    const view = () => { hooks.cursor = 0; return ProgrammeClient(props); };
    return { view, bars: () => nodes(view()).filter(n => typeof n.props.title === "string" && n.props.title.startsWith("Baseline:")), html: () => renderToStaticMarkup(view()) };
}
beforeEach(() => {
    hooks.slots = []; hooks.cursor = 0; hooks.save.mockReset(); hooks.refresh.mockReset(); hooks.save.mockResolvedValue(undefined);
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T10:00:00+04:00"));
});
afterEach(() => { vi.useRealTimers(); });

describe("operational baseline uses the saved proposal working-day dates", () => {
    it("matches proposal finish6November rather than calendar addition7November with no opening write", () => {
        const phases = example(), before = JSON.stringify(phases), app = setup(phases), html = app.html();
        expect(app.bars().map(n => n.props.title)).toEqual([
            "Baseline: 19 Oct 26 \u2192 23 Oct 26 (5d)", "Baseline: 26 Oct 26 \u2192 30 Oct 26 (5d)", "Baseline: 2 Nov 26 \u2192 6 Nov 26 (5d)",
        ]);
        expect(computeProgrammePlan("2026-10-19", phases)?.end_date).toBe("2026-11-06");
        expect(html).toContain("6 Nov 26"); expect(html).not.toContain("7 Nov 26");
        expect(html).toContain("Baseline matches the saved proposal programme");
        expect(JSON.stringify(phases)).toBe(before); expect(hooks.save).not.toHaveBeenCalled();
    });
    it.each([
        ["2026-10-19", 0, 1, "19 Oct 26"], ["2026-10-19", 2, 3, "23 Oct 26"],
        ["2026-10-21", 0, 5, "27 Oct 26"], ["2026-10-18", 0, 5, "23 Oct 26"],
        ["2026-12-28", 14, 5, "15 Jan 27"],
    ])("uses canonical inclusive dates for start%s offset%s length%s", (start, offset, days, finish) => {
        const bar = setup([phase("Work", Number(offset), Number(days))], String(start)).bars()[0];
        expect(String(bar.props.title)).toContain(`\u2192 ${finish} (`); expect(hooks.save).not.toHaveBeenCalled();
    });
    it("preserves source order, overlap and gaps rather than auto-sequencing or editing phases", () => {
        const phases = [phase("Later", 14, 2), phase("Early", 0, 5), phase("Overlap", 1, 5)], app = setup(phases);
        expect(app.bars().map(n => n.props.title)).toEqual([
            "Baseline: 2 Nov 26 \u2192 3 Nov 26 (2d)", "Baseline: 19 Oct 26 \u2192 23 Oct 26 (5d)", "Baseline: 20 Oct 26 \u2192 26 Oct 26 (5d)",
        ]); expect(hooks.save).not.toHaveBeenCalled();
    });
    it("keeps explicit actual/revised dates and calendar-day variance arithmetic, changing only baseline dates", () => {
        const phases = [{ ...phase("Work", 0), actual_start_date: "2026-10-20", actual_finish_date: "2026-10-27", revised_planned_finish: "2026-10-26", pct_complete: 100, delay_reason: "Weather" }];
        const app = setup(phases), html = app.html();
        expect(app.bars()[0].props.title).toBe("Baseline: 19 Oct 26 \u2192 23 Oct 26 (5d)");
        expect(html).toContain("Revised planned finish: 26 Oct 26"); expect(html).toContain("Actual: 20 Oct 26 \u2192 27 Oct 26");
        expect(html).toContain("+1d late"); expect(html).toContain("Weather"); expect(hooks.save).not.toHaveBeenCalled();
    });
    it("compares an unrevised actual finish to the corrected baseline rather than the old calendar finish", () => {
        const html = setup([{ ...phase("Work", 0), actual_finish_date: "2026-10-24", pct_complete: 100 }]).html();
        expect(html).toContain("+1d late"); expect(html).not.toContain("1d early"); expect(hooks.save).not.toHaveBeenCalled();
    });
    it("retains the existing elapsed/progress forecast formula against the corrected planned finish", () => {
        vi.setSystemTime(new Date("2026-10-22T00:00:00+04:00"));
        const html = setup([{ ...phase("Work", 0), actual_start_date: "2026-10-20", pct_complete: 50 }]).html();
        expect(html).toContain("+1d late"); expect(hooks.save).not.toHaveBeenCalled();
    });
    it("does not use a partial canonical result for invalid working lengths or offsets", () => {
        const app = setup([phase("Valid", 0), phase("Missing length", 7, 0)]);
        expect(app.bars()[0].props.title).toBe("Baseline: 19 Oct 26 \u2192 24 Oct 26 (5d)");
        expect(app.html()).not.toContain("Baseline matches the saved proposal programme");
        hooks.slots = [];
        expect(setup([phase("Legacy offset", -1)]).html()).not.toContain("Baseline matches the saved proposal programme");
        expect(hooks.save).not.toHaveBeenCalled();
    });
    it("does not select a new dated baseline for missing start or empty phases", () => {
        expect(setup([phase("Work", 0)], null).html()).not.toContain("Baseline matches the saved proposal programme");
        hooks.slots = []; expect(setup([]).html()).toContain("No programme phases found"); expect(hooks.save).not.toHaveBeenCalled();
    });
    it("keeps the existing edit/save payload without adding derived baseline or calendar fields", async () => {
        const phases = [{ ...phase("Work", 0), pct_complete: 25, revised_planned_finish: "2026-10-26", delay_reason: "Weather", delay_notes: "Own note", color: "emerald" }], app = setup(phases);
        const edit = nodes(app.view()).find(n => n.type === "button" && nodes(n).length > 1)!;
        (edit.props.onClick as () => void)();
        const input = nodes(app.view()).find(n => n.props.type === "date")!;
        (input.props.onChange as (e: unknown) => void)({ target: { value: "2026-10-20" } });
        const form = nodes(app.view()).find(n => n.type === "form")!;
        (form.props.onSubmit as (e: unknown) => void)({ preventDefault: vi.fn() });
        await Promise.resolve(); await Promise.resolve();
        expect(hooks.save).toHaveBeenCalledExactlyOnceWith("job", [{ ...phases[0], actual_start_date: "2026-10-20", actual_finish_date: undefined }]);
    });
});
