import { describe, expect, it } from "vitest";
import { expectedPrice, gbp } from "./journey-data";

describe("journey expectedPrice", () => {
    it("defaults to on_net construction cost (new company default)", () => {
        const on = expectedPrice();
        expect(on.beforeVat).toBe("£10,515.40");
        expect(on.lines).toBe(gbp(8120));
    });

    it("still models legacy compound markup for regression", () => {
        expect(expectedPrice("compound").beforeVat).toBe("£10,754.13");
    });
});
