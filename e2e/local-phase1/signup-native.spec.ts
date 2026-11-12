import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];
const scope = {
    component: "Canonical LoginPage (constructa 08e4475) with first-session frame and A023 checkbox",
    transport: "MOCK platformSignupAction only; browser Supabase auth REFUSED; signup policy hard OFF in real action NOT exercised here",
    context: "Strict CSP offline page; network aborted; no Auth DB/provider/session/signup completion",
    vitestSeams: "NOT_RUN; not duplicating helper/checkbox/action-recorder unit cases",
};

const EMAIL = "contractor@example.invalid";
const PASSWORD = "synthetic-password-8";

test.beforeEach(async ({ page, context }) => {
    requests = []; errors = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Native signup safety - offline canonical login</title></head><body><p>LOCAL FIXTURE: canonical LoginPage; MOCK server-action transport only; no account, database or provider.</p><div id="app"></div></body></html>');
});

test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__signupNativeLocal?.calls ?? [])).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, errors }), contentType: "application/json" });
});

async function boot(page: import("@playwright/test").Page, configure?: () => void) {
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    if (configure) await page.evaluate(configure);
}

async function mountSignup(page: import("@playwright/test").Page, configure?: () => void) {
    await boot(page, configure);
    await page.getByRole("button", { name: "Get started", exact: true }).first().click();
}

async function fillSignup(page: import("@playwright/test").Page) {
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#confirm").fill(PASSWORD);
}

test("native required consent blocks MOCK transport; explicit consent permits one deliberate invocation", async ({ page }) => {
    await mountSignup(page);
    const checkbox = page.locator("#platform-terms");
    const termsLink = page.getByRole("link", { name: "Read the full platform terms (opens in a new tab)", exact: true });
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toHaveAttribute("required", "");
    await expect(termsLink).toHaveAttribute("href", "/terms-of-service");
    await expect(termsLink).toHaveAttribute("target", "_blank");

    await fillSignup(page);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    expect(await checkbox.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    await expect(checkbox).toBeFocused();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => window.__signupNativeLocal.signupInvocationCount)).toBe(0);

    await checkbox.check();
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Check your inbox." })).toBeVisible();
    expect(await page.evaluate(() => window.__signupNativeLocal.signupInvocationCount)).toBe(1);
    const payload = await page.evaluate(() => window.__signupNativeLocal.lastSignupInput);
    expect(payload).toMatchObject({
        email: EMAIL,
        password: PASSWORD,
        acceptance: true,
        revision: "platform-tos-2026-03",
    });
});

test("pending blocks duplicate submit and mode change; transport rejection retains draft with sign-in guidance", async ({ page }) => {
    await mountSignup(page, () => {
        window.__signupNativeLocal.signupBehavior = () => new Promise((_resolve, reject) => {
            window.__signupNativeLocal.rejectSignup = reject;
        });
    });
    await fillSignup(page);
    await page.locator("#platform-terms").check();
    const submit = page.locator('form button[type="submit"]');
    await submit.click();
    await expect(page.getByRole("button", { name: "Processing...", exact: true })).toBeVisible();
    await expect(page.locator("form")).toHaveAttribute("aria-busy", "true");
    const signInButtons = page.getByRole("button", { name: "Sign in", exact: true });
    await expect(signInButtons).toHaveCount(2);
    await expect(signInButtons.nth(0)).toBeDisabled();
    await expect(signInButtons.nth(1)).toBeDisabled();
    await expect(submit).toBeDisabled();
    expect(await page.evaluate(() => window.__signupNativeLocal.signupInvocationCount)).toBe(1);

    await page.evaluate(() => {
        const reject = window.__signupNativeLocal.rejectSignup;
        if (!reject) throw new Error("Expected the same pending MOCK signup invocation");
        reject(new Error("MOCK transport rejection"));
    });
    await expect(page.getByRole("alert")).toContainText(
        "We couldn't confirm whether your account was created. Please try signing in before creating another account.",
    );
    expect(await page.evaluate(() => window.__signupNativeLocal.signupInvocationCount)).toBe(1);
    await expect(page.locator("#email")).toHaveValue(EMAIL);
    await expect(page.locator("#password")).toHaveValue(PASSWORD);
    await expect(page.locator("#confirm")).toHaveValue(PASSWORD);
    await expect(page.locator("#platform-terms")).toBeChecked();
    await expect(page.getByRole("button", { name: "Get started", exact: true }).first()).toBeEnabled();
    await expect(submit).toBeEnabled();
    await expect(page.locator("form")).toHaveAttribute("aria-busy", "false");
    await expect(page.getByRole("heading", { name: /Get started\.\s*Make it yours\./ })).toBeVisible();
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__signupNativeLocal.signupInvocationCount)).toBe(1);
});

