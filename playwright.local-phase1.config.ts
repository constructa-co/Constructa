import { defineConfig } from "@playwright/test";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT;
if (!output || !path.isAbsolute(output) || output.startsWith(process.cwd() + path.sep)) {
    throw Error("Set CONSTRUCTA_LOCAL_PHASE1_OUTPUT to the prepared private output outside the application.");
}

// No webServer, dotenv, global setup, auth, hosted target or provider helpers.
export default defineConfig({
    testDir: "./e2e/local-phase1",
    testMatch: "company-setup.spec.ts",
    outputDir: path.join(output, "browser-output"),
    reporter: [["json", { outputFile: path.join(output, "browser-results.json") }]],
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 30_000,
    use: { channel: "msedge", headless: true, viewport: { width: 1280, height: 900 } },
});
