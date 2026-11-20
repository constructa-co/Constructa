import { describe, expect, it } from "vitest";
import {
    DEFAULT_MARKUP_METHOD,
    MARKUP_METHOD_NOTE,
    computeBudgetCost,
    computeContractSum,
    computeContractSumValue,
    markupMethodForNewEstimate,
    resolveMarkupMethod,
} from "./financial";
import { summarisePrice } from "./simple-estimate";
import { profileUpdateFromForm } from "./profile-update";
import { companyMarkupMethod } from "./server/company-markup-method";
import { buildProposalPublicationSnapshot } from "./proposal-publication";
import { representativeInput } from "./__fixtures__/proposal";
import { buildProposalDocument } from "./proposal-document";
import { renderProposalBrochure } from "./pdf/proposal-brochure";

const lines = [
    { trade_section: "Groundworks", line_total: 6000 },
    { trade_section: "Brickwork", line_total: 4000 },
];
// net 10,000, prelims 10% -> 11,000 construction cost
const estimate = { prelims_pct: 10, overhead_pct: 10, risk_pct: 5, profit_pct: 15, discount_pct: 0 };

describe("markup method — maths", () => {
    it("on net: overhead, risk and profit are each a percentage of construction cost", () => {
        const r = computeContractSum({ ...estimate, markup_method: "on_net" }, lines);
        expect(r.totalConstructionCost).toBeCloseTo(11000, 6);
        expect(r.overheadAmount).toBeCloseTo(1100, 6);
        expect(r.riskAmount).toBeCloseTo(550, 6);
        expect(r.profitAmount).toBeCloseTo(1650, 6);
        expect(r.contractSum).toBeCloseTo(14300, 6);
        expect(r.markupMethod).toBe("on_net");
    });

    it("compound: risk on cost+overhead, profit on cost+overhead+risk", () => {
        const r = computeContractSum({ ...estimate, markup_method: "compound" }, lines);
        expect(r.overheadAmount).toBeCloseTo(1100, 6);
        expect(r.riskAmount).toBeCloseTo(605, 6); // 12,100 x 5%
        expect(r.profitAmount).toBeCloseTo(1905.75, 6); // 12,705 x 15%
        expect(r.contractSum).toBeCloseTo(14610.75, 6);
        expect(r.markupMethod).toBe("compound");
    });

    it("on net is order independent; the amounts add to the sum", () => {
        const r = computeContractSum({ ...estimate, markup_method: "on_net" }, lines);
        const swapped = computeContractSum(
            { ...estimate, overhead_pct: 15, profit_pct: 10, markup_method: "on_net" },
            lines,
        );
        expect(swapped.contractSum).toBeCloseTo(r.contractSum, 6);
        expect(r.totalConstructionCost + r.overheadAmount + r.riskAmount + r.profitAmount).toBeCloseTo(r.contractSum, 6);
    });

    it("compound puts more in risk and profit than on net does, so its total is higher", () => {
        const on = computeContractSum({ ...estimate, markup_method: "on_net" }, lines);
        const co = computeContractSum({ ...estimate, markup_method: "compound" }, lines);
        expect(co.overheadAmount).toBeCloseTo(on.overheadAmount, 6);
        expect(co.riskAmount).toBeGreaterThan(on.riskAmount);
        expect(co.profitAmount).toBeGreaterThan(on.profitAmount);
        expect(co.contractSum).toBeGreaterThan(on.contractSum);
    });

    it("discount comes off the pre-discount total under both methods", () => {
        for (const markup_method of ["on_net", "compound"]) {
            const base = computeContractSum({ ...estimate, markup_method }, lines);
            const disc = computeContractSum({ ...estimate, discount_pct: 10, markup_method }, lines);
            expect(disc.discountAmount).toBeCloseTo(base.contractSum * 0.1, 6);
            expect(disc.contractSum).toBeCloseTo(base.contractSum * 0.9, 6);
        }
    });

    it("the all-in multiplier agrees with the contract sum under both methods", () => {
        for (const markup_method of ["on_net", "compound"]) {
            const r = computeContractSum({ ...estimate, discount_pct: 5, markup_method }, lines);
            expect(r.totalConstructionCost * r.ohRiskProfitMultiplier).toBeCloseTo(r.contractSum, 6);
        }
    });

    it("prime-cost and provisional sums add at face value after markup under both methods", () => {
        const withPc = [
            ...lines,
            { trade_section: "General", line_total: 500, line_type: "pc_sum" as const },
        ];
        for (const markup_method of ["on_net", "compound"] as const) {
            const r = computeContractSum({ ...estimate, markup_method }, withPc);
            const base = computeContractSum({ ...estimate, markup_method }, lines);
            expect(r.faceValueTotal).toBe(500);
            expect(r.contractSum).toBeCloseTo(base.contractSum + 500, 6);
        }
    });

    it("with zero markups both methods give the construction cost", () => {
        for (const markup_method of ["on_net", "compound"]) {
            const r = computeContractSum({ prelims_pct: 0, markup_method }, lines);
            expect(r.contractSum).toBeCloseTo(10000, 6);
        }
    });

    it("with a single markup both methods agree", () => {
        for (const only of [{ overhead_pct: 12 }, { risk_pct: 12 }, { profit_pct: 12 }]) {
            const a = computeContractSum({ ...only, markup_method: "on_net" }, lines).contractSum;
            const b = computeContractSum({ ...only, markup_method: "compound" }, lines).contractSum;
            expect(a).toBeCloseTo(b, 6);
        }
    });

    it("budget cost never includes markups, whatever the method", () => {
        expect(computeBudgetCost({ ...estimate, markup_method: "on_net" }, lines)).toBeCloseTo(11000, 6);
        expect(computeBudgetCost({ ...estimate, markup_method: "compound" }, lines)).toBeCloseTo(11000, 6);
    });
});

