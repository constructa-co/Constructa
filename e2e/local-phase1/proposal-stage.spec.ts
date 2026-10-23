import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];
let calls: string[] = [];
const prepareName = "1. Prepare proposal";
const reviewName = "2. Review document";

test.beforeEach(async ({ page, context }) => {
    requests = []; errors = []; calls = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Offline proposal preparation - synthetic context</title></head><body><p>LOCAL FIXTURE: mocked server/router, no Auth, database, publication or provider.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
});
test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__documentViewLocal.calls)).toEqual(calls);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ component: "Actual ReviewSendClient/stage switcher/document renderer", server: "MOCK_REFUSAL_OR_EXPLICIT_PENDING_SAVE", router: "REFUSES", NextAuthDBPublicationWon: "NOT_RUN", pagination: "NOT_IMPLEMENTED", style: "Actual modules,not full Tailwind/layout/contrast acceptance", calls, requests, errors }), contentType: "application/json" });
});

test("preparation comes first and final document and Send are separate mounted regions", async ({ page }) => {
    await page.addScriptTag({ content: bundle });
    await expect(page.getByRole("button", { name: prepareName, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#proposal-preparation")).toBeVisible();
    await expect(page.locator("#proposal-final-review")).toBeHidden();
    await expect(page.locator("[data-review-send]")).toHaveCount(1);
    await expect(page.locator("[data-review-send]")).toBeHidden();
    await expect(page.locator("[data-proposal-document]")).toHaveCount(1);
    await page.getByRole("button", { name: reviewName, exact: true }).click();
    await expect(page.locator("#proposal-preparation")).toBeHidden();
    await expect(page.locator("#proposal-final-review")).toBeVisible();
    await expect(page.locator("[data-proposal-document]")).toBeVisible();
    await expect(page.locator("[data-review-send]")).toBeVisible();
});

test("review and return preserve exact raw draft, response intent, dirty Send gate and editor node", async ({ page }) => {
    await page.addScriptTag({ content: bundle });
    const input = page.locator("#wording-scope");
    const raw = "  Contractor scope exact.\nKeep these spaces.  ";
    await input.fill(raw);
    const original = await input.elementHandle();
    const options = page.locator("[data-response-option] input");
    await options.last().check();
    await page.getByRole("button", { name: reviewName, exact: true }).click();
    await expect(page.locator("[data-proposal-document]")).toContainText("Contractor scope exact.");
    await expect(page.locator("[data-proposal-document]")).toContainText("Keep these spaces.");
    await expect(page.locator("[data-send-button]")).toBeDisabled();
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
    expect(await page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(true);
    await page.getByRole("button", { name: prepareName, exact: true }).click();
    await expect(input).toHaveValue(raw);
    expect(await page.evaluate(el => el === document.getElementById("wording-scope"), original)).toBe(true);
    await expect(options.last()).toBeChecked();
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
});

test("existing terms fix hash reveals preparation without saving or replacing empty terms", async ({ page }) => {
    await page.evaluate(() => { window.__documentViewOptions = { emptyTerms: true }; });
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: reviewName, exact: true }).click();
    await expect(page.getByRole("button", { name: "Open document view", exact: true })).toBeDisabled();
    await page.locator("[data-send-missing='terms']").getByRole("link", { name: "Go to the terms", exact: true }).click();
    await expect(page.locator("#proposal-preparation")).toBeVisible();
    await expect(page.locator("#review-terms")).toBeVisible();
    await expect(page.locator("#proposal-final-review")).toBeHidden();
    await expect(page.locator("#review-terms")).toContainText("0 terms are shown");
    expect(await page.evaluate(() => location.hash)).toBe("#review-terms");
});

test("an existing quick payment choice stays deliberate and is retained on return to preparation", async ({ page }) => {
    await page.evaluate(() => { window.__documentViewOptions = { noPayments: true }; });
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: reviewName, exact: true }).click();
    await expect(page.locator("[data-send-missing='payment']")).toBeVisible();
    await page.getByRole("button", { name: "Use payment on completion", exact: true }).click();
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
    await expect(page.locator("[data-send-button]")).toBeDisabled();
    await page.getByRole("button", { name: prepareName, exact: true }).click();
    await expect(page.locator("#review-payments")).toContainText("Payment on completion");
});

test("existing pending save fences stage changes and refused save keeps exact preparation draft", async ({ page }) => {
    await page.evaluate(() => { window.__documentViewOptions = { pendingSave: true }; });
    await page.addScriptTag({ content: bundle });
    const input = page.locator("#wording-scope");
    await input.fill("  Draft waiting for mock save.  ");
    await page.locator("[data-save-draft]").click();
    calls = ["mock.save"];
    await expect(page.getByRole("button", { name: reviewName, exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: prepareName, exact: true })).toBeDisabled();
    await expect(page.locator("#proposal-preparation")).toBeVisible();
    await page.evaluate(() => window.__documentViewLocal.refuseSave());
    await expect(page.locator("[data-review-save-error]")).toContainText("Synthetic save refused");
    await expect(input).toHaveValue("  Draft waiting for mock save.  ");
    await expect(page.getByRole("button", { name: reviewName, exact: true })).toBeEnabled();
});

test("lock refresh exits final review, retains the exact draft and does not reopen review on unlock", async ({ page }) => {
    await page.addScriptTag({ content: bundle });
    const input = page.locator("#wording-scope");
    await input.fill("LOCKED EXACT RAW TEXT");
    await page.getByRole("button", { name: reviewName, exact: true }).click();
    await page.evaluate(() => window.__documentViewLocal.setLock("Synthetic protected lock."));
    await expect(page.locator("#proposal-final-review")).toBeHidden();
    await expect(page.locator("#proposal-preparation")).toBeVisible();
    await expect(input).toHaveValue("LOCKED EXACT RAW TEXT");
    await expect(input).toBeDisabled();
    await page.evaluate(() => window.__documentViewLocal.setLock(null));
    await expect(input).toBeEnabled();
    await expect(page.getByRole("button", { name: prepareName, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#proposal-final-review")).toBeHidden();
});

test("mobile stage controls support keyboard activation without navigation or saving", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.__documentViewOptions = { theme: "dark" }; });
    await page.addScriptTag({ content: bundle });
    const review = page.getByRole("button", { name: reviewName, exact: true });
    await review.focus();
    await page.keyboard.press("Enter");
    await expect(review).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#proposal-final-review")).toBeVisible();
    const bounds = await review.boundingBox();
    expect(bounds!.width).toBeGreaterThan(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
    await page.getByRole("button", { name: prepareName, exact: true }).focus();
    await page.keyboard.press("Space");
    await expect(page.locator("#proposal-preparation")).toBeVisible();
});
