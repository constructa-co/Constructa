import { describe, expect, it } from "vitest";
import { minimalInput, representativeInput, stressInput } from "@/lib/__fixtures__/proposal";
import { buildProposalDocument, documentImageUrls, type ProposalDocument } from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot, type BuildProposalPublicationInput } from "@/lib/proposal-publication";
import {
    PAGE,
    brochureFilename,
    pdfText,
    renderProposalBrochure,
    type BrochureResult,
    type ImageMap,
    type LayoutEntry,
} from "./proposal-brochure";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function images(doc: ProposalDocument, size = { width: 1200, height: 900 }): ImageMap {
    return new Map(documentImageUrls(doc).map((url) => [url, { data: PNG, format: "PNG" as const, ...size }]));
}

function render(input: BuildProposalPublicationInput, withImages = true): { doc: ProposalDocument; result: BrochureResult } {
    const doc = buildProposalDocument(buildProposalPublicationSnapshot(input));
    return { doc, result: renderProposalBrochure(doc, withImages ? images(doc) : new Map()) };
}

/** The rules every page must keep, whatever the content. */
function expectSoundLayout(result: BrochureResult) {
    const { layout, pages } = result;
    expect(result.doc.getNumberOfPages()).toBe(pages);

    // Nothing is drawn outside the printable area, so nothing is clipped.
    for (const entry of layout) {
        expect(entry.top, `${entry.kind} in ${entry.section} on page ${entry.page} starts above the page`).toBeGreaterThanOrEqual(PAGE.contentTop - 4.01);
        expect(entry.bottom, `${entry.kind} in ${entry.section} on page ${entry.page} runs off the page`).toBeLessThanOrEqual(PAGE.contentBottom + 0.01);
        expect(entry.bottom).toBeGreaterThanOrEqual(entry.top);
    }

    // No page is empty.
    for (let page = 1; page <= pages; page += 1) {
        expect(layout.some((entry) => entry.page === page), `page ${page} is empty`).toBe(true);
    }

    // A heading is never the last thing on a page: what it heads follows it there.
    layout.forEach((entry, index) => {
        if (entry.kind !== "section-heading" && entry.kind !== "subheading") return;
        const next = layout[index + 1];
        expect(next, `${entry.kind} in ${entry.section} has nothing after it`).toBeDefined();
        expect(next.page, `${entry.kind} in ${entry.section} is orphaned at the foot of page ${entry.page}`).toBe(entry.page);
    });

    // A photograph and its caption are on the same page.
    const groups = new Map<string, LayoutEntry[]>();
    layout.filter((entry) => entry.group).forEach((entry) => groups.set(entry.group!, [...(groups.get(entry.group!) ?? []), entry]));
    groups.forEach((entries) => expect(new Set(entries.map((entry) => entry.page)).size).toBe(1));

    // The response block is one unbroken block.
    expect(layout.filter((entry) => entry.kind === "response")).toHaveLength(1);
}

describe("representative proposal", () => {
    const { result } = render(representativeInput());

    it("keeps every layout rule", () => expectSoundLayout(result));

    it("runs to between four and six pages", () => {
        expect(result.pages).toBeGreaterThanOrEqual(4);
        expect(result.pages).toBeLessThanOrEqual(6);
    });

    it("draws every section, in order, then the response", () => {
        const order = result.layout.filter((entry) => entry.kind === "section-heading" || entry.kind === "response").map((entry) => entry.section);
        expect(order).toEqual(["cover", "about", "experience", "scope", "price", "programme", "terms", "closing", "response"]);
    });

    it("keeps the totals on the page with the last price line", () => {
        const totals = result.layout.find((entry) => entry.kind === "totals")!;
        const rows = result.layout.filter((entry) => entry.section === "price" && entry.kind === "row" && entry.bottom <= totals.top + 0.01 && entry.page === totals.page);
        expect(rows.length).toBeGreaterThan(0);
    });
});

