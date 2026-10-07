import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import ProposalDocumentView from "@/components/proposal/proposal-document-view";
import { minimalInput, representativeInput, stressInput } from "./__fixtures__/proposal";
import { PROGRAMME_BASIS_NOTE, formatPlanDate } from "./programme-plan";
import { renderProposalBrochure, type ImageMap } from "./pdf/proposal-brochure";
import {
    buildProposalDocument,
    documentImageUrls,
    listItems,
    paymentRows,
    proposalReference,
    textBlocks,
    vatLines,
    vatNote,
    type DocBlock,
    type ProposalDocument,
} from "./proposal-document";
import { buildProposalPublicationSnapshot, type ProposalPublicationSnapshot } from "./proposal-publication";
import { responseWording } from "./proposal-response";

const snapshot = buildProposalPublicationSnapshot(representativeInput());
const document = buildProposalDocument(snapshot, { snapshotHash: "ab".repeat(32) });

function stubImages(doc: ProposalDocument): ImageMap {
    // A 1x1 PNG, reported at a photograph's proportions.
    const data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    return new Map(documentImageUrls(doc).map((url) => [url, { data, format: "PNG" as const, width: 1200, height: 900 }]));
}

/** Every string the PDF draws, in order. */
function pdfStrings(doc: ProposalDocument): string {
    const result = renderProposalBrochure(doc, stubImages(doc));
    const drawn: string[] = [];
    const internal = result.doc.internal as unknown as { pages: Array<string[] | undefined> };
    internal.pages.forEach((page) => (page ?? []).forEach((operation) => {
        for (const match of String(operation).matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
            drawn.push(match[1].replace(/\\([()\\])/g, "$1"));
        }
    }));
    return drawn.join("\n");
}

function htmlText(doc: ProposalDocument): string {
    return renderToStaticMarkup(createElement(ProposalDocumentView, { doc }))
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
        .replace(/\s+/g, " ");
}

const blocksOf = (doc: ProposalDocument, id: string) => doc.sections.find((section) => section.id === id)?.blocks ?? [];
const blockOf = <T extends DocBlock["type"]>(doc: ProposalDocument, id: string, type: T) =>
    blocksOf(doc, id).find((block): block is Extract<DocBlock, { type: T }> => block.type === type);

describe("document order and content", () => {
    it("reads in the order the client receives it", () => {
        expect(document.sections.map((section) => section.id)).toEqual([
            "about", "experience", "scope", "price", "programme", "terms", "closing",
        ]);
        expect(document.title).toBe("14 Example Road bathroom refit");
        expect(document.reference).toBe("22222222-V1");
        expect(document.reference).toBe(proposalReference(snapshot));
        expect(document.issued).toBe("5 October 2026");
        expect(document.validUntil).toBe("4 November 2026");
    });

    it("leaves out every section with nothing saved behind it", () => {
        const minimal = buildProposalDocument(buildProposalPublicationSnapshot(minimalInput()));
        expect(minimal.sections.map((section) => section.id)).toEqual(["scope", "price", "programme", "terms"]);
        expect(minimal.introduction).toEqual([]);
        expect(documentImageUrls(minimal)).toEqual([]);
    });

    it("keeps the contractor's text as written: bullets stay bullets, lines stay lines", () => {
        expect(textBlocks("Intro line\n- one\n* two\n• three\nOutro")).toEqual([
            { type: "paragraphs", paragraphs: ["Intro line"] },
            { type: "bullets", items: ["one", "two", "three"] },
            { type: "paragraphs", paragraphs: ["Outro"] },
        ]);
        expect(listItems("- Planning fees\n\n  Skips  ")).toEqual(["Planning fees", "Skips"]);
        expect(textBlocks("  \n ")).toEqual([]);
    });

    it("heads the document with the price, start, finish and duration", () => {
        expect(document.keyFacts).toEqual([
            { label: "Price including VAT", value: "£9,062.46" },
            { label: "Start on site", value: "2 Nov 2026" },
            { label: "Finish", value: "20 Nov 2026" },
            { label: "Duration", value: "3 weeks" },
        ]);
    });
});

