import { afterEach, describe, expect, it, vi } from "vitest";
import {
    POSTCODE_LOOKUP_CONFIGURATION_GAP,
    clientPostcodeLookup,
    isPostcodeDataTransferApproved,
    isPostcodeLookupEnabled,
    postcodesIoLookup,
    postcodeLookupConfigurationGap,
} from "./postcode-address-provider";

function stubLookupGates(enabled: string, approved: string) {
    vi.stubEnv("NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED", enabled);
    vi.stubEnv("NEXT_PUBLIC_POSTCODE_DATA_TRANSFER_APPROVED", approved);
}

describe("CON-034 postcode lookup provider", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("reports a configuration gap when lookup is not fully enabled", () => {
        stubLookupGates("", "");
        expect(isPostcodeDataTransferApproved()).toBe(false);
        expect(isPostcodeLookupEnabled()).toBe(false);
        expect(postcodeLookupConfigurationGap()).toBe(POSTCODE_LOOKUP_CONFIGURATION_GAP);
        expect(clientPostcodeLookup()).toBeUndefined();
        expect(POSTCODE_LOOKUP_CONFIGURATION_GAP).not.toMatch(/NEXT_PUBLIC/i);
    });

    it("does not transfer postcodes to a third party until data transfer is approved", () => {
        stubLookupGates("1", "");
        expect(isPostcodeLookupEnabled()).toBe(false);
        expect(clientPostcodeLookup()).toBeUndefined();
        expect(postcodeLookupConfigurationGap()).toBe(POSTCODE_LOOKUP_CONFIGURATION_GAP);
    });

    it("exposes postcodes.io lookup only when feature and data-transfer gates are on", () => {
        stubLookupGates("1", "1");
        expect(clientPostcodeLookup()).toBe(postcodesIoLookup);
        expect(postcodeLookupConfigurationGap()).toBeNull();
    });

    it("maps a successful postcodes.io response to one selectable candidate", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                json: async () => ({
                    status: 200,
                    result: {
                        postcode: "sw1a 1aa",
                        parish: "Westminster",
                        admin_district: "Westminster",
                        region: "London",
                    },
                }),
            }),
        );

        const result = await postcodesIoLookup("SW1A1AA");
        expect(result).toEqual({
            kind: "ok",
            candidates: [{ id: "SW1A1AA", label: "Westminster\nWestminster\nLondon\nSW1A 1AA" }],
        });
    });
});