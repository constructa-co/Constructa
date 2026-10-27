import { defineConfig } from "@playwright/test";
import { serverEnv } from "./e2e/support/env";
import { PLATFORM_CONSENT_CAPTURE, readPlatformConsentEnv } from "./e2e/support/platform-consent-guard";

// Operator-only, headed and human-assisted. Fails closed here, before any
// browser or server starts, while the runtime is held or prerequisites are
// missing. No default config or CI job matches this runner.
const env = readPlatformConsentEnv();
const appUrl = new URL(env.baseUrl);
const appEnv = serverEnv(env);

const startApp = `node scripts/verify-build-supabase-target.mjs && npx next start -H ${appUrl.hostname} -p ${appUrl.port}`;
const appCommand = process.env.E2E_SKIP_BUILD === "1" ? startApp : `npx next build && ${startApp}`;

export default defineConfig({
    testDir: "./e2e",
    testMatch: "**/platform-consent.qa.ts",
    outputDir: "./test-results/platform-consent",
    globalSetup: "./e2e/support/platform-consent-guard.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: true,
    // Human handoffs (signup, email, sign-in, acceptance) are waited for, not automated.
    timeout: 60 * 60_000,
    expect: { timeout: 20_000 },
    reporter: [["list"]],
    use: {
        baseURL: env.baseUrl,
        channel: "chrome",
        headless: false,
        locale: "en-GB",
        timezoneId: "Europe/London",
        actionTimeout: 20_000,
        navigationTimeout: 45_000,
        ...PLATFORM_CONSENT_CAPTURE,
    },
    projects: [{ name: "desktop-platform-consent", use: { viewport: { width: 1440, height: 900 } } }],
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