describe("price", () => {
    it("states the totals and VAT once, from the snapshot", () => {
        expect(vatLines(snapshot.commercial)).toEqual([
            { label: "Total before VAT", value: "£7,552.05", strong: false },
            { label: "VAT at 20%", value: "£1,510.41", strong: false },
            { label: "Total including VAT", value: "£9,062.46", strong: true },
        ]);
        expect(vatNote(snapshot.commercial)).toBeNull();
        const price = blockOf(document, "price", "price")!;
        expect(price.totals).toEqual(vatLines(snapshot.commercial));
        expect(price.groups.map((group) => group.title)).toEqual(["Demolition", "Plumbing", "Finishes"]);
    });

    it("shows client prices that add up to the total, with no cost or margin detail", () => {
        const price = blockOf(document, "price", "price")!;
        const pence = price.groups.flatMap((group) => group.items).reduce((sum, item) => sum + Math.round(Number(item.amount.replace(/[£,]/g, "")) * 100), 0);
        expect(pence).toBe(Math.round(snapshot.commercial.contract_sum_ex_vat * 100));
        const everything = JSON.stringify(document);
        for (const hidden of ["overhead", "profit", "margin", "markup", "10%", "15%"]) expect(everything.toLowerCase()).not.toContain(hidden);
    });

    it("words a reverse charge and a zero rate differently, and never shows a VAT line for either", () => {
        const reverse = buildProposalPublicationSnapshot({ ...representativeInput(), vatRate: 0, vatTreatment: "domestic_reverse_charge" });
        expect(vatLines(reverse.commercial)).toEqual([{ label: "Total", value: "£7,552.05", strong: true }]);
        expect(vatNote(reverse.commercial)).toContain("domestic reverse charge");
        const historic = { ...reverse.commercial, vat_treatment: undefined };
        expect(vatNote(historic)).toBe("No VAT is charged on this proposal.");
        expect(buildProposalDocument(reverse).keyFacts[0]).toEqual({ label: "Price", value: "£7,552.05" });
    });

    it("makes payment stages add up to the price exactly", () => {
        const rows = paymentRows(snapshot.commercial);
        expect(rows.map((row) => [row.stage, row.share, row.amount])).toEqual([
            ["Deposit", "30%", "£2,265.61"],
            ["First fix complete", "40%", "£3,020.82"],
            // The last stage takes the rounding, so the three add up to £7,552.05.
            ["Completion", "30%", "£2,265.62"],
        ]);
        const pence = rows.reduce((sum, row) => sum + Math.round(Number(row.amount.replace(/[£,]/g, "")) * 100), 0);
        expect(pence).toBe(755205);
    });

    it("shows a fixed-amount stage as its amount and a part schedule as the shares given", () => {
        const fixed = paymentRows({ ...snapshot.commercial, payment_schedule: [{ id: null, stage: "Deposit", description: null, percentage: 0, amount: 1500 }] });
        expect(fixed).toEqual([{ stage: "Deposit", when: null, share: "", amount: "£1,500.00" }]);
        const part = paymentRows({ ...snapshot.commercial, payment_schedule: [{ id: null, stage: "Deposit", description: null, percentage: 20, amount: null }] });
        expect(part[0].amount).toBe("£1,510.41");
    });
});

describe("programme", () => {
    it("carries the canonical plan unchanged", () => {
        expect(blockOf(document, "programme", "timeline")!.plan).toBe(snapshot.programme_plan);
    });
});

describe("response wording", () => {
    it.each(["acknowledgement", "non_binding_intent"] as const)("uses one wording for %s on the page and in the PDF", (kind) => {
        const doc = buildProposalDocument(buildProposalPublicationSnapshot({ ...representativeInput(), responseKind: kind }));
        const wording = responseWording(kind);
        expect(doc.response).toEqual({
            kind,
            heading: wording.heading,
            notice: wording.notice,
            actionLabel: wording.actionLabel,
            signatureLabel: wording.pdfSignatureLabel,
        });
        const pdf = pdfStrings(doc).replace(/\n/g, " ");
        for (const sentence of wording.notice.split(/(?<=\.)\s+/)) {
            expect(pdf).toContain(sentence.split(" ").slice(0, 5).join(" "));
        }
        expect(pdf).toContain(wording.pdfSignatureLabel);
    });

    it("says in both that neither response is acceptance", () => {
        for (const kind of ["acknowledgement", "non_binding_intent"] as const) {
            const notice = responseWording(kind).notice;
            expect(notice).toContain("not acceptance");
            expect(notice).toContain("does not create a contract");
        }
        expect(responseWording("non_binding_intent").notice).toContain("not binding");
        expect(responseWording("non_binding_intent").notice).toContain("subject to a final contract and terms");
    });

    it("shows the statement frozen at publication even if the wording is later changed", () => {
        const frozen = { ...snapshot, response: { kind: "acknowledgement" as const, notice: "The statement as it was on the day." } };
        expect(buildProposalDocument(frozen).response.notice).toBe("The statement as it was on the day.");
    });
});

describe("publications made before this change", () => {
    const historic: ProposalPublicationSnapshot = {
        schema_version: 1,
        publication: { ...snapshot.publication, response_mode: "binding_acceptance" },
        project: snapshot.project,
        contractor: { ...snapshot.contractor, md_name: undefined, md_message: undefined },
        content: snapshot.content,
        commercial: { ...snapshot.commercial, vat_treatment: undefined },
        programme: [{ id: "a", name: "Build", duration_days: 28, duration_unit: "Days", start_offset_days: 0, start_date: null }],
        terms: snapshot.terms,
    };

    it("render from what they carry, without recalculating a programme they never stated", () => {
        const doc = buildProposalDocument(historic);
        expect(blocksOf(doc, "programme")).toEqual([{
            type: "stageList",
            start: "Monday 2 November 2026",
            rows: [{ name: "Build", duration: "28 days" }],
        }]);
        expect(doc.keyFacts.map((fact) => fact.label)).toEqual(["Price including VAT", "Start on site"]);
        expect(doc.sections.map((section) => section.id)).not.toContain("experience");
    });

    it("are still described as asking for acceptance, and are not reworded as an acknowledgement", () => {
        const doc = buildProposalDocument(historic);
        expect(doc.response.kind).toBe("binding_acceptance");
        expect(doc.response.heading).toBe("Acceptance");
        expect(doc.response.actionLabel).toBe("");
        expect(() => renderProposalBrochure(doc)).not.toThrow();
    });
});

