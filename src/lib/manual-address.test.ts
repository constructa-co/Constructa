import { describe, expect, it } from "vitest";
import {
    canUseManualAddressPreview,
    joinManualAddressPreview,
    manualAddressDraftPending,
    manualAddressPreviewTooLong,
    MANUAL_ADDRESS_MAX_LENGTH,
} from "./manual-address";

describe("joinManualAddressPreview", () => {
    it("joins only non-blank trimmed parts with newlines", () => {
        expect(joinManualAddressPreview({
            line1: " 14 Oak Rd., ",
            line2: "",
            townCity: "Leeds",
            postcode: " LS1 1AA ",
        })).toBe("14 Oak Rd.,\nLeeds\nLS1 1AA");
    });

    it("returns empty when every part is blank", () => {
        expect(joinManualAddressPreview({ line1: "  ", line2: "", townCity: "", postcode: "" })).toBe("");
    });

    it("preserves internal punctuation and case", () => {
        expect(joinManualAddressPreview({
            line1: "Unit B/2",
            line2: "c/o Mr. O'Brien",
            townCity: "St Albans",
            postcode: "AL1 3TH",
        })).toBe("Unit B/2\nc/o Mr. O'Brien\nSt Albans\nAL1 3TH");
    });
});

describe("manual address limits", () => {
    it("refuses previews over the existing 500 UTF-16 limit without truncating", () => {
        const preview = "x".repeat(MANUAL_ADDRESS_MAX_LENGTH + 1);
        expect(manualAddressPreviewTooLong(preview)).toBe(true);
        expect(canUseManualAddressPreview(preview)).toBe(false);
        expect(preview.length).toBe(501);
    });

    it("allows a preview exactly at the limit", () => {
        const preview = "y".repeat(MANUAL_ADDRESS_MAX_LENGTH);
        expect(canUseManualAddressPreview(preview)).toBe(true);
    });
});

describe("manualAddressDraftPending", () => {
    it("is pending only while structured preview differs from the last applied preview", () => {
        const parts = { line1: "Site", line2: "", townCity: "", postcode: "" };
        expect(manualAddressDraftPending(parts, "")).toBe(true);
        const applied = joinManualAddressPreview(parts);
        expect(manualAddressDraftPending(parts, applied)).toBe(false);
        expect(manualAddressDraftPending({ ...parts, line2: "Annex" }, applied)).toBe(true);
    });
});
