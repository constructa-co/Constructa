import { expect, test, type Page } from "@playwright/test";
import { savedProjectBrief, syntheticUserExists } from "./support/backend";
import { pointerDriver } from "./support/driver";
import { APPROVED_DISPOSABLE_PROJECT, type E2EEnv } from "./support/env";
import {
    EPHEMERAL_REPLAY_PROJECT_REF,
    readEphemeralReplayEnv,
    type EphemeralReplayEnv,
} from "./support/ephemeral-replay-env";
import { JOB } from "./support/journey-data";
import { BLANK_PROJECT_CREATE_ERROR } from "../src/lib/blank-project";
import { BRIEF_SAVE_ERROR } from "../src/lib/guided-brief";
import { readNoPublishEnv, type NoPublishEnv } from "./support/no-publish-guard";
import { PROPOSAL_READINESS_PATH } from "../src/lib/first-session";
import { Recorder } from "./support/recorder";

type D38Env = NoPublishEnv | EphemeralReplayEnv;

function loadD38Env(): D38Env {
    return process.env.E2E_D38_BACKEND === "ephemeral" ? readEphemeralReplayEnv() : readNoPublishEnv();
}

function authHostFor(env: D38Env): string {
    return new URL(env.supabaseUrl).host;
}

const env = loadD38Env();
const isEphemeral = process.env.E2E_D38_BACKEND === "ephemeral";
const ephemeral = isEphemeral ? (env as EphemeralReplayEnv) : null;
const hosted = !isEphemeral ? (env as NoPublishEnv) : null;

const BRIEF_ACTIVITIES = [JOB.description.split(" ")[0] + " works", "Tiling"];
const START_DATE = "2027-02-01";

/**
 * CON-001 / CON-002 browser reproduction.
 * - Ephemeral: local Supabase replay, sign-up or seeded disposable auth (no hosted secrets).
 * - Hosted: legacy disposable project with labelled synthetic QA sign-in.
 */
