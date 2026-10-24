import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];
const EMAIL = "contractor@example.invalid";
const PASSWORD = "not-a-real-password";
const REDACTED = "We couldn't confirm sign-in. Check your details and try again.";
const PROVIDER_LEAK = "Invalid login credentials hunter2 auth-key User not found";
const scope = {
    component: "Canonical LoginPage handleSignIn (constructa d000767) in default sign-in mode",
    transport: "MOCK signInWithPassword only; platformSignupAction excluded; no real Auth/provider",
    context: "Strict CSP offline; one combined pending → returned error → deliberate retry rejection",
    vitestSeams: "NOT_RUN; does not duplicate signin-transport.test.tsx unit matrix or signup/completion native legs",
};

test.beforeEach(async ({ page, context }) => {
    requests = [];
    errors = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Native sign-in recovery - offline canonical login</title></head><body><p>LOCAL FIXTURE: canonical LoginPage sign-in; MOCK signInWithPassword only.</p><div id="app"></div></body></html>',
    );
});

test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__signinNativeLocal?.calls ?? [])).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, errors }), contentType: "application/json" });
});

async function boot(page: import("@playwright/test").Page) {
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
}

async function fillSignIn(page: import("@playwright/test").Page) {
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
}

function submitSignIn(page: import("@playwright/test").Page) {
    return page.locator("form").getByRole("button", { name: "Sign in", exact: true });
}

test("native sign-in: deferred pending, redacted returned error, retained drafts, then rejected retry without navigation", async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        window.__signinNativeLocal.signInBehavior = () =>
            new Promise(resolve => {
                window.__signinNativeLocal.resolveSignIn = resolve;
            });
    });
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.locator("#confirm")).toHaveCount(0);
    await fillSignIn(page);

    const submit = submitSignIn(page);
    await submit.click();
    await expect(page.getByRole("button", { name: "Processing...", exact: true })).toBeVisible();
    await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
    await expect(page.locator("#email")).toBeDisabled();
    await expect(page.locator("#password")).toBeDisabled();
    const startControls = page.getByRole("button", { name: "Get started", exact: true });
    await expect(startControls).toHaveCount(2);
    await expect(startControls.nth(0)).toBeDisabled();
    await expect(startControls.nth(1)).toBeDisabled();
    expect(await page.evaluate(() => window.__signinNativeLocal.signInInvocationCount)).toBe(1);
    await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeDisabled();
    expect(await page.evaluate(() => window.__signinNativeLocal.signInInvocationCount)).toBe(1);

    await page.evaluate(leak => {
        window.__signinNativeLocal.resolveSignIn?.({ error: { message: leak } });
        window.__signinNativeLocal.resolveSignIn = null;
    }, PROVIDER_LEAK);
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(REDACTED);
    await expect(page.getByText(PROVIDER_LEAK)).toHaveCount(0);
    await expect(page.getByText("hunter2")).toHaveCount(0);
    await expect(page.getByText("auth-key")).toHaveCount(0);
    await expect(page.getByText("Invalid login credentials")).toHaveCount(0);
    await expect(page.getByText("Processing...")).toHaveCount(0);
    await expect(page.locator("#email")).toBeEnabled();
    await expect(page.locator("#password")).toBeEnabled();
    await expect(page.locator("#email")).toHaveValue(EMAIL);
    await expect(page.locator("#password")).toHaveValue(PASSWORD);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    expect(await page.evaluate(() => window.__signinNativeLocal.lastSignInInput)).toEqual({
        email: EMAIL,
        password: PASSWORD,
    });

    await page.evaluate(() => {
        window.__signinNativeLocal.signInBehavior = () =>
            Promise.reject(new Error("gateway timeout auth-key hunter2 internal"));
    });
    await submit.click();
    await expect(alert).toContainText(REDACTED);
    await expect(page.getByText("gateway timeout")).toHaveCount(0);
    await expect(page.getByText("internal")).toHaveCount(0);
    await expect(page.getByText("hunter2")).toHaveCount(0);
    await expect(page.locator("#email")).toHaveValue(EMAIL);
    await expect(page.locator("#password")).toHaveValue(PASSWORD);
    expect(await page.evaluate(() => window.__signinNativeLocal.signInInvocationCount)).toBe(2);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
});
