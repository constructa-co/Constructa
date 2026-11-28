import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    BOQ_LOCAL_MANIFEST_ENV,
    assertBoqLocalRegression,
    loadBoqLocalManifest,
    runBoqLocalRegression,
} from "./boq-local-regression";

const manifestPath = process.env[BOQ_LOCAL_MANIFEST_ENV];

describe("D122 — BOQ local regression (private manifest)", () => {
    it.skipIf(!!manifestPath)("NOT_RUN: BOQ_LOCAL_MANIFEST_PATH is unset", () => {
        expect(process.env[BOQ_LOCAL_MANIFEST_ENV]).toBeUndefined();
    });

    it.runIf(!!manifestPath && !existsSync(manifestPath!))(
        "FAIL: BOQ_LOCAL_MANIFEST_PATH points to a missing file",
        () => {
            expect(() => loadBoqLocalManifest(manifestPath!)).toThrow(/not found/i);
        },
    );

    describe.skipIf(!manifestPath || !existsSync(manifestPath ?? ""))("private manifest on disk", () => {
        it("runs independent expectations from BOQ_LOCAL_MANIFEST_PATH", () => {
            const manifest = loadBoqLocalManifest(manifestPath!);
            const results = runBoqLocalRegression(manifest);
            for (const r of results) {
                expect(r.summary.tab_count).toBeGreaterThan(0);
            }
            assertBoqLocalRegression(results);
        });
    });
});