import { defineConfig } from "@playwright/test";
import { ephemeralReplayServerEnv, readEphemeralReplayEnv } from "./e2e/support/ephemeral-replay-env";

/**
 * D38 CON-001 / CON-002 on an ephemeral local Supabase replay stack.
 * No hosted disposable credentials. Requires Docker + Supabase CLI (see scripts/ephemeral-replay/).
 */
process.env.E2E_D38_BACKEND = "ephemeral";

const env = readEphemeralReplayEnv();
const appUrl = new URL(env.baseUrl);
const appEnv = { ...ephemeralReplayServerEnv(env), E2E_D38_BACKEND: "ephemeral" };

const startApp = `node scripts/verify-build-supabase-target.mjs && npx next start -H ${appUrl.hostname} -p ${appUrl.port}`;
const appCommand = process.env.E2E_SKIP_BUILD === "1" ? startApp : `npx next build && ${startApp}`;

export default defineConfig({
    testDir: "./e2e",
    testMatch: ["**/d38-con-001-002-browser.qa.ts", "**/d78-founding-journey.qa.ts"],
    outputDir: "./test-results/d38-ephemeral-replay",
    globalSetup: "./e2e/support/ephemeral-replay-global-setup.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 12 * 60_000,
    expect: { timeout: 20_000 },
    reporter: [["list"], ["json", { outputFile: "test-results/d38-ephemeral-replay/report.json" }]],
    use: {
        baseURL: env.baseUrl,
        browserName: "chromium",
        serviceWorkers: "block",
        locale: "en-GB",
        timezoneId: "Europe/London",
        actionTimeout: 20_000,
        navigationTimeout: 45_000,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    projects: [{ name: "desktop-d38-ephemeral-replay", use: { viewport: { width: 1440, height: 900 } } }],
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