describe("markup method — legacy estimates are preserved", () => {
    it("null, missing or unrecognised reads as compound", () => {
        for (const v of [null, undefined, "", "ON_NET", "additive", 1]) expect(resolveMarkupMethod(v)).toBe("compound");
    });

    it("an estimate with no stored method gives exactly the pre-D36 figure", () => {
        // Hand-computed with the old compounding: 11,000 x 1.10 x 1.05 x 1.15
        const expected = 11000 * 1.1 * 1.05 * 1.15;
        expect(computeContractSum(estimate, lines).contractSum).toBeCloseTo(expected, 6);
        expect(computeContractSum({ ...estimate, markup_method: null }, lines).contractSum).toBeCloseTo(expected, 6);
        expect(computeContractSumValue(estimate, lines)).toBe(14610.75);
    });

    it("the legacy figure is unchanged by what the company later chooses", () => {
        const before = computeContractSumValue(estimate, lines);
        // The company switching to on net changes nothing on a stored estimate.
        expect(markupMethodForNewEstimate("on_net")).toBe("on_net");
        expect(computeContractSumValue({ ...estimate, markup_method: null }, lines)).toBe(before);
    });
});

describe("markup method — new estimates and the company choice", () => {
    it("defaults to on net", () => {
        expect(DEFAULT_MARKUP_METHOD).toBe("on_net");
        for (const v of [null, undefined, "", "junk"]) expect(markupMethodForNewEstimate(v)).toBe("on_net");
        expect(markupMethodForNewEstimate("compound")).toBe("compound");
    });

    const reader = (result: unknown, fail = false) => ({
        from: () => ({
            select: () => ({
                eq: () => ({
                    maybeSingle: async () => {
                        if (fail) throw new Error("column does not exist");
                        return { data: result };
                    },
                }),
            }),
        }),
    });

    it("reads the company setting", async () => {
        expect(await companyMarkupMethod(reader({ markup_method: "compound" }), "u")).toBe("compound");
        expect(await companyMarkupMethod(reader({ markup_method: "on_net" }), "u")).toBe("on_net");
    });

    it("falls back to on net when there is no profile, no value or the read fails", async () => {
        expect(await companyMarkupMethod(reader(null), "u")).toBe("on_net");
        expect(await companyMarkupMethod(reader({}), "u")).toBe("on_net");
        expect(await companyMarkupMethod(reader(null, true), "u")).toBe("on_net");
    });

    it("the profile save writes only a recognised method", () => {
        const form = (v?: string) => {
            const fd = new FormData();
            fd.set("company_name", "A Ltd");
            if (v !== undefined) fd.set("markup_method", v);
            return fd;
        };
        expect(profileUpdateFromForm("u", form("compound")).markup_method).toBe("compound");
        expect(profileUpdateFromForm("u", form("on_net")).markup_method).toBe("on_net");
        // An out-of-date form, or a bad value, must not touch the saved choice.
        expect("markup_method" in profileUpdateFromForm("u", form())).toBe(false);
        expect("markup_method" in profileUpdateFromForm("u", form("evil"))).toBe(false);
    });
});

