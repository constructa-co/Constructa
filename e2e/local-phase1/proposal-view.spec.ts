import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];
const scope = {
    component: "Actual ReviewSendClient/native document dialog/document renderer",
    actions: "MOCK_REFUSAL; no save/send/AI/upload/history calls permitted",
    context: "SYNTHETIC props/router/theme; real Auth/DB/Next/persistence NOT_RUN",
    hashingPdfPublicationWon: "NOT_RUN",
    pagination: "NOT_IMPLEMENTED; separate reading view only",
    style: "Actual dialog/workspace CSS; full Next/Tailwind styling NOT_RUN",
};

test.beforeEach(async ({ page, context }) => {
    requests = []; errors = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local document-view interaction - synthetic context</title></head><body><p>LOCAL FIXTURE: no account, database, actual save, publication or navigation. Native dialog over actual proposal client.</p><div id="app"></div></body></html>');
});

test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__documentViewLocal.calls)).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, errors }), contentType: "application/json" });
});

test("document reading preserves the mounted exact unsaved draft, native Escape/Back and opening focus", async ({ page }) => {
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    const input = page.locator("#wording-scope");
    const raw = "  Exact unsaved contractor scope.\nA second line remains.  ";
    await input.fill(raw);
    const originalNode = await input.elementHandle();
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
    const open = page.getByRole("button", { name: "Open document view", exact: true });
    await open.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => el instanceof HTMLDialogElement && el.matches(":modal"))).toBe(true);
    await expect(dialog).toContainText("Read-only draft");
    await expect(dialog).toContainText("Exact unsaved contractor scope.");
    await expect(dialog).toContainText("A second line remains.");
    await expect(dialog.locator("input,textarea,form")).toHaveCount(0);
    await expect(dialog.getByRole("button")).toHaveCount(1);
    const back = dialog.getByRole("button", { name: "Back to drafting", exact: true });
    await expect(back).toBeFocused();
    await expect(page.locator("#doc-response")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(input).toHaveValue(raw);
    expect(await page.evaluate(el => el === document.getElementById("wording-scope"), originalNode)).toBe(true);
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
    expect(await page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(true);
    await open.click();
    await dialog.getByRole("button", { name: "Back to drafting", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
    await expect(input).toHaveValue(raw);
});

test("dark mobile reading view fits the viewport and returns without saving", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.__documentViewOptions = { theme: "dark" }; });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "Open document view", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
    await page.screenshot({ path: path.join(output, "document-view-mobile-dark.png") });
    await dialog.getByRole("button", { name: "Back to drafting", exact: true }).click();
    await expect(dialog).toHaveCount(0);
});

test("a refreshed existing lock hides the open document and retains the current draft", async ({ page }) => {
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    const scopeInput = page.locator("#wording-scope");
    await scopeInput.fill("UNSAVED EXACT TEXT");
    await page.getByRole("button", { name: "Open document view", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.evaluate(() => window.__documentViewLocal.setLock("Local fixture: protected job is locked."));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open document view", exact: true })).toHaveCount(0);
    await expect(scopeInput).toHaveValue("UNSAVED EXACT TEXT");
    await expect(scopeInput).toBeDisabled();
    await page.evaluate(() => window.__documentViewLocal.setLock(null));
    await expect(scopeInput).toBeEnabled();
    await expect(scopeInput).toHaveValue("UNSAVED EXACT TEXT");
    await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("missing preview data keeps document view unavailable under the existing estimate rule", async ({ page }) => {
    await page.evaluate(() => { window.__documentViewOptions = { noEstimate: true }; });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.getByRole("button", { name: "Open document view", exact: true })).toBeDisabled();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#presend-pdf-note")).toContainText("once the job has a name and an estimate");
});

test("an initially locked proposal retains the existing hidden-preview policy", async ({ page }) => {
    await page.evaluate(() => { window.__documentViewOptions = { locked: true }; });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
    await expect(page.locator("[data-review-locked]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Open document view", exact: true })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(0);
});
