import { defineConfig } from "@playwright/test";
import { readE2EEnv, serverEnv } from "./e2e/support/env";
import { AI_MARKER } from "./e2e/support/journey-data";

// Fails closed here, before any browser or server starts, when the
// environment is missing or does not name the disposable project.
const env = readE2EEnv();
const appUrl = new URL(env.baseUrl);
const appEnv = serverEnv(env);

// The production build is what gets tested. E2E_SKIP_BUILD reuses an existing
// build during local iteration; global setup still proves which backend that
// build was compiled against before any test runs.
const startApp = `npx next start -H ${appUrl.hostname} -p ${appUrl.port}`;
const appCommand = process.env.E2E_SKIP_BUILD === "1" ? startApp : `npx next build && ${startApp}`;

const touch = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/*.spec.ts",
    outputDir: "./test-results",
    globalSetup: "./e2e/support/global-setup.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 12 * 60_000,
    expect: { timeout: 20_000 },
    reporter: [["list"], ["json", { outputFile: "test-results/report.json" }]],
    use: {
        baseURL: env.baseUrl,
        // The installed Chrome. No browser build is downloaded.
        channel: "chrome",
        locale: "en-GB",
        timezoneId: "Europe/London",
        actionTimeout: 20_000,
        navigationTimeout: 45_000,
        screenshot: "only-on-failure",
        // The trace carries a screencast of the failing run. Separate video
        // would need an ffmpeg download, which this harness avoids.
        trace: "retain-on-failure",
    },
    projects: [
        { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
        { name: "tablet", use: { viewport: { width: 768, height: 1024 }, ...touch } },
        { name: "phone", use: { viewport: { width: 390, height: 844 }, ...touch } },
        { name: "desktop-keyboard", use: { viewport: { width: 1440, height: 900 } } },
    ],
    webServer: [
        {
            command: "node e2e/support/provider-stubs.mjs",
            url: `${env.stubUrl}/__health`,
            env: { E2E_STUB_URL: env.stubUrl, E2E_AI_MARKER: AI_MARKER },
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
