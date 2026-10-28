import { describe, expect, it } from "vitest";
import {
    isPostcodeLookupInputPresent,
    normalizePostcodeForLookup,
    POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE,
} from "./postcode-address";

describe("normalizePostcodeForLookup", () => {
    it("trims, removes spaces and uppercases", () => {
        expect(normalizePostcodeForLookup("  sw1a 1aa  ")).toBe("SW1A1AA");
        expect(normalizePostcodeForLookup("CO3 8WD")).toBe("CO38WD");
    });

    it("detects empty lookup input after normalisation", () => {
        expect(isPostcodeLookupInputPresent("   ")).toBe(false);
        expect(isPostcodeLookupInputPresent("AB1 2CD")).toBe(true);
    });

    it("documents the honest unavailable message for unconfigured lookup", () => {
        expect(POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE).toMatch(/not connected/i);
    });
});
