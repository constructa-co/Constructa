#!/usr/bin/env node
/** Build the offline D127 layout-capture bundles (local only): node docs/temp-files/d127-build-fixture-bundles.mjs /abs/out */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const compiler = path.join(root, "e2e/local-phase1/build-brief-price.mjs");
const outBase = process.argv[2];
if (!outBase || !path.isAbsolute(outBase)) throw new Error("Pass an absolute output directory outside the checkout.");
fs.mkdirSync(outBase, { recursive: true });

for (const [id, scenario] of [["estimate", "d127-layout-estimate"], ["programme", "d127-layout-programme"]]) {
    const out = path.join(outBase, id);
    fs.rmSync(out, { recursive: true, force: true });
    execFileSync(process.execPath, [compiler, out, scenario], { cwd: root, stdio: "inherit", timeout: 300_000 });
    console.log(JSON.stringify({ id, scenario, bundleOut: out, ok: true }));
}
