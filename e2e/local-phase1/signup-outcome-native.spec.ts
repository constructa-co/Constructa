import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];
const scope = {
    component: "Canonical LoginPage (constructa) successOutcome presentation after typed platformSignupAction result",
    transport: "MOCK platformSignupAction only; browser Supabase auth REFUSED; router REFUSED",
    context: "Strict CSP offline page; network aborted; no checkbox/transport/pending duplication of signup-native",
    vitestSeams: "NOT_RUN; signup-outcome-presentation unit seam not duplicated here",
    signupNativeLeg: "NOT_RUN; consent/transport cases remain on signup-native when registered",
};

const EMAIL = "contractor@example.invalid";
const PASSWORD = "synthetic-password-8";

test.beforeEach(async ({ page, context }) => {
    requests = [];
    errors = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Native signup outcome - offline canonical login</title></head><body><p>LOCAL FIXTURE: canonical LoginPage; MOCK typed signup outcome only; no account, database or provider.</p><div id="app"></div></body></html>',
    );
});

test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__signupOutcomeNativeLocal?.calls ?? [])).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, errors }), contentType: "application/json" });
});

async function boot(page: import("@playwright/test").Page, configure?: () => void) {
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    if (configure) await page.evaluate(configure);
}

async function submitSignup(page: import("@playwright/test").Page) {
    await page.getByRole("button", { name: "Get started", exact: true }).first().click();
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);
    await page.locator("#platform-terms").check();
    await page.getByRole("button", { name: "Create account", exact: true }).click();
}

test("typed confirmation-required keeps inbox-oriented success chrome", async ({ page }) => {
    await boot(page, () => {
        window.__signupOutcomeNativeLocal.signupBehavior = async () => ({ ok: true, outcome: "confirmation-required" });
    });
    await submitSignup(page);
    await expect(page.getByRole("heading", { name: "Check your inbox.", exact: true })).toBeVisible();
    await expect(page.getByText("Confirm your email, then sign in to get started.", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByText("Already confirmed?", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Account created.", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__signupOutcomeNativeLocal.signupInvocationCount)).toBe(1);
});

test("typed created-and-recorded does not present inbox or email-confirmation chrome", async ({ page }) => {
    await boot(page, () => {
        window.__signupOutcomeNativeLocal.signupBehavior = async () => ({
            ok: true,
            outcome: "created-and-recorded",
            userId: "synthetic-user",
        });
    });
    await submitSignup(page);
    await expect(page.getByRole("heading", { name: "Account created.", exact: true })).toBeVisible();
    await expect(page.getByText("Sign in with your email and password to get started.", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check your inbox.", exact: true })).toHaveCount(0);
    await expect(page.getByText("Confirm your email", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Already confirmed?", { exact: false })).toHaveCount(0);
    expect(await page.evaluate(() => window.__signupOutcomeNativeLocal.signupInvocationCount)).toBe(1);
});