describe("public page and PDF agree", () => {
    const html = htmlText(document);
    const pdf = pdfStrings(document).replace(/\n/g, " ");

    it("state the same price, VAT and totals", () => {
        for (const line of vatLines(snapshot.commercial)) {
            expect(html).toContain(line.label);
            expect(html).toContain(line.value);
            expect(pdf).toContain(line.label);
            expect(pdf).toContain(line.value);
        }
        for (const row of paymentRows(snapshot.commercial)) {
            expect(html).toContain(row.amount);
            expect(pdf).toContain(row.amount);
        }
    });

    it("state the same programme dates, duration and basis", () => {
        const plan = snapshot.programme_plan!;
        for (const text of [formatPlanDate(plan.start_date), formatPlanDate(plan.end_date), plan.duration_label, PROGRAMME_BASIS_NOTE]) {
            expect(html).toContain(text);
            expect(pdf).toContain(text);
        }
        for (const stage of plan.stages) {
            expect(html).toContain(stage.name);
            expect(pdf).toContain(stage.name);
        }
    });

    it("state the same scope, terms, identity and case study", () => {
        for (const text of [
            "Example Building Ltd", "Alex Client", "22222222-V1",
            "Strip out the existing bathroom and make good the walls.",
            "Moving the soil stack", "Water will be off for one working day",
            "Shower room, 3 Sample Street", "Example Trade Register member",
            "1. Jurisdiction", "12. Confidentiality",
            "We would be glad to do this job for you.", "Sam Builder",
        ]) {
            expect(html).toContain(text);
            expect(pdf).toContain(text);
        }
    });

    it("show the same photographs and only the captions the contractor wrote", () => {
        const photos = blockOf(document, "scope", "photos")!.photos;
        expect(photos).toEqual([
            { url: "https://images.example.test/bathroom-before.jpg", caption: "The bathroom as it is now" },
            { url: "https://images.example.test/shower-corner.jpg", caption: null },
        ]);
        const result = renderProposalBrochure(document, stubImages(document));
        expect(result.layout.filter((entry) => entry.kind === "photo" && entry.section === "scope")).toHaveLength(2);
        expect(result.layout.filter((entry) => entry.kind === "caption")).toHaveLength(1);
        expect(result.skippedImages).toEqual([]);
        expect(pdf).toContain("The bathroom as it is now");
    });
});

describe("truthful content", () => {
    /** Wording earlier versions printed with no saved fact behind it. */
    const INVENTED = [
        "10+", "50+", "YEARS EXPERIENCE", "PROJECTS DELIVERED", "QUALITY ASSURED", "OUR COMMITMENT",
        "Transparent Pricing", "Clear Communication", "Programme Certainty", "Quality Without Compromise",
        "accredited trades", "snag-free", "Fully insured", "years of experience", "Dedicated project management",
        "no hidden costs", "All works warranted", "We are confident", "outstanding result", "highest standard",
        "on time and within budget", "carefully reviewed your requirements", "We look forward to working with you",
        "Thank you for the opportunity", "Valued Client", "TBC", "To be confirmed", "To be agreed",
    ];

    it.each([["a full proposal", representativeInput()], ["a minimal proposal", minimalInput()], ["an oversized proposal", stressInput()]])(
        "adds no claim, statistic or promise to %s", (_label, input) => {
            const doc = buildProposalDocument(buildProposalPublicationSnapshot(input));
            const everything = `${htmlText(doc)} ${pdfStrings(doc)}`.toLowerCase();
            for (const claim of INVENTED) expect(everything).not.toContain(claim.toLowerCase());
        },
    );

    it("states years trading, accreditations and insurance only as saved", () => {
        const about = blocksOf(document, "about");
        expect(about).toContainEqual({ type: "facts", items: [{ label: "Years trading", value: "12" }] });
        expect(about).toContainEqual({ type: "bullets", items: ["Example Trade Register member"] });
        expect(about).toContainEqual({ type: "quote", paragraphs: ["I visit every job at the start and at the end."], attribution: "Sam Builder" });
    });

    it("drops an unsafe image link rather than showing it", () => {
        const doc = buildProposalDocument({ ...snapshot, contractor: { ...snapshot.contractor, logo_url: "javascript:alert(1)" }, photos: [{ url: "data:text/html,x", caption: "x" }] });
        expect(doc.company.logoUrl).toBeNull();
        expect(blockOf(doc, "scope", "photos")).toBeUndefined();
    });

    it("marks a draft preview so it cannot be mistaken for a sent proposal", () => {
        const draft = buildProposalDocument(snapshot, { isDraft: true });
        expect(draft.reference).toBe("Draft");
        expect(htmlText(draft)).toContain("Draft preview. This has not been sent to the client.");
        expect(pdfStrings(draft)).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");
    });
});
