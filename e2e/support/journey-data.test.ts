import { describe, expect, it } from "vitest";
import { expectedPrice, gbp } from "./journey-data";

describe("journey expectedPrice", () => {
    it("defaults to on_net construction cost (new company default)", () => {
        const on = expectedPrice();
        expect(on.lines).toBe(gbp(8120));
        expect(on.beforeVat).toBe("£10,515.40");
        expect(on.vat).toBe("£2,103.08");
        expect(on.includingVat).toBe("£12,618.48");
        expect(on.deposit).toBe("£3,154.62");
        expect(on.balance).toBe("£7,360.78");
    });

    it("still models legacy compound markup for regression", () => {
        const co = expectedPrice("compound");
        expect(co.beforeVat).toBe("£10,754.13");
        expect(co.vat).toBe("£2,150.83");
        expect(co.includingVat).toBe("£12,904.96");
        expect(co.deposit).toBe("£3,226.24");
        expect(co.balance).toBe("£7,527.89");
    });
});