describe("minimal proposal", () => {
    const { result } = render(minimalInput());

    it("keeps every layout rule", () => expectSoundLayout(result));

    it("is not padded out: missing sections take no pages", () => {
        expect(result.pages).toBeLessThanOrEqual(3);
        const sections = new Set(result.layout.map((entry) => entry.section));
        expect(sections.has("about")).toBe(false);
        expect(sections.has("experience")).toBe(false);
        expect(sections.has("closing")).toBe(false);
    });

    it("does not start a new page for each section when there is room", () => {
        const headings = result.layout.filter((entry) => entry.kind === "section-heading");
        expect(new Set(headings.map((entry) => entry.page)).size).toBeLessThan(headings.length);
    });
});

describe("page-break stress case", () => {
    const { doc, result } = render(stressInput());

    it("keeps every layout rule across many pages", () => {
        expectSoundLayout(result);
        expect(result.pages).toBeGreaterThan(12);
    });

    it("truncates nothing: every price line, term, photograph and stage is drawn", () => {
        const count = (section: string, kind: string) => result.layout.filter((entry) => entry.section === section && entry.kind === kind).length;
        // 70 price lines and 10 payment stages.
        expect(count("price", "row")).toBe(80);
        // 30 clause titles.
        expect(count("terms", "subheading")).toBe(30);
        // 6 site photographs, each with its caption.
        expect(count("scope", "photo")).toBe(6);
        expect(count("scope", "caption")).toBe(6);
        // The headline facts row and 6 stages.
        expect(count("programme", "row")).toBe(7);
        // 3 case studies with 2 + 3 + 3 photographs.
        expect(count("experience", "photo")).toBe(8);
        expect(result.skippedImages).toEqual([]);
        expect(doc.sections.find((section) => section.id === "terms")?.blocks[0]).toMatchObject({ type: "terms" });
    });

    it("repeats the group name when a price table carries over a page", () => {
        const pricePages = new Set(result.layout.filter((entry) => entry.section === "price" && entry.kind === "row").map((entry) => entry.page));
        expect(pricePages.size).toBeGreaterThan(1);
    });

    it("never leaves one line of a paragraph alone at the top of a page", () => {
        const lineHeights = [5.3, 6, 4.4];
        const single = result.layout.filter((entry) =>
            entry.kind === "text"
            && Math.abs(entry.top - PAGE.contentTop) < 0.01
            && lineHeights.some((height) => Math.abs(entry.bottom - entry.top - height) < 0.01));
        // A one-line paragraph may start a page; a carried-over last line may not.
        single.forEach((entry) => {
            const index = result.layout.indexOf(entry);
            const previous = result.layout[index - 1];
            const carriedOver = previous && previous.kind === "text" && previous.page === entry.page - 1
                && Math.abs(previous.bottom - PAGE.contentBottom) < 6 && previous.section === entry.section;
            if (carriedOver) expect(previous.bottom - previous.top).toBeLessThan(0);
        });
    });
});

describe("images", () => {
    it("leaves out a photograph that could not be loaded, with its caption, and reports it", () => {
        const { result } = render(representativeInput(), false);
        expectSoundLayout(result);
        expect(result.layout.filter((entry) => entry.kind === "photo" || entry.kind === "caption")).toEqual([]);
        expect(result.skippedImages).toEqual([
            "https://images.example.test/sample-street-1.jpg",
            "https://images.example.test/sample-street-2.jpg",
            "https://images.example.test/bathroom-before.jpg",
            "https://images.example.test/shower-corner.jpg",
        ]);
    });

    it("fits a tall photograph inside its cell instead of stretching the page", () => {
        const doc = buildProposalDocument(buildProposalPublicationSnapshot(representativeInput()));
        const result = renderProposalBrochure(doc, images(doc, { width: 600, height: 2400 }));
        expectSoundLayout(result);
        const tallest = Math.max(...result.layout.filter((entry) => entry.kind === "photo").map((entry) => entry.bottom - entry.top));
        expect(tallest).toBeLessThanOrEqual(((PAGE.contentWidth - 6) / 2) * 0.75 + 0.01);
    });
});

