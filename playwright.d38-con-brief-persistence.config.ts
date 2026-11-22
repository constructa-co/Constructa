import { defineConfig } from "@playwright/test";
import { serverEnv } from "./e2e/support/env";
import { readNoPublishEnv } from "./e2e/support/no-publish-guard";

/**
 * D38 CON-001 / CON-002 hosted browser reproduction.
 * Reuses the seeded synthetic QA identity gate from the no-publish harness.
 * Does not run sign-up, publication, or the full Phase 1 journey matrix.
 */
const env = readNoPublishEnv();
const appUrl = new URL(env.baseUrl);
const appEnv = serverEnv(env);

const startApp = `node scripts/verify-build-supabase-target.mjs && npx next start -H ${appUrl.hostname} -p ${appUrl.port}`;
const appCommand = process.env.E2E_SKIP_BUILD === "1" ? startApp : `npx next build && ${startApp}`;

export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/d38-con-001-002-browser.qa.ts",
    outputDir: "./test-results/d38-con-brief-persistence",
    globalSetup: "./e2e/support/no-publish-global-setup.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 12 * 60_000,
    expect: { timeout: 20_000 },
    reporter: [["list"], ["json", { outputFile: "test-results/d38-con-brief-persistence/report.json" }]],
    use: {
        baseURL: env.baseUrl,
        channel: "chrome",
        locale: "en-GB",
        timezoneId: "Europe/London",
        actionTimeout: 20_000,
        navigationTimeout: 45_000,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    projects: [{ name: "desktop-con-brief-persistence", use: { viewport: { width: 1440, height: 900 } } }],
    webServer: [
        {
            command: "node e2e/support/provider-stubs.mjs",
            url: `${env.stubUrl}/__health`,
            env: { E2E_STUB_URL: env.stubUrl },
            reuseExistingServer: false,
        },
        {
            command: appCommand,
            url: `${env.baseUrl}/login`,
            env: appEnv,
            reuseExistingServer: false,
            timeout: 8 * 60_000,
            stdout: "ignore",
            stderr: "pipe",
        },
    ],
});