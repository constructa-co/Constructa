import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
    serializeSourceFingerprints,
    SOURCE_FINGERPRINTS_FORMAT,
    toSourceFingerprints,
} from "./source-fingerprints.mjs";

const root = process.cwd();
const EVIDENCE = "docs/evidence/d124-brand-review/fixture-bundles";
const BUNDLES = ["dashboard", "estimate", "programme", "proposal"];

// The shape generic secret scanners misread: a JSON key that is not the
// fingerprint field, directly followed by a 64-character hex value.
const PATH_KEYED_HASH = /^\s*"(?!sha256")[^"]+":\s*"[a-f0-9]{64}"/m;

const hashA = "a".repeat(64);
const hashB = "0123456789abcdef".repeat(4);

describe("source fingerprint evidence format", () => {
    it("keeps every path and SHA-256, in order, with the bundle's modules and scope", () => {
        const bundle = {
            sourceHashes: { "/repo/node_modules/zod/v4/core/api.cjs": hashA, "/repo/src/company-credentials-summary.tsx": hashB },
            modules: 2,
            scope: "synthetic",
        };
        const evidence = toSourceFingerprints(bundle);
        expect(evidence).toEqual({
            format: SOURCE_FINGERPRINTS_FORMAT,
            note: expect.any(String),
            sourceFingerprints: [
                { path: "/repo/node_modules/zod/v4/core/api.cjs", sha256: hashA },
                { path: "/repo/src/company-credentials-summary.tsx", sha256: hashB },
            ],
            modules: 2,
            scope: "synthetic",
        });
        const text = serializeSourceFingerprints(bundle);
        expect(text).not.toMatch(PATH_KEYED_HASH);
        expect(text).not.toContain("sourceHashes");
    });

    it("refuses anything that is not a SHA-256 hex digest", () => {
        expect(() => toSourceFingerprints({})).toThrow("no sourceHashes map");
        expect(() => toSourceFingerprints({ sourceHashes: [] })).toThrow("no sourceHashes map");
        expect(() => toSourceFingerprints({ sourceHashes: { "/a.ts": "not-a-hash" } })).toThrow("not a SHA-256");
        expect(() => toSourceFingerprints({ sourceHashes: { "/a.ts": hashA.toUpperCase() } })).toThrow("not a SHA-256");
        expect(() => toSourceFingerprints({ sourceHashes: { "/a.ts": hashA + "0" } })).toThrow("not a SHA-256");
    });

    it.each(BUNDLES)("the committed %s evidence manifest uses path + sha256 entries only", (bundle) => {
        const text = readFileSync(path.join(root, EVIDENCE, bundle, "source-manifest.json"), "utf8");
        expect(text).not.toMatch(PATH_KEYED_HASH);
        const manifest = JSON.parse(text);
        expect(manifest.format).toBe(SOURCE_FINGERPRINTS_FORMAT);
        expect(manifest).not.toHaveProperty("sourceHashes");
        expect(manifest.sourceFingerprints.length).toBeGreaterThan(0);
        for (const entry of manifest.sourceFingerprints) {
            expect(Object.keys(entry)).toEqual(["path", "sha256"]);
            expect(entry.sha256).toMatch(/^[a-f0-9]{64}$/);
        }
        // Re-serialising the committed content is a no-op: generator and files agree.
        const asBundle = {
            sourceHashes: Object.fromEntries(manifest.sourceFingerprints.map((e: { path: string; sha256: string }) => [e.path, e.sha256])),
            modules: manifest.modules,
            scope: manifest.scope,
        };
        expect(serializeSourceFingerprints(asBundle)).toBe(text);
    });

    it("the D124 bundle generator writes the fingerprint format, not a raw copy", () => {
        const generator = readFileSync(path.join(root, "docs/temp-files/d124-build-fixture-bundles.mjs"), "utf8");
        expect(generator).toContain("serializeSourceFingerprints(bundleManifest)");
        expect(generator).not.toMatch(/copyFileSync\(manifest/);
    });
});
