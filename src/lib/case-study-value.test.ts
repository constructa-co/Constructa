import { describe, expect, it } from "vitest";
import { contractValueVatBasis, formatContractValue, typedValueAmount } from "./case-study-value";

describe("typedValueAmount", () => {
    it("reads plain figures with £, commas and spaces", () => {
        expect(typedValueAmount("85000")).toBe(85000);
        expect(typedValueAmount("£85,000")).toBe(85000);
        expect(typedValueAmount("£ 9 800 . 5")).toBe(9800.5);
        expect(typedValueAmount("0")).toBe(0);
    });

    it("reads figures with grouped digits as numbers, commas ignored", () => {
        // Commas are treated as grouping characters, exactly as the long-standing
        // proposal rule has done: the figure is read as the digits in order.
        expect(typedValueAmount("85,00,000")).toBe(8500000);
    });

    it("leaves free text alone", () => {
        expect(typedValueAmount("about £85k")).toBeNull();
        expect(typedValueAmount("TBC")).toBeNull();
        expect(typedValueAmount("")).toBeNull();
    });
});

describe("contractValueVatBasis", () => {
    it("accepts only the two known bases", () => {
        expect(contractValueVatBasis("ex_vat")).toBe("ex_vat");
        expect(contractValueVatBasis("inc_vat")).toBe("inc_vat");
        expect(contractValueVatBasis("Ex_vat")).toBeNull();
        expect(contractValueVatBasis("gross")).toBeNull();
        expect(contractValueVatBasis(undefined)).toBeNull();
    });
});

describe("formatContractValue", () => {
    it("prints like the proposal's other figures, with the basis", () => {
        expect(formatContractValue(85000, "ex_vat")).toBe("£85,000.00 ex VAT");
        expect(formatContractValue(9800.5, "inc_vat")).toBe("£9,800.50 inc VAT");
    });

    it("claims no basis when the stored basis is missing or not recognised", () => {
        expect(formatContractValue(85000, null)).toBe("£85,000.00");
        expect(formatContractValue(85000, undefined)).toBe("£85,000.00");
        expect(formatContractValue(85000, "gross" as never)).toBe("£85,000.00");
    });
});
