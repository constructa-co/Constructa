#!/usr/bin/env node
/** Build offline component bundles for D124 workflow screenshots (local only). */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { serializeSourceFingerprints } from "../../e2e/local-phase1/source-fingerprints.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const compiler = path.join(root, "e2e/local-phase1/build-brief-price.mjs");
const outBase = process.env.D124_FIXTURE_OUT ?? "/tmp/constructa-d124-fixture-bundles";
const evidenceMeta = path.join(root, "docs/evidence/d124-brand-review/fixture-bundles");

fs.mkdirSync(outBase, { recursive: true });

const BUILDS = [
    ["dashboard", "d124-brand-home"],
    ["estimate", "a003-palette"],
    ["programme", "detailed-geometry"],
    ["proposal", "d124-brand-proposal"],
];

for (const [id, scenario] of BUILDS) {
    const out = path.join(outBase, id);
    fs.rmSync(out, { recursive: true, force: true });
    execFileSync(process.execPath, [compiler, out, scenario], {
        cwd: root,
        stdio: "inherit",
        timeout: 300_000,
    });
    fs.mkdirSync(path.join(evidenceMeta, id), { recursive: true });
    const manifest = path.join(out, "source-manifest.json");
    if (fs.existsSync(manifest)) {
        // Commit fingerprints as { path, sha256 } entries, not the compiler's raw
        // "<path>": "<hash>" map, which generic secret scanners misread as keys.
        const bundleManifest = JSON.parse(fs.readFileSync(manifest, "utf8"));
        fs.writeFileSync(
            path.join(evidenceMeta, id, "source-manifest.json"),
            serializeSourceFingerprints(bundleManifest),
        );
    }
    console.log(JSON.stringify({ id, scenario, bundleOut: out, ok: true }));
}