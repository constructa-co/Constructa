import { describe, expect, it } from "vitest";
import { expectedPrice, gbp } from "./journey-data";

describe("journey expectedPrice", () => {
    it("defaults to on_net construction cost (new company default)", () => {
        const on = expectedPrice();
        expect(on.lines).toBe(gbp(8120));
        expect(on.beforeVat).toBe("£10,515.40");
        expect(on.vat).toBe("£2,103.08");
        expect(on.includingVat).toBe("£12,618.48");
    });

    it("still models legacy compound markup for regression", () => {
        const co = expectedPrice("compound");
        expect(co.beforeVat).toBe("£10,754.13");
        expect(co.includingVat).toBe("£12,904.96");
    });
});