test("CON-001 and CON-002: new project and brief persist after reload", async ({ page, context }, testInfo) => {
    const use = pointerDriver(false);
    const recorder = new Recorder(page, testInfo, "pointer", env.evidence);
    const main = page.locator("main main");
    const button = (name: string | RegExp, scope: Page | typeof main = page) =>
        scope.getByRole("button", { name, exact: typeof name === "string" });
    let projectId = "";
    const accountEmail = ephemeral ? ephemeral.signupEmail : hosted!.qaEmail;
    const accountPassword = ephemeral ? ephemeral.signupPassword : hosted!.qaPassword;

    const allowed = new Set([new URL(env.baseUrl).host, new URL(env.supabaseUrl).host]);
    await context.route(
        (url) => /^https?:$/.test(url.protocol) && !allowed.has(url.host),
        async (route) => route.abort(),
    );

    try {
        await test.step(
            ephemeral?.authMode === "seed"
                ? "sign in with seeded disposable auth on the ephemeral stack"
                : ephemeral
                  ? "sign up on the ephemeral stack"
                  : "sign in with the labelled synthetic QA account",
            async () => {
                recorder.step(isEphemeral ? "ephemeral auth (signup or seed)" : "login only against the disposable project");
                await page.goto("/login");

                if (ephemeral && ephemeral.authMode !== "seed") {
                    await use.activate(button("Sign up"));
                    await use.fill(page.getByLabel("Email address"), accountEmail);
                    await use.fill(page.getByLabel("Password", { exact: true }), accountPassword);
                    await use.fill(page.getByLabel("Confirm password"), accountPassword);
                    const signup = page.waitForResponse((response) => response.url().includes("/auth/v1/signup"));
                    await use.activate(button("Create account"));
                    const signupResponse = await signup;
                    expect(new URL(signupResponse.url()).host).toBe(authHostFor(env));
                    expect(signupResponse.status()).toBe(200);
                    const created = await signupResponse.json();
                    const userId = String(created.user?.id ?? created.id ?? "");
                    expect(
                        await syntheticUserExists(userId, accountEmail, env as E2EEnv),
                        "the new account exists in the ephemeral replay database",
                    ).toBe(true);
                    await expect(page.getByText("Account created.")).toBeVisible();
                    await context.clearCookies();
                    await page.goto("/login");
                }

                await use.fill(page.getByLabel("Email address"), accountEmail);
                await use.fill(page.getByLabel("Password", { exact: true }), accountPassword);
                const login = page.waitForResponse((response) => response.url().includes("/auth/v1/token"));
                await use.activate(button("Sign in"));
                const loginResponse = await login;
                expect(new URL(loginResponse.url()).host).toBe(authHostFor(env));
                if (!isEphemeral) {
                    expect(new URL(loginResponse.url()).host).toBe(`${APPROVED_DISPOSABLE_PROJECT.ref}.supabase.co`);
                }
                await expect(page).not.toHaveURL(/\/login$/);
            },
        );

        await test.step("open new project when onboarding is already complete", async () => {
            if (page.url().includes("/onboarding")) {
                await use.fill(page.getByLabel("What kind of work do you do?", { exact: true }), "Bathroom fitting");
                await use.activate(button(/Save and continue|Try again/));
                await use.fill(page.getByLabel("Business or trading name"), "D38 Brief Persistence QA");
                await use.activate(button(/Save and continue|Try again/));
                await expect(page).toHaveURL(new RegExp(`${PROPOSAL_READINESS_PATH.replace(/\//g, "\\/")}$`));
            }
            await page.goto("/dashboard/projects/new");
            await expect(page.getByRole("heading", { level: 1, name: /Add your (first )?job/ })).toBeVisible();
        });

        await test.step("CON-001: blank project creation reaches the Brief", async () => {
            recorder.step("create project through the regular UI");
            await use.fill(page.getByLabel("Job name"), JOB.name);
            await use.fill(page.getByLabel("Client name"), JOB.client);
            await use.activate(button("Create project and start the brief"));
            await expect(page).toHaveURL(/\/dashboard\/projects\/brief\?projectId=/);
            await expect(page.getByText(BLANK_PROJECT_CREATE_ERROR)).toHaveCount(0);
            await expect(page.getByRole("alert").filter({ hasText: BLANK_PROJECT_CREATE_ERROR })).toHaveCount(0);
            projectId = new URL(page.url()).searchParams.get("projectId") ?? "";
            expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
            recorder.results.database = {
                backend: isEphemeral ? "ephemeral-replay" : APPROVED_DISPOSABLE_PROJECT.name,
                projectId,
            };
        });

        await test.step("CON-002: guided brief saves and opens Estimating", async () => {
            const description = page.getByLabel("Describe the job in your own words");
            await use.fill(description, JOB.description);
            await use.activate(button("Next", main));
            const entry = page.getByLabel("Activity to add");
            for (const activity of BRIEF_ACTIVITIES) {
                await entry.fill(activity);
                await use.activate(button("Add activity", main));
            }
            await use.activate(button("Next", main));
            await use.fill(page.getByLabel("Access, restrictions and assumptions"), JOB.siteNotes);
            const startInput = page.locator("#brief-start-date");
            if (await startInput.isVisible()) {
                await use.fill(startInput, START_DATE);
            }
            await use.activate(button("Save and build the price", main));
            await expect(page).toHaveURL(new RegExp(`/dashboard/projects/costs\\?projectId=${projectId}`));
            await expect(page.getByText(BRIEF_SAVE_ERROR)).toHaveCount(0);
            await expect(page.getByRole("alert").filter({ hasText: BRIEF_SAVE_ERROR })).toHaveCount(0);
        });

        await test.step("reload shows the saved brief in the UI and in the database", async () => {
            await page.goto(`/dashboard/projects/brief?projectId=${encodeURIComponent(projectId)}`);
            await expect(page.getByLabel("Describe the job in your own words")).toHaveValue(JOB.description);
            await expect(main.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
            // Reload opens the first step; inspect saved activities on their own step.
            await use.activate(main.getByRole("button", { name: /Step 2.*Activities/ }));
            for (const activity of BRIEF_ACTIVITIES) {
                await expect(main).toContainText(activity);
            }

            const row = await savedProjectBrief(projectId, accountEmail, env as E2EEnv);
            expect(row, "the project row exists in the replay database").not.toBeNull();
            expect(row!.name).toBe(JOB.name);
            expect(row!.clientName).toBe(JOB.client);
            expect(row!.briefCompleted).toBe(true);
            expect(row!.clientType).toBe("domestic");
            expect(row!.briefScope).toContain(JOB.description);
            expect(row!.briefScope).toContain(JOB.siteNotes);
            for (const activity of BRIEF_ACTIVITIES) {
                expect(row!.briefTradeSections).toContain(activity);
            }
            if (row!.startDate) {
                expect(row!.startDate).toBe(START_DATE);
            }
            recorder.results.parity = {
                briefScopeMatchesSqlShape: {
                    brief_completed: row!.briefCompleted,
                    client_type: row!.clientType,
                    activities: row!.briefTradeSections,
                    project_ref: isEphemeral ? EPHEMERAL_REPLAY_PROJECT_REF : APPROVED_DISPOSABLE_PROJECT.ref,
                },
            };
        });
    } finally {
        recorder.results.blockedThirdPartyHosts = [];
        recorder.write(testInfo.errors.length === 0 ? "passed" : "failed");
    }
});