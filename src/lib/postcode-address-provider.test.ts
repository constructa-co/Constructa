import { readFileSync } from "node:fs";
import { join } from "node:path";
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

    it("stays off unless each gate is exactly \"1\", including when nothing is configured", () => {
        // Stub first so afterEach restores whatever the shell had, then remove both.
        stubLookupGates("", "");
        delete process.env.NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED;
        delete process.env.NEXT_PUBLIC_POSTCODE_DATA_TRANSFER_APPROVED;
        expect(isPostcodeLookupEnabled()).toBe(false);
        expect(clientPostcodeLookup()).toBeUndefined();
        stubLookupGates("true", "true");
        expect(isPostcodeLookupEnabled()).toBe(false);
        stubLookupGates("", "1");
        expect(isPostcodeLookupEnabled()).toBe(false);
        expect(clientPostcodeLookup()).toBeUndefined();
    });

    it("reads both gates as literal NEXT_PUBLIC member access so client bundles inline them", () => {
        // Node always resolves a computed process.env[name], so stubbed-env tests cannot
        // see the browser failure; the source form is what Next.js inlines.
        const source = readFileSync(join(process.cwd(), "src/lib/postcode-address-provider.ts"), "utf8");
        expect(source).not.toMatch(/process\.env\s*\[/);
        expect(source).not.toMatch(/\{[^}]*\}\s*=\s*process\.env/);
        expect(source).toContain("process.env.NEXT_PUBLIC_POSTCODE_LOOKUP_ENABLED");
        expect(source).toContain("process.env.NEXT_PUBLIC_POSTCODE_DATA_TRANSFER_APPROVED");
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