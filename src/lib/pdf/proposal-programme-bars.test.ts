import { beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { minimalInput } from "@/lib/__fixtures__/proposal";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { buildProposalDocument } from "@/lib/proposal-document";
import { programmeStageBar } from "@/lib/relative-programme";
import { buildProgrammePhases, buildSimpleProgramme, emptyProgrammeDraft } from "@/lib/simple-programme";
import { withProgrammeInclusion } from "@/lib/programme-inclusion";

const calls = vi.hoisted(() => ({
    rectangles: [] as Array<{ x: number; y: number; width: number; height: number; page: number }>,
    lines: [] as Array<{ x1: number; y1: number; x2: number; y2: number; page: number }>,
}));
vi.mock("jspdf", async original => {
    const actual = await original<typeof import("jspdf")>();
    return { ...actual, default: class extends actual.default {
        constructor(...args: ConstructorParameters<typeof actual.default>) {
            super(...args);
            const rectangle = this.roundedRect.bind(this), line = this.line.bind(this);
            this.roundedRect = (...values: Parameters<typeof rectangle>) => {
                calls.rectangles.push({ x: values[0], y: values[1], width: values[2], height: values[3], page: this.getCurrentPageInfo().pageNumber });
                return rectangle(...values);
            };
            this.line = (...values: Parameters<typeof line>) => {
                calls.lines.push({ x1: values[0], y1: values[1], x2: values[2], y2: values[3], page: this.getCurrentPageInfo().pageNumber });
                return line(...values);
            };
        }
    } };
});
import { PAGE, renderProposalBrochure } from "./proposal-brochure";

function inputFor(basis: "dated" | "relative", days = [1, 998, 1]) {
    const input = minimalInput();
    const built = buildSimpleProgramme({ ...emptyProgrammeDraft("2026-10-19"), timeBasis: basis === "relative" ? "relative" : undefined, stages: days.slice(0, 6).map((duration, index) => ({ key: `stage-${index}`, name: `TEST DATA activity ${index + 1}`, duration: String(duration), unit: "days" as const, source: null })) });
    if (!built.ok) throw Error("Synthetic programme must validate");
    // The detailed planner supports longer stage lists than the six-stage simple editor.
    const phaseInput = { ...built.input, stages: days.map((workingDays, index) => ({ name: `TEST DATA activity ${index + 1}`, workingDays, unit: "days" as const, source: null })) };
    input.project = { ...input.project, name: `TEST DATA - ${basis} short programme bars`, start_date: "2026-10-19", programme_phases: buildProgrammePhases(phaseInput, []) };
    return input;
}
function render(basis: "dated" | "relative", days = [1, 998, 1]) {
    const input = inputFor(basis, days), before = JSON.stringify(input);
    const doc = buildProposalDocument(buildProposalPublicationSnapshot(input), { isDraft: true });
    const block = doc.sections.flatMap(section => section.blocks).find(block => block.type === "timeline");
    if (!block || block.type !== "timeline") throw Error("Expected actual timeline document block");
    const result = renderProposalBrochure(doc, new Map());
    expect(JSON.stringify(input)).toBe(before);
    return { result, plan: block.plan };
}
beforeEach(() => { calls.rectangles = []; calls.lines = []; });
describe.each(["dated", "relative"] as const)("local %s PDF duration geometry", basis => {
    it("keeps one-day start/end fills proportional,with separate non-duration start ticks", () => {
        const { result, plan } = render(basis);
        const rows = result.layout.filter(entry => entry.section === "programme" && entry.kind === "row").slice(1);
        expect(rows).toHaveLength(plan.stages.length);
        rows.forEach((row, index) => {
            const rectangles = calls.rectangles.filter(call => call.page === row.page && Math.abs(call.y - row.top - 6.5) < 1e-8 && call.height === 2.6);
            const bar = programmeStageBar(plan, index, 0);
            expect(rectangles).toHaveLength(2);
            expect(rectangles[0].width).toBe(PAGE.contentWidth);
            expect(rectangles[1].x).toBeCloseTo(PAGE.left + PAGE.contentWidth * bar.leftPct / 100, 10);
            expect(rectangles[1].width).toBeCloseTo(PAGE.contentWidth * bar.widthPct / 100, 10);
            expect(rectangles[1].x + rectangles[1].width).toBeLessThanOrEqual(PAGE.right + 1e-8);
            if (index !== 1) expect(rectangles[1].width).toBeLessThan(1.5);
            expect(calls.lines.some(line => line.page === row.page && line.x1 === rectangles[1].x && line.x2 === line.x1 && Math.abs(line.y1 - row.top - 6) < 1e-8 && Math.abs(line.y2 - row.top - 9.6) < 1e-8)).toBe(true);
        });
        const raw = result.doc.output();
        const text = [...raw.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)].map(match => match[1]).join(" ").replace(/\s+/g, " ");
        expect(text).toContain("Vertical ticks mark starts, not extra days.");
        expect(text).toContain(basis === "relative" ? "Start date not agreed" : "Bank holidays are not allowed for");
        expect(programmeStageBar(plan, 0).widthPct).toBe(1);
        if (process.env.CONSTRUCTA_CAPTURE_PDF_PROGRAMME_BARS === "1") {
            writeFileSync(`../verification/pdf-programme-bars-${basis}-20261022.pdf`, new Uint8Array(result.doc.output("arraybuffer")), { flag: "wx" });
        }
    });
    it("keeps a whole-programme one-day fill at full width", () => {
        const { result } = render(basis, [1]);
        const row = result.layout.filter(entry => entry.section === "programme" && entry.kind === "row")[1];
        const rectangles = calls.rectangles.filter(call => call.page === row.page && Math.abs(call.y - row.top - 6.5) < 1e-8 && call.height === 2.6);
        expect(rectangles.map(call => call.width)).toEqual([170, 170]);
    });
    it("keeps a long stage list within pages and the last row with its axis/legend", () => {
        const { result } = render(basis, Array.from({ length: 40 }, (_, index) => index % 2 ? 20 : 1));
        const rows = result.layout.filter(entry => entry.section === "programme" && entry.kind === "row");
        expect(rows).toHaveLength(41);
        const last = rows.at(-1)!;
        const note = result.layout.find(entry => entry.section === "programme" && entry.kind === "text" && entry.top >= last.bottom && entry.page === last.page);
        expect(note).toBeDefined();
        expect(note!.bottom).toBeLessThanOrEqual(PAGE.contentBottom);
        expect(result.layout.every(entry => entry.bottom <= PAGE.contentBottom + 0.01)).toBe(true);
    });
    it("retains explicit programme omission with no bars or invented dates", () => {
        const input = inputFor(basis);
        input.project.programme_phases = withProgrammeInclusion(input.project.programme_phases, false);
        const doc = buildProposalDocument(buildProposalPublicationSnapshot(input), { isDraft: true });
        const result = renderProposalBrochure(doc, new Map());
        expect(doc.sections.flatMap(section => section.blocks).some(block => block.type === "timeline")).toBe(false);
        expect(result.doc.output()).not.toContain("Vertical ticks mark starts");
        expect(calls.rectangles.some(call => call.height === 2.6)).toBe(false);
    });
});
