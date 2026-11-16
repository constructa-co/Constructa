import { defineConfig } from "@playwright/test";
import company from "../../playwright.local-phase1.config";

export default defineConfig({
    ...company,
    testDir: "../../e2e/local-phase1",
    testMatch: "reader-styled.spec.ts",
    use: { ...company.use, channel: undefined, browserName: "chromium" },
});