const C29_A112_SCOPE_NOTE =
    "Canonical LoginPage + FirstSessionPanel: sign-in omits Getting started steps; deliberate signup shows numbered Account/The essentials/Your workspace; mode toggle only — zero MOCK signup/signIn before deliberate save submit";


async function assertNoAuthOrSignupCalls(page: import("@playwright/test").Page) {
    expect(await page.evaluate(() => window.__signupNativeLocal.signupInvocationCount)).toBe(0);
    const calls = await page.evaluate(() => window.__signupNativeLocal.calls ?? []);
    expect(calls).toEqual([]);
}

async function assertSignInHasNoSetupProgress(page: import("@playwright/test").Page) {
    await expect(page.getByRole("heading", { name: /Welcome back/i })).toBeVisible();
    await expect(page.getByRole("list", { name: "Getting started", exact: true })).toHaveCount(0);
    await expect(page.locator('[aria-current="step"]')).toHaveCount(0);
    await expect(page.locator("#confirm")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Account mode", exact: true }).getByRole("button", { name: "Sign in", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("group", { name: "Account mode", exact: true }).getByRole("button", { name: "Get started", exact: true })).toHaveAttribute("aria-pressed", "false");
}

async function assertSignupShowsAccountProgress(page: import("@playwright/test").Page) {
    const progress = page.getByRole("list", { name: "Getting started", exact: true });
    await expect(progress).toBeVisible();
    const items = progress.getByRole("listitem");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(items.nth(0)).toContainText("1");
    await expect(items.nth(0)).toContainText("Account");
    await expect(items.nth(1)).toContainText("2");
    await expect(items.nth(1)).toContainText("The essentials");
    await expect(items.nth(2)).toContainText("3");
    await expect(items.nth(2)).toContainText("Your workspace");
    await expect(items.nth(1)).not.toHaveAttribute("aria-current", "step");
    await expect(items.nth(2)).not.toHaveAttribute("aria-current", "step");
    await expect(page.getByRole("heading", { name: /Get started/i })).toBeVisible();
    await expect(page.locator("#confirm")).toBeVisible();
    await expect(page.getByRole("group", { name: "Account mode", exact: true }).getByRole("button", { name: "Get started", exact: true })).toHaveAttribute("aria-pressed", "true");
}

/**
 * Append via `registerC29A112PresentationCases({ boot })` from signup-native.spec.ts.
 */
function registerC29A112PresentationCases(host: { boot: (page: import("@playwright/test").Page, configure?: () => void) => Promise<void> }) {
    const { boot } = host;

    test("native sign-in: no Getting started progress or step marker before any auth call", async ({ page }) => {
        await boot(page);
        await assertSignInHasNoSetupProgress(page);
        await page.locator("#email").fill(EMAIL);
        await page.locator("#password").fill(PASSWORD);
        await assertSignInHasNoSetupProgress(page);
        await assertNoAuthOrSignupCalls(page);
    });

    test("native signup mode: numbered step labels associated; return to sign-in drops progress and retains drafts", async ({ page }) => {
        await boot(page);
        await assertSignInHasNoSetupProgress(page);
        await page.getByRole("group", { name: "Account mode", exact: true }).getByRole("button", { name: "Get started", exact: true }).click();
        await assertSignupShowsAccountProgress(page);
        await assertNoAuthOrSignupCalls(page);

        await page.locator("#email").fill(EMAIL);
        await page.locator("#password").fill(PASSWORD);
        await page.locator("#confirm").fill(PASSWORD);

        await page.getByRole("group", { name: "Account mode", exact: true }).getByRole("button", { name: "Sign in", exact: true }).click();
        await assertSignInHasNoSetupProgress(page);
        await expect(page.locator("#email")).toHaveValue(EMAIL);
        await expect(page.locator("#password")).toHaveValue(PASSWORD);
        await expect(page.locator("#confirm")).toHaveCount(0);
        await assertNoAuthOrSignupCalls(page);

        await page.getByRole("group", { name: "Account mode", exact: true }).getByRole("button", { name: "Get started", exact: true }).click();
        await assertSignupShowsAccountProgress(page);
        await expect(page.locator("#confirm")).toHaveValue("");
        await assertNoAuthOrSignupCalls(page);
    });
}

registerC29A112PresentationCases({ boot });
