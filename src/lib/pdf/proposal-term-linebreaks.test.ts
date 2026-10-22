import { beforeEach, describe, expect, it, vi } from "vitest";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import { buildProposalDocument } from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot } from "@/lib/proposal-publication";
import { STANDARD_PROPOSAL_TERMS } from "@/lib/proposal-terms";

const calls = vi.hoisted(() => ({
    texts: [] as Array<{ text: string; x: number; y: number; page: number }>,
}));
vi.mock("jspdf", async original => {
    const actual = await original<typeof import("jspdf")>();
    return { ...actual, default: class extends actual.default {
        constructor(...args: ConstructorParameters<typeof actual.default>) {
            super(...args);
            const text = this.text.bind(this);
            this.text = (...values: Parameters<typeof text>) => {
                const raw = values[0];
                calls.texts.push({
                    text: Array.isArray(raw) ? raw.join("\n") : String(raw),
                    x: Number(values[1]),
                    y: Number(values[2]),
                    page: this.getCurrentPageInfo().pageNumber,
                });
                return text(...values);
            };
        }
    } };
});
import jsPDF from "jspdf";
import { PAGE, pdfText, renderProposalBrochure, type BrochureResult } from "./proposal-brochure";

const TERM_WIDTH = (PAGE.contentWidth - 8) / 2;
const TERM_LINE = 4.4;
const STORED = "Monday to Friday, 8am to 5pm.\n\nNo work on bank holidays.\n    Quiet work only after 4pm.";

type Drawn = (typeof calls.texts)[number];

function draw(terms: { title: string; body: string }[]) {
    calls.texts = [];
    const input = representativeInput();
    input.resolvedTerms = terms;
    const doc = buildProposalDocument(buildProposalPublicationSnapshot(input));
    const result = renderProposalBrochure(doc);
    return { result, drawn: calls.texts.slice() };
}

function expectInsidePages(result: BrochureResult) {
    expect(result.doc.getNumberOfPages()).toBe(result.pages);
    for (const entry of result.layout) {
        expect(entry.top).toBeGreaterThanOrEqual(PAGE.contentTop - 4.01);
        expect(entry.bottom).toBeLessThanOrEqual(PAGE.contentBottom + 0.01);
        expect(entry.bottom).toBeGreaterThanOrEqual(entry.top);
    }
}

function lineWidth(text: string) {
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    return pdf.getTextWidth(text);
}

function at(drawn: Drawn[], text: string) {
    const found = drawn.find((line) => line.text === text);
    expect(found, text).toBeDefined();
    return found!;
}

beforeEach(() => { calls.texts = []; });

describe("term line breaks in the local PDF", () => {
    it("keeps the global sanitizer dropping a newline, and splits the term body before that", () => {
        expect(pdfText("bank holidays.\nQuiet work")).toBe("bank holidays.Quiet work");
        const { drawn } = draw([{ title: "Working hours", body: "Work stops on bank holidays.\nQuiet work continues indoors." }]);
        expect(drawn.some((line) => line.text.includes("holidays.Quiet"))).toBe(false);
        expect(at(drawn, "Work stops on bank holidays.").page).toBe(at(drawn, "Quiet work continues indoors.").page);
    });

    it.each(["\n", "\r\n", "\r"])("splits %j without joining the words on either side", (breakMark) => {
        const body = `Work stops on bank holidays.${breakMark}Quiet work continues indoors.`;
        const { drawn } = draw([{ title: "Working hours", body }]);
        const first = at(drawn, "Work stops on bank holidays.");
        const second = at(drawn, "Quiet work continues indoors.");
        expect(second.y - first.y).toBeCloseTo(TERM_LINE, 5);
        expect(drawn.some((line) => line.text.includes("holidays.Quiet"))).toBe(false);
    });

    it("keeps a blank line in the drawn height, and keeps indent and inner spaces", () => {
        const { drawn } = draw([{ title: "Working hours", body: `${STORED}\nQuiet  work remains spaced.` }]);
        const monday = at(drawn, "Monday to Friday, 8am to 5pm.");
        const holidays = at(drawn, "No work on bank holidays.");
        const quiet = at(drawn, "    Quiet work only after 4pm.");
        const spaced = at(drawn, "Quiet  work remains spaced.");
        expect(holidays.y - monday.y).toBeCloseTo(TERM_LINE * 2, 5);
        expect(quiet.y - holidays.y).toBeCloseTo(TERM_LINE, 5);
        expect(spaced.y - quiet.y).toBeCloseTo(TERM_LINE, 5);
        for (const line of [monday, holidays, quiet, spaced]) {
            expect(lineWidth(line.text)).toBeLessThanOrEqual(TERM_WIDTH + 0.01);
        }
        expect(drawn.some((line) => line.text.includes("holidays.Quiet") || line.text.includes("pm.No"))).toBe(false);
    });

    it("wraps a long line after a break inside the column", () => {
        const longLine = "Measured ".repeat(30).trim();
        const { drawn } = draw([{ title: "Long line", body: `Short line.\n${longLine}` }]);
        expect(at(drawn, "Short line.")).toBeDefined();
        expect(drawn.some((line) => line.text.includes("line.Measured"))).toBe(false);
        const measured = drawn.filter((line) => line.text.includes("Measured"));
        expect(measured.length).toBeGreaterThan(1);
        for (const line of measured) expect(lineWidth(line.text)).toBeLessThanOrEqual(TERM_WIDTH + 0.01);
    });

    it("draws ordinary terms as the existing whole-line wrap", () => {
        const { drawn } = draw(STANDARD_PROPOSAL_TERMS.map(({ title, body }) => ({ title, body })));
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        for (const clause of STANDARD_PROPOSAL_TERMS) {
            const expected = pdf.splitTextToSize(pdfText(clause.body), TERM_WIDTH) as string[];
            let from = 0;
            for (const line of expected) {
                const atIndex = drawn.findIndex((item, index) => index >= from && item.text === line);
                expect(atIndex, line).toBeGreaterThanOrEqual(0);
                from = atIndex + 1;
            }
        }
    });

    it("keeps many multiline terms inside the page", () => {
        const terms = Array.from({ length: 28 }, (_, index) => ({ title: `Hours ${index + 1}`, body: STORED }));
        const { result, drawn } = draw(terms);
        expectInsidePages(result);
        const termPages = new Set(result.layout.filter((entry) => entry.section === "terms").map((entry) => entry.page));
        expect(termPages.size).toBeGreaterThan(1);
        expect(drawn.filter((line) => line.text === "    Quiet work only after 4pm.")).toHaveLength(28);
        expect(drawn.some((line) => line.text.includes("holidays.Quiet") || line.text.includes("pm.No"))).toBe(false);
    });
});