describe("markup method — printed on the estimate", () => {
    it("the running total reports and words the method in use", () => {
        const on = summarisePrice({ ...estimate, total_cost: 0, markup_method: "on_net" } as never, lines as never);
        const old = summarisePrice({ ...estimate, total_cost: 0 } as never, lines as never);
        expect(on.markupMethod).toBe("on_net");
        expect(old.markupMethod).toBe("compound");
        expect(on.contractSum).toBe(14300);
        expect(old.contractSum).toBe(14610.75);
        expect(MARKUP_METHOD_NOTE[on.markupMethod]).toMatch(/calculated on net construction cost/);
        expect(MARKUP_METHOD_NOTE[old.markupMethod]).toMatch(/compounded/);
    });

    it("the printed sentences carry no percentages or amounts", () => {
        for (const note of Object.values(MARKUP_METHOD_NOTE)) expect(note).not.toMatch(/[0-9£%]/);
    });
});

describe("markup method — published proposals", () => {
    const publish = (markup_method: string | null | undefined) => {
        const input = representativeInput();
        input.estimate = { ...input.estimate, ...(markup_method === undefined ? {} : { markup_method }) };
        return buildProposalPublicationSnapshot(input);
    };

    it("an estimate with no method still publishes the compounded figure", () => {
        // Fixture: net 5,970, overhead 10%, profit 15%, no prelims/risk.
        expect(publish(undefined).commercial.contract_sum_ex_vat).toBe(Math.round(5970 * 1.1 * 1.15 * 100) / 100);
    });

    it("an on-net estimate publishes the on-net figure and the fee items add up to it", () => {
        const snap = publish("on_net");
        expect(snap.commercial.contract_sum_ex_vat).toBe(Math.round(5970 * 1.25 * 100) / 100);
        const items = snap.commercial.fee_items.reduce((s, i) => s + i.amount_ex_vat, 0);
        expect(Math.round(items * 100) / 100).toBe(snap.commercial.contract_sum_ex_vat);
    });

    it("the snapshot carries the method sentence only: no method key, percentages or amounts", () => {
        for (const m of ["on_net", "compound"] as const) {
            const { calculation_note, ...rest } = publish(m).commercial;
            expect(calculation_note).toBe(MARKUP_METHOD_NOTE[m]);
            expect(JSON.stringify(rest)).not.toMatch(/markup|on_net|compound|overhead|profit|risk/i);
        }
        expect(publish(undefined).commercial.calculation_note).toBe(MARKUP_METHOD_NOTE.compound);
    });
});

describe("markup method — print evidence", () => {
    const render = (markup_method: string | null | undefined, stripNote = false) => {
        const input = representativeInput();
        input.estimate = { ...input.estimate, ...(markup_method === undefined ? {} : { markup_method }) };
        const snap = buildProposalPublicationSnapshot(input);
        if (stripNote) delete snap.commercial.calculation_note;
        const doc = buildProposalDocument(snap);
        const internal = renderProposalBrochure(doc).doc.internal as unknown as { pages: Array<string[] | undefined> };
        return { doc, text: internal.pages.map((p) => (p ?? []).join("\n")).join("\n") };
    };
    const priceNote = (doc: ReturnType<typeof buildProposalDocument>) =>
        doc.sections.flatMap((s) => s.blocks).flatMap((b) => (b.type === "price" ? [b.note] : []))[0];

    it("the price block carries the on-net sentence and the PDF prints it", () => {
        const { doc, text } = render("on_net");
        expect(priceNote(doc)).toContain(MARKUP_METHOD_NOTE.on_net);
        expect(text).toContain("Calculation method");
        expect(text).toContain("net construction cost");
    });

    it("the price block carries the compounded sentence and the PDF prints it", () => {
        const { doc, text } = render("compound");
        expect(priceNote(doc)).toContain(MARKUP_METHOD_NOTE.compound);
        expect(text).toContain("Calculation method");
        expect(text).toContain("compounded");
    });

    it("an issued snapshot with no stored sentence prints none and states no method", () => {
        const { doc, text } = render("on_net", true);
        expect(priceNote(doc) ?? "").not.toMatch(/Calculation method/);
        expect(text).not.toContain("Calculation method");
    });

    it("neither PDF carries a method key or a percentage for the markups", () => {
        for (const m of ["on_net", "compound"]) {
            const { text } = render(m);
            expect(text).not.toMatch(/markup_method|on_net/);
            expect(text).not.toMatch(/(overhead|risk|profit)[^)]{0,40}[0-9]+(\.[0-9]+)?\s?%/i);
        }
    });
});
