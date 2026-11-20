import path from "node:path";
import { defineConfig } from "@playwright/test";

const estimateOut = process.env.CONSTRUCTA_LOCAL_ESTIMATE_OUTPUT;
const proposalOut = process.env.CONSTRUCTA_LOCAL_PROPOSAL_OUTPUT;
if (!estimateOut || !proposalOut || !path.isAbsolute(estimateOut) || !path.isAbsolute(proposalOut)) {
    throw Error("Set CONSTRUCTA_LOCAL_ESTIMATE_OUTPUT and CONSTRUCTA_LOCAL_PROPOSAL_OUTPUT to compiled private output directories.");
}

export default defineConfig({
    testDir: "./e2e/local-phase1",
    testMatch: "phone-journey-estimate-proposal.spec.ts",
    outputDir: path.join(estimateOut, "browser-output"),
    reporter: [["json", { outputFile: path.join(estimateOut, "browser-results.json") }]],
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 60_000,
    use: { channel: "msedge", headless: true, viewport: { width: 390, height: 844 }, hasTouch: true },
});