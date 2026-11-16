import { afterEach, describe, expect, it, vi } from "vitest";
import {
    POSTCODE_LOOKUP_CONFIGURATION_GAP,
    clientPostcodeLookup,
    isPostcodeLookupEnabled,
    postcodesIoLookup,
    postcodeLookupConfigurationGap,
} from "./postcode-address-provider";

describe("CON-034 postcode lookup provider", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("reports a configuration gap when the deployment flag is off", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED", "");
        expect(isPostcodeLookupEnabled()).toBe(false);
        expect(postcodeLookupConfigurationGap()).toBe(POSTCODE_LOOKUP_CONFIGURATION_GAP);
        expect(clientPostcodeLookup()).toBeUndefined();
    });

    it("exposes postcodes.io lookup when the flag is on", () => {
        vi.stubEnv("NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED", "1");
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