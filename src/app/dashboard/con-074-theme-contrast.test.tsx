import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "dark" }) }));
vi.mock("./project-board", () => ({ default: () => <div data-pipeline-board /> }));
vi.mock("./project-list", () => ({ default: () => <div data-pipeline-list /> }));
import DashboardClient from "./dashboard-client";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

function luminance(hex: string) {
    const values = hex.replace("#", "").match(/[a-f\d]{2}/gi)!.map((value) => parseInt(value, 16) / 255)
        .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
    const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
}

const TOKENS = {
    lightSelected: { text: "182c1b", bg: "c9efcf", field: "f5f8f2", muted: "526455" },
    darkSelected: { text: "f3fff2", bg: "3d6b45", field: "101812", muted: "b4c3b1" },
    lightTotalBar: { text: "f3fff2", bg: "203d2b" },
    darkTotalBar: { text: "f3fff2", bg: "1e3428" },
} as const;

describe("CON-074 theme contrast — selected pills and estimate total bar", () => {
    it("exposes chooser and total-bar tokens in the shared CSS modules", () => {
        const chooser = read("src/components/project-chooser.module.css");
        const estimating = read("src/components/estimating.module.css");
        expect(chooser).toContain("--chooser-selected-bg");
        expect(chooser).toContain("--chooser-selected-text");
        expect(chooser).toContain(".viewButton[data-selected=\"true\"]");
        expect(estimating).toContain("--price-totalbar-bg");
        expect(estimating).toContain("--price-totalbar-text");
        expect(estimating).toMatch(/\.totalDock[\s\S]*var\(--price-totalbar-bg\)/);
        expect(estimating).toMatch(/\.root\[data-theme="dark"\][\s\S]*--price-totalbar-bg:\s*#1e3428/);
    });

    it("renders pipeline workspace with data-dark=\"true\" so module dark tokens apply", () => {
        const html = renderToStaticMarkup(
            <DashboardClient
                projects={[{ id: "p1", name: "Demo", client_name: "Client", status: "Lead" }]}
                financials={{ p1: 1000 }}
                companyName="Example"
                metrics={{
                    totalPipelineValue: 0,
                    proposalsSent: 0,
                    wonThisMonth: 0,
                    activeJobs: 0,
                    winRate: 0,
                    winRateSampleSize: 0,
                    totalRevenueSigned: 0,
                }}
            />,
        );
        expect(html).toContain('data-dark="true"');
        expect(html).toMatch(/This Month[\s\S]*data-selected="true"|data-selected="true"[\s\S]*This Month/);
        expect(html).toMatch(/List[\s\S]*data-selected="true"|data-selected="true"[\s\S]*List/);
        expect(html).toMatch(/viewButton/);
    });

    it.each([
        ["light selected text on selected bg", TOKENS.lightSelected.text, TOKENS.lightSelected.bg, 4.5],
        ["light selected text vs field (unselected legibility)", TOKENS.lightSelected.text, TOKENS.lightSelected.field, 4.5],
        ["dark selected text on selected bg", TOKENS.darkSelected.text, TOKENS.darkSelected.bg, 4.5],
        ["dark unselected label on field", TOKENS.darkSelected.muted, TOKENS.darkSelected.field, 4.5],
        ["light unselected label on field", TOKENS.lightSelected.muted, TOKENS.lightSelected.field, 4.5],
        ["light total bar", TOKENS.lightTotalBar.text, TOKENS.lightTotalBar.bg, 4.5],
        ["dark total bar (not mint accent)", TOKENS.darkTotalBar.text, TOKENS.darkTotalBar.bg, 4.5],
    ] as const)("WCAG math — %s", (_label, fg, bg, minRatio) => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(minRatio);
    });

    it("documents why dark total bar must not reuse the mint control accent", () => {
        expect(TOKENS.darkTotalBar.bg).not.toBe("c9efcf");
        expect(contrastRatio(TOKENS.darkTotalBar.text, "c9efcf")).toBeLessThan(4.5);
        expect(contrastRatio(TOKENS.darkTotalBar.text, TOKENS.darkTotalBar.bg)).toBeGreaterThanOrEqual(4.5);
    });
});