import { describe, expect, it } from "vitest";
import { buildProposalDocument } from "@/lib/proposal-document";
import { buildProposalPublicationSnapshot, type BuildProposalPublicationInput } from "@/lib/proposal-publication";
import { representativeInput } from "@/lib/__fixtures__/proposal";
import type { DocBlock, DocSection } from "@/lib/proposal-document";

/**
 * CON-016 — prime-cost and provisional sums are explicitly typed, published
 * at face value in their own blocks, and never marked up. Legacy snapshots
 * (presentation versions 1–5) keep rendering exactly as issued.
 */

// Two measured lines whose marked-up totals force a rounding residual, plus a
// PC sum that must not absorb it. Overhead 10% × profit 15% = ×1.265.
const allowanceInput = (): BuildProposalPublicationInput => {
    const base = representativeInput();
    return {
        ...base,
        estimate: {
            ...base.estimate,
            estimate_lines: [
                { id: "m1", trade_section: "General", description: "Strip out", quantity: 1, unit: "item", line_total: 1010.1, line_type: "labour" },
                { id: "m2", trade_section: "General", description: "Fit kitchen", quantity: 1, unit: "item", line_total: 1010.1, line_type: "labour" },
                { id: "pc1", trade_section: "Kitchen", description: "PC sum: mid-range kitchen units and appliances", quantity: 1, unit: "item", line_total: 7500, line_type: "pc_sum" },
                { id: "ps1", trade_section: "Drainage", description: "Provisional sum: mains sewer connection", quantity: 1, unit: "item", line_total: 850, line_type: "provisional_sum" },
            ],
        },
    };
};

const priceSection = (input: BuildProposalPublicationInput): DocSection => {
    const doc = buildProposalDocument(buildProposalPublicationSnapshot(input));
    const section = doc.sections.find((candidate) => candidate.id === "price");
    if (!section) throw new Error("price section missing");
    return section;
};

const priceBlock = (section: DocSection): Extract<DocBlock, { type: "price" }> => {
    const block = section.blocks.find((candidate): candidate is Extract<DocBlock, { type: "price" }> => candidate.type === "price");
    if (!block) throw new Error("price block missing");
    return block;
};

describe("proposal snapshot — typed PC and provisional sums", () => {
    it("keeps allowance amounts when a credit requires its own adjustment", () => {
        const input = allowanceInput();
        const [, , primeCost, provisional] = input.estimate.estimate_lines;
        input.estimate.estimate_lines = [
            primeCost,
            { ...provisional, line_total: -50 },
            { id: "credit", description: "Work credit", line_total: -100 },
        ];
        const snapshot = buildProposalPublicationSnapshot(input);
        const items = snapshot.commercial.fee_items;
        expect(items.find((item) => item.id === "pc1")?.amount_ex_vat).toBe(7500);
        expect(items.find((item) => item.id === "ps1")?.amount_ex_vat).toBe(-50);
        expect(items.find((item) => item.description === "Price adjustment")).toBeDefined();
    });

    it("publishes allowances at face value and stamps their type", () => {
        const snapshot = buildProposalPublicationSnapshot(allowanceInput());
        const pc = snapshot.commercial.fee_items.find((item) => item.id === "pc1");
        const ps = snapshot.commercial.fee_items.find((item) => item.id === "ps1");
        // The £7,500 kitchen allowance is £7,500 on the proposal, not £9,801.
        expect(pc).toMatchObject({ amount_ex_vat: 7500, line_type: "pc_sum" });
        expect(ps).toMatchObject({ amount_ex_vat: 850, line_type: "provisional_sum" });
        // Marked-up work still carries no type.
        expect(snapshot.commercial.fee_items.find((item) => item.id === "m1")?.line_type).toBeUndefined();
    });

    it("reconciles fee items to the contract sum, residual off the allowances", () => {
        const snapshot = buildProposalPublicationSnapshot(allowanceInput());
        const { fee_items, contract_sum_ex_vat } = snapshot.commercial;
        // 1010.10 × 1.265 = 1277.7765 each: rounding would put a residual on
        // the last line; it must land on measured work, never the PC sum.
        const m1 = fee_items.find((item) => item.id === "m1");
        const m2 = fee_items.find((item) => item.id === "m2");
        const pc = fee_items.find((item) => item.id === "pc1");
        expect(pc?.amount_ex_vat).toBe(7500);
        expect(round2(m1!.amount_ex_vat + m2!.amount_ex_vat)).toBe(round2(2020.2 * 1.265));
        const total = round2(fee_items.reduce((sum, item) => sum + item.amount_ex_vat, 0));
        expect(total).toBe(contract_sum_ex_vat);
        // The contract sum is marked-up measured work plus face-value sums.
        expect(contract_sum_ex_vat).toBe(round2(2020.2 * 1.265 + 7500 + 850));
    });

    it("stamps presentation version 6 on new snapshots", () => {
        expect(buildProposalPublicationSnapshot(allowanceInput()).document_presentation_version).toBe(6);
    });

    it("never publishes a zero-value allowance placeholder", () => {
        const input = allowanceInput();
        input.estimate.estimate_lines = [
            { id: "m1", trade_section: "General", description: "Strip out", quantity: 1, unit: "item", line_total: 1010.1 },
            { id: "pc0", trade_section: "Kitchen", description: "PC sum: kitchen units (allowance not yet set)", quantity: 1, unit: "item", line_total: 0, line_type: "pc_sum" },
        ];
        const snapshot = buildProposalPublicationSnapshot(input);
        // The £0 line is not in the price, so it must not appear as a fee
        // item either — no £0.00 row in a "Prime cost sums" block.
        expect(snapshot.commercial.fee_items.some((item) => item.id === "pc0")).toBe(false);
        const section = priceSection(input);
        const block = priceBlock(section);
        expect(block.groups.map((group) => group.title)).not.toContain("Prime cost sums");
        expect(section.blocks.some((candidate) => candidate.type === "paragraphs" &&
            candidate.paragraphs.some((paragraph) => paragraph.includes("face value")))).toBe(false);
    });
});

describe("proposal document — separate allowance blocks (presentation 6)", () => {
    it("draws PC and provisional sums in their own blocks, after the measured work", () => {
        const block = priceBlock(priceSection(allowanceInput()));
        expect(block.groups.map((group) => group.title)).toEqual([
            null, // measured work filed under General
            "Prime cost sums",
            "Provisional sums",
        ]);
        const pcGroup = block.groups.find((group) => group.title === "Prime cost sums");
        expect(pcGroup?.items).toEqual([
            { description: "PC sum: mid-range kitchen units and appliances", quantity: "", amount: "£7,500.00" },
        ]);
        const psGroup = block.groups.find((group) => group.title === "Provisional sums");
        expect(psGroup?.items[0].amount).toBe("£850.00");
        // Face values appear nowhere in the marked-up work block.
        const measured = block.groups.find((group) => group.title === null);
        expect(measured?.items.map((item) => item.amount)).toEqual(["£1,277.78", "£1,277.77"]);
    });

    it("places allowance blocks between named sections and preliminaries", () => {
        const input = allowanceInput();
        input.estimate.estimate_lines = [
            { id: "m1", trade_section: "General", description: "Strip out", quantity: 1, unit: "item", line_total: 1010.1 },
            { id: "pc1", trade_section: "Kitchen", description: "PC sum: kitchen", quantity: 1, unit: "item", line_total: 7500, line_type: "pc_sum" },
            { id: "pl1", trade_section: "Preliminaries", description: "Scaffold", quantity: 1, unit: "item", line_total: 400 },
        ];
        const block = priceBlock(priceSection(input));
        // The Kitchen section held only the PC line, so only the allowance block remains.
        expect(block.groups.map((group) => group.title)).toEqual([null, "Prime cost sums", "Preliminaries"]);
    });

    it("titles a lone section the same whether or not an allowance exists", () => {
        const withoutPc = (): BuildProposalPublicationInput => {
            const base = representativeInput();
            return {
                ...base,
                estimate: {
                    ...base.estimate,
                    estimate_lines: [
                        { id: "m1", trade_section: "Other work", description: "Strip out", quantity: 1, unit: "item", line_total: 1010.1 },
                    ],
                },
            };
        };
        const withPc = (): BuildProposalPublicationInput => {
            const base = withoutPc();
            return {
                ...base,
                estimate: {
                    ...base.estimate,
                    estimate_lines: [
                        ...base.estimate.estimate_lines,
                        { id: "pc1", trade_section: "Kitchen", description: "PC sum: kitchen", quantity: 1, unit: "item", line_total: 7500, line_type: "pc_sum" },
                    ],
                },
            };
        };
        // "Other work" is a generic bucket the client never reads as a
        // heading: suppressed for a lone section on its own, and still
        // suppressed when a PC sum shares the price section.
        expect(priceBlock(priceSection(withoutPc())).groups.map((group) => group.title)).toEqual([null]);
        expect(priceBlock(priceSection(withPc())).groups.map((group) => group.title)).toEqual([null, "Prime cost sums"]);
    });

    it("states that no adjustment is applied to the allowances", () => {
        const section = priceSection(allowanceInput());
        const statement = section.blocks.find((candidate) =>
            candidate.type === "paragraphs" &&
            candidate.paragraphs.some((paragraph) => paragraph.includes("face value")));
        expect(statement).toBeDefined();
    });

    it("leaves proposals without allowances exactly as before", () => {
        const block = priceBlock(priceSection({ ...representativeInput() }));
        expect(block.groups.map((group) => group.title)).toEqual(["Demolition", "Plumbing", "Finishes"]);
        const section = priceSection({ ...representativeInput() });
        expect(section.blocks.some((candidate) => candidate.type === "paragraphs" &&
            candidate.paragraphs.some((paragraph) => paragraph.includes("face value")))).toBe(false);
    });
});

