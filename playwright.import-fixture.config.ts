import { defineConfig } from "@playwright/test";

/**
 * Fixture browser run for the company-website import (Stage 2G.2).
 *
 * Unlike the Phase 1 journey this needs no Supabase project: the real screen
 * and the real preview and approval code run against an in-memory database
 * and a made-up website (see e2e/import-fixture/). The harness route is
 * copied into the app for this run only and removed afterwards, with the
 * build that contained it.
 *
 *   npm run e2e:import-fixture                    regression run
 *   E2E_EVIDENCE=1 npm run e2e:import-fixture     also writes docs/evidence/stage2-tranche-2g2/
 */
const PORT = 3210;
const touch = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

// The server is started with no database, deployment or provider configured,
// whatever the shell has set. The application then skips its auth proxy and
// the harness is the only thing that can answer.
const BLANK = Object.fromEntries(
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "RESEND_API_KEY", "VERCEL", "VERCEL_ENV", "CONSTRUCTA_DEPLOY_CONTEXT"].map((name) => [name, ""]),
);

export default defineConfig({
    testDir: "./e2e/import-fixture",
    testMatch: "**/*.fixture.ts",
    outputDir: "./test-results/import-fixture",
    globalTeardown: "./e2e/import-fixture/teardown.ts",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 120_000,
    expect: { timeout: 15_000 },
    reporter: [["list"]],
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        channel: "chrome",
        locale: "en-GB",
        timezoneId: "Europe/London",
        actionTimeout: 15_000,
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    projects: [
        { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
        { name: "phone", use: { viewport: { width: 390, height: 844 }, ...touch } },
        { name: "desktop-keyboard", use: { viewport: { width: 1280, height: 800 } } },
    ],
    webServer: {
        command: `node e2e/import-fixture/prepare.mjs && npx next build && npx next start -H 127.0.0.1 -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}/admin-e2e-import-fixture`,
        env: { ...BLANK, CONSTRUCTA_IMPORT_FIXTURE: "1", NEXT_TELEMETRY_DISABLED: "1" },
        reuseExistingServer: false,
        timeout: 5 * 60_000,
        stdout: "ignore",
        stderr: "pipe",
    },
});
