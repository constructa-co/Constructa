import { defineConfig } from "@playwright/test";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT;
if (!output || !path.isAbsolute(output)) {
    throw Error("Set CONSTRUCTA_LOCAL_PHASE1_OUTPUT to the prepared private output outside the application.");
}

export default defineConfig({
    testDir: path.join(process.cwd(), "e2e/local-phase1"),
    testMatch: "marketing-palette.spec.ts",
    outputDir: path.join(output, "browser-output-marketing"),
    reporter: [["list"], ["json", { outputFile: path.join(output, "marketing-palette-results.json") }]],
    workers: 1,
    retries: 0,
    timeout: 45_000,
    use: { browserName: "chromium", headless: true, viewport: { width: 1280, height: 900 } },
});