import { describe, expect, it } from "vitest";
import { effectiveCatalogueRate, mapLegacyCostLibraryRow, mapMomRowsToCostLibrary, parseStoredCatalogueRate } from "./cost-library-catalog";

describe("CON-031 catalogue rate source", () => {
    it("maps MoM items with org override as the displayed rate", () => {
        const items = [{ id: "i1", code: "GW-01", description: "Excavate", unit: "m3", base_rate: 30, category_id: "c1" }];
        const categories = [{ id: "c1", name: "Groundworks" }];
        const overrides = [{ mom_item_id: "i1", custom_rate: 42.5 }];
        expect(mapMomRowsToCostLibrary(items, categories, overrides)).toEqual([{
            id: "i1", code: "GW-01", description: "Excavate", unit: "m3", base_rate: 42.5, category: "Groundworks",
        }]);
    });

    it("omits items with no stored rate instead of showing a fabricated zero", () => {
        expect(mapMomRowsToCostLibrary(
            [{ id: "i1", code: "X", description: "No rate", unit: "nr", base_rate: null, category_id: "c1" }],
            [{ id: "c1", name: "General" }],
            [],
        )).toEqual([]);
        expect(mapLegacyCostLibraryRow({ id: "l1", description: "Legacy", base_rate: "" })).toBeNull();
    });

    it("keeps legitimate zero overrides and zero stored benchmarks", () => {
        expect(effectiveCatalogueRate({ id: "i1", base_rate: 10 }, { mom_item_id: "i1", custom_rate: 0 })).toBe(0);
        expect(parseStoredCatalogueRate("0")).toBe(0);
        expect(parseStoredCatalogueRate("12.5")).toBe(12.5);
    });
});