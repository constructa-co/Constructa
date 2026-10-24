import { defineConfig } from "@playwright/test";
import { serverEnv } from "./e2e/support/env";
import { readNoPublishEnv } from "./e2e/support/no-publish-guard";
// Fails closed before browsers start: disposable project + labelled QA identity.
// Dedicated global setup: build ref + disposable auth + stub control only (see
// no-publish-global-setup.ts). This variant does not call brief AI; stub has no E2E_AI_MARKER.
const env = readNoPublishEnv();
const appUrl = new URL(env.baseUrl);
const appEnv = serverEnv(env);

const startApp = `node scripts/verify-build-supabase-target.mjs && npx next start -H ${appUrl.hostname} -p ${appUrl.port}`;
const appCommand = process.env.E2E_SKIP_BUILD === "1" ? startApp : `npx next build && ${startApp}`;

export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/phase1-no-publish.qa.ts",
    outputDir: "./test-results/phase1-no-publish",
    globalSetup: "./e2e/support/no-publish-global-setup.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 12 * 60_000,
    expect: { timeout: 20_000 },
    reporter: [["list"], ["json", { outputFile: "test-results/phase1-no-publish/report.json" }]],
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
    projects: [{ name: "desktop-no-publish", use: { viewport: { width: 1440, height: 900 } } }],
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
