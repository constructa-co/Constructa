import { describe, expect, it } from "vitest";
import {
    BOQ_LOCAL_MANIFEST_ENV,
    assertBoqLocalRegression,
    loadBoqLocalManifest,
    runBoqLocalRegression,
} from "./boq-local-regression";

const manifestPath = process.env[BOQ_LOCAL_MANIFEST_ENV];

describe.skipIf(!manifestPath)("D122 — BOQ local regression (private manifest)", () => {
    it("loads BOQ_LOCAL_MANIFEST_PATH and runs independent expectations", () => {
        const manifest = loadBoqLocalManifest(manifestPath!);
        const results = runBoqLocalRegression(manifest);
        for (const r of results) {
            expect(r.summary.tab_count).toBeGreaterThan(0);
        }
        assertBoqLocalRegression(results);
    });
});