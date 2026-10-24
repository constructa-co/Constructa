import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];
const REVISION = "platform-tos-2026-03";
const scope = {
    component: "Canonical PlatformTermsCompletion (constructa) with first-session frame and A023 completion checkbox",
    transport: "MOCK completePlatformTermsAcceptanceAction only; no Auth DB/session recorder",
    context: "Strict CSP offline page; network aborted; no signup-native leg re-run",
    vitestSeams: "NOT_RUN; not duplicating platform-terms recorder/helper unit cases",
};

test.beforeEach(async ({ page, context }) => {
    requests = [];
    errors = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Native completion safety - offline canonical platform terms</title></head><body><p>LOCAL FIXTURE: canonical PlatformTermsCompletion; MOCK completion server-action transport only; no database or provider.</p><div id="app"></div></body></html>',
    );
});

test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__completionNativeLocal?.calls ?? [])).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, errors }), contentType: "application/json" });
});

async function boot(page: import("@playwright/test").Page, configure?: () => void) {
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    if (configure) await page.evaluate(configure);
}

test("native unchecked submit blocks MOCK transport; acknowledged response exposes fixed Continue target", async ({ page }) => {
    await boot(page);
    const checkbox = page.locator("#platform-terms-completion");
    const termsLink = page.getByRole("link", { name: "Read the full platform terms (opens in a new tab)", exact: true });
    await expect(page.getByRole("heading", { name: "Accept the platform terms.", exact: true })).toBeVisible();
    await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toHaveAttribute("required", "");
    await expect(termsLink).toHaveAttribute("href", "/terms-of-service");
    await expect(termsLink).toHaveAttribute("target", "_blank");

    await page.getByRole("button", { name: "Accept platform terms", exact: true }).click();
    expect(await checkbox.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
    await expect(checkbox).toBeFocused();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(await page.evaluate(() => window.__completionNativeLocal.completionInvocationCount)).toBe(0);

    await checkbox.check();
    await page.getByRole("button", { name: "Accept platform terms", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You're all set.", exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Your acceptance of the platform terms is recorded.");
    const continueLink = page.getByRole("link", { name: "Continue", exact: true });
    await expect(continueLink).toHaveAttribute("href", "/dashboard");
    expect(await page.evaluate(() => window.__completionNativeLocal.completionInvocationCount)).toBe(1);
    const payload = await page.evaluate(() => window.__completionNativeLocal.lastCompletionInput);
    expect(payload).toMatchObject({ acceptance: true, revision: REVISION });
});

test("pending fences duplicate submit; transport throw retains checkbox and form without success navigation", async ({ page }) => {
    await boot(page, () => {
        window.__completionNativeLocal.completionBehavior = () => new Promise((_resolve, reject) => {
            window.__completionNativeLocal.rejectCompletion = reject;
        });
    });
    const checkbox = page.locator("#platform-terms-completion");
    await checkbox.check();
    const submit = page.locator('form[aria-busy] button[type="submit"]');
    await submit.click();
    await expect(page.getByRole("button", { name: "Recording...", exact: true })).toBeVisible();
    await expect(page.locator('form[aria-busy]')).toHaveAttribute("aria-busy", "true");
    await expect(submit).toBeDisabled();
    await expect(checkbox).toBeDisabled();
    expect(await page.evaluate(() => window.__completionNativeLocal.completionInvocationCount)).toBe(1);
    await page.locator('form[aria-busy]').dispatchEvent("submit");
    expect(await page.evaluate(() => window.__completionNativeLocal.completionInvocationCount)).toBe(1);

    await page.evaluate(() => {
        const reject = window.__completionNativeLocal.rejectCompletion;
        if (!reject) throw new Error("Expected the same pending MOCK completion invocation");
        reject(new Error("MOCK transport rejection"));
    });
    const checkboxAfterReject = page.locator("#platform-terms-completion");
    const submitAfterReject = page.getByRole("button", { name: "Accept platform terms", exact: true });
    await expect(page.getByRole("alert")).toContainText(
        "We couldn't confirm that your acceptance was recorded. Please try again.",
    );
    expect(await page.evaluate(() => window.__completionNativeLocal.completionInvocationCount)).toBe(1);
    await expect(checkboxAfterReject).toBeChecked();
    await expect(checkboxAfterReject).toBeEnabled();
    await expect(submitAfterReject).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Accept the platform terms.", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue", exact: true })).toHaveCount(0);
});