describe("issued legacy snapshots keep their rendering", () => {
    it.each([1, 2, 3, 4, 5] as const)("groups typed fee items by section at version %i, with no allowance blocks", (version) => {
        const snapshot = buildProposalPublicationSnapshot(allowanceInput());
        snapshot.document_presentation_version = version;
        const doc = buildProposalDocument(snapshot);
        const block = priceBlock(doc.sections.find((candidate) => candidate.id === "price")!);
        expect(block.groups.map((group) => group.title)).not.toContain("Prime cost sums");
        expect(block.groups.map((group) => group.title)).not.toContain("Provisional sums");
        // The amounts on the snapshot are what the client was sent.
        const amounts = block.groups.flatMap((group) => group.items.map((item) => item.amount));
        expect(amounts).toContain("£7,500.00");
        expect(amounts).toContain("£850.00");
    });

    it("renders a version 5 snapshot whose fee items carry no line_type at all", () => {
        // A real issued presentation 1–5 snapshot predates line_type: the
        // field is absent, not merely unset. Strip it the way an issued row
        // actually looks, then check the drawing is unchanged.
        const snapshot = buildProposalPublicationSnapshot(allowanceInput());
        snapshot.document_presentation_version = 5;
        for (const item of snapshot.commercial.fee_items) {
            delete item.line_type;
        }
        const doc = buildProposalDocument(snapshot);
        const block = priceBlock(doc.sections.find((candidate) => candidate.id === "price")!);
        // Typed lines stay inside their sections; nothing is lifted out.
        expect(block.groups.map((group) => group.title)).toEqual([null, "Kitchen", "Drainage"]);
        const amounts = block.groups.flatMap((group) => group.items.map((item) => item.amount));
        expect(amounts).toContain("£7,500.00");
        expect(amounts).toContain("£850.00");
    });

    it("shows no face-value statement on legacy snapshots", () => {
        const snapshot = buildProposalPublicationSnapshot(allowanceInput());
        snapshot.document_presentation_version = 5;
        const doc = buildProposalDocument(snapshot);
        const section = doc.sections.find((candidate) => candidate.id === "price")!;
        expect(section.blocks.some((candidate) => candidate.type === "paragraphs" &&
            candidate.paragraphs.some((paragraph) => paragraph.includes("face value")))).toBe(false);
    });
});

const round2 = (value: number): number => Math.round(value * 100) / 100;