describe("content-aware pagination", () => {
    it.each([1, 3, 9, 18, 27, 40, 55])("stays sound as the scope grows to %i paragraphs", (paragraphs) => {
        const input = representativeInput();
        input.project.scope_text = Array.from({ length: paragraphs }, (_, i) => `Paragraph ${i + 1}. Remove the existing fittings, make good the walls and leave the room ready for the next trade.`).join("\n");
        expectSoundLayout(render(input).result);
    });

    it.each([1, 7, 13, 22, 31, 44])("stays sound with %i price lines", (lines) => {
        const input = representativeInput();
        input.estimate.estimate_lines = Array.from({ length: lines }, (_, i) => ({
            id: `l${i}`, trade_section: i % 2 ? "Finishes" : "Plumbing", description: `Line ${i + 1} supply and fix`, quantity: 1, unit: "item", line_total: 100 + i,
        }));
        expectSoundLayout(render(input).result);
    });

    it("grows by whole pages only when the content needs them", () => {
        const short = render(minimalInput()).result.pages;
        const typical = render(representativeInput()).result.pages;
        const long = render(stressInput()).result.pages;
        expect(short).toBeLessThan(typical);
        expect(typical).toBeLessThan(long);
    });

    it("is deterministic: the same snapshot lays out the same way every time", () => {
        expect(render(representativeInput()).result.layout).toEqual(render(representativeInput()).result.layout);
    });
});

describe("running header", () => {
    /** The header strings on a page, with where each starts and ends across the page. */
    function headerRuns(result: BrochureResult, pageNumber: number) {
        const internal = result.doc.internal as unknown as { pages: Array<string[] | undefined> };
        const page = (internal.pages[pageNumber] ?? []).join("\n");
        return [...page.matchAll(/BT\n\/F\d+ [\d.]+ Tf\n[\d.]+ TL\n[\d. ]+ rg\n[\d.]+ Tc\n([\d.]+) ([\d.]+) Td\n\(((?:\\.|[^\\)])*)\) Tj/g)]
            .map(([, x, y, text]) => ({ x: Number(x), y: Number(y), text }))
            .filter((run) => run.y > 800);
    }

    it("shortens a long job title so it never runs into the company name", () => {
        const { result, doc } = render(stressInput());
        result.doc.setFont("helvetica", "normal");
        result.doc.setFontSize(9);
        const runs = headerRuns(result, 2);
        expect(runs).toHaveLength(2);
        const [company, title] = runs;
        expect(company.text).toBe("Example Building Ltd");
        expect(title.text).toMatch(/\.\.\.  \|  22222222-V1$/);
        expect(doc.title.startsWith(title.text.split("...")[0])).toBe(true);
        // Points across the page: the company name ends before the title starts.
        const companyEnd = company.x + result.doc.getTextWidth(company.text) / 0.3528;
        expect(companyEnd + 10).toBeLessThan(title.x);
    });

    it("leaves a short title whole", () => {
        const { result } = render(representativeInput());
        expect(headerRuns(result, 2)[1].text).toBe("14 Example Road bathroom refit  |  22222222-V1");
    });
});

describe("text and file name", () => {
    it("replaces typographic characters the standard fonts cannot draw and keeps the pound sign", () => {
        expect(pdfText("“Quoted” – it’s £1,200… • done ☃")).toBe('"Quoted" - it\'s £1,200... - done');
    });

    it("names the file after the job and the version", () => {
        const doc = buildProposalDocument(buildProposalPublicationSnapshot(representativeInput()));
        expect(brochureFilename(doc)).toBe("14_Example_Road_bathroom_refit_Proposal_22222222-V1.pdf");
    });
});
