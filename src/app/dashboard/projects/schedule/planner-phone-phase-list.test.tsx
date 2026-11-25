import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
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

function render(stages = phases, start = "2026-10-19") {
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", { getItem: () => "5" });
    return renderToStaticMarkup(<ClientSchedulePage
        project={{ id: "phone-list", name: "Example", start_date: start, programme_phases: stages }}
        projectId="phone-list" estimate={null} plannerDraftViewerScope="viewer-test"
    />);
}

function phoneStageDates(html: string) {
    return [...html.matchAll(/data-planner-phone-phase-dates[^>]*>([^<]+(?:<[^/][^>]*>[^<]*)*)/g)]
        .map(match => match[1].replace(/<[^>]+>/g, "").trim());
}

function desktopInlineDates(html: string) {
    return [...html.matchAll(
        /<time[^>]*>(\d{1,2} \w{3})<\/time>\s*<span aria-hidden="true">–<\/span>\s*<time[^>]*>(\d{1,2} \w{3})<\/time>/g,
    )].map(match => `${match[1]} – ${match[2]}`);
}

afterEach(() => {
    expect(actions.write).not.toHaveBeenCalled();
    expect(actions.read).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
});

describe("CON-043 phone programme phase list", () => {
    it("shows a bounded list only below lg and hides the Gantt track until lg", () => {
        const html = render();
        expect(html).toContain('data-planner-phone-phase-list');
        expect(html).toMatch(/data-planner-phone-phase-list[^>]*class="[^"]*lg:hidden/);
        expect(html).toMatch(/class="hidden lg:block flex-1 relative/);
        expect(html).toMatch(/hidden lg:flex flex-1/);
        expect(html).toMatch(/data-planner-editing-table-scroll[^>]*class="[^"]*overflow-x-auto/);
        expect(html).toMatch(/min-w-\[444px\][^"]*lg:min-w-\[900px\]/);
    });

    it("matches the same canonical stage dates and working durations as the desktop inline labels", () => {
        const html = render();
        expect(phoneStageDates(html)).toEqual(["19 Oct – 23 Oct", "26 Oct – 30 Oct", "2 Nov – 6 Nov"]);
        expect(desktopInlineDates(html)).toEqual(phoneStageDates(html));
        const durations = [...html.matchAll(/data-planner-phone-phase-duration[^>]*>([^<]+)</g)].map(m => m[1].trim());
        expect(durations).toEqual(["5 working days (1 week)", "5 working days (1 week)", "5 working days (1 week)"]);
    });

    it("omits the phone list when the displayed plan is incomplete", () => {
        const html = render([phase("Valid", 0), phase("Needs duration", 7, 0)]);
        expect(html).not.toContain("data-planner-phone-phase-list");
        expect(html).toContain('value="Needs duration"');
    });

    it("uses source breakpoints at 360, 390 and 430 via Tailwind lg (1024px), not new viewport logic", () => {
        const source = readFileSync(path.join(process.cwd(), "src/app/dashboard/projects/schedule/client-page.tsx"), "utf8");
        for (const width of [360, 390, 430]) {
            expect(source).not.toContain(String(width));
        }
        expect(source).toContain("lg:hidden");
        expect(source).toContain("hidden lg:block");
        expect(source).not.toMatch(/matchMedia|innerWidth|useMediaQuery/);
    });
});