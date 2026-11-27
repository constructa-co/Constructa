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
    it("NOT_RUN when BOQ_LOCAL_MANIFEST_PATH is unset", () => {
        if (manifestPath) return;
        expect(manifestPath).toBeUndefined();
    });

    describe.skipIf(!manifestPath || !existsSync(manifestPath ?? ""))("Rob local manifest", () => {
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