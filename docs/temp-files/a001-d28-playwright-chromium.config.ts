import { defineConfig } from "@playwright/test";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT;
if (!output || !path.isAbsolute(output)) {
    throw Error("Set CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT to the prepared private output outside the application.");
}

export default defineConfig({
    testDir: path.join(process.cwd(), "e2e/local-navigation"),
    testMatch: "navigation-palette.spec.ts",
    outputDir: path.join(output, "browser-output"),
    reporter: [["json", { outputFile: path.join(output, "browser-results.json") }]],
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 30_000,
    use: { channel: undefined, browserName: "chromium", headless: true, viewport: { width: 1280, height: 900 } },
});