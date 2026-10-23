import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];

test.beforeEach(async ({ page, context }) => {
    requests = []; errors = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Section-based web reading pages - offline synthetic proposal</title></head><body><p>LOCAL FIXTURE: synthetic document over actual components;no account,database,save,send or PDF provider.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
});
test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__documentViewLocal.calls)).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ component: "Actual proposal client/document reader/document renderer/native dialog", pages: "Logical web section groups,NOT physical PDF pagination", contextServerRouterTheme: "SYNTHETIC_REFUSING", fullNextTailwindAuthDBPublicationWon: "NOT_RUN", requests, errors }), contentType: "application/json" });
});

test("reading pages follow actual document sections with native previous and next boundaries", async ({ page }) => {
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await page.getByRole("button", { name: "Open document view", exact: true }).click();
    const dialog = page.getByRole("dialog"), select = dialog.getByLabel("Reading page", { exact: true });
    const keys = await select.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
    const sections = await dialog.locator("[data-proposal-document] > section").evaluateAll(items => items.map(item => item.getAttribute("data-doc-section")));
    expect(keys).toEqual(["cover", ...sections]);
    await expect(select).toHaveValue("cover");
    await expect(dialog.locator("[data-proposal-document] > header")).toBeVisible();
    await expect(dialog.locator("[data-proposal-document] > section:visible")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Previous reading page", exact: true })).toBeDisabled();
    await expect(dialog).toContainText("The PDF may use different page breaks.");
    await expect(dialog.getByRole("status")).toContainText(`Web reading page 1 of ${keys.length}`);
    await dialog.getByRole("button", { name: "Next reading page", exact: true }).click();
    await expect(select).toHaveValue(keys[1]);
    await expect(dialog.locator("[data-proposal-document] > header")).toBeHidden();
    await expect(dialog.locator("[data-proposal-document] > section:visible")).toHaveCount(1);
    await dialog.getByRole("button", { name: "Previous reading page", exact: true }).click();
    await expect(select).toHaveValue("cover");
});

test("page selection retains exact unsaved draft and one response without saving or navigation", async ({ page }) => {
    await page.addScriptTag({ content: bundle });
    const input = page.locator("#wording-scope"), raw = "  Exact contractor scope.\nPreserve this raw draft.  ";
    await input.fill(raw);
    const original = await input.elementHandle();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    const open = page.getByRole("button", { name: "Open document view", exact: true });
    await open.click();
    const dialog = page.getByRole("dialog"), select = dialog.getByLabel("Reading page", { exact: true });
    await select.selectOption("scope");
    await expect(dialog.locator("[data-doc-section='scope']")).toBeVisible();
    await expect(dialog.locator("[data-doc-section='scope']")).toContainText("Preserve this raw draft.");
    await select.selectOption("response");
    await expect(page.locator("#doc-response")).toHaveCount(1);
    await expect(dialog.locator("[data-doc-section='response']")).toBeVisible();
    await expect(dialog.locator("input,textarea,form")).toHaveCount(0);
    await expect(dialog.getByRole("button")).toHaveCount(3);
    await expect(dialog.getByRole("button", { name: "Next reading page", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Back to drafting", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
    await page.getByRole("button", { name: "1. Prepare proposal", exact: true }).click();
    await expect(input).toHaveValue(raw);
    expect(await page.evaluate(el => el === document.getElementById("wording-scope"), original)).toBe(true);
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
});

test("long synthetic terms remain exact and can be scrolled to the uncut document footer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.__documentViewOptions = { longTerms: true }; });
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await page.getByRole("button", { name: "Open document view", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reading page", { exact: true }).selectOption("terms");
    const body = dialog.locator("[data-doc-section='terms'] ol > li > p");
    expect(await body.textContent()).toBe(await page.evaluate(() => window.__documentViewLocal.termBody));
    const footer = dialog.locator("[data-proposal-document] > footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    expect(await dialog.locator("[data-document-view-scroll]").evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    expect(await body.evaluate(element => getComputedStyle(element).overflowY)).not.toBe("hidden");
    await expect(dialog.locator("[data-proposal-document]")).toContainText("END OF SYNTHETIC TERMS TEST");
});

test("an explicitly omitted programme creates no invented reading page or altered price", async ({ page }) => {
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await page.getByRole("button", { name: "Open document view", exact: true }).click();
    const dialog = page.getByRole("dialog"), select = dialog.getByLabel("Reading page", { exact: true });
    await expect(select.locator("option[value='programme']")).toHaveCount(0);
    await select.selectOption("price");
    await expect(dialog.locator("[data-doc-section='price']")).toBeVisible();
    await expect(dialog.locator("[data-doc-section='price']")).toContainText("£576.00");
    await select.selectOption("response");
    await expect(dialog.locator("[data-doc-section='response']")).toContainText("It does nothing in the preview.");
    await expect(dialog.getByRole("button", { name: /Send|Save|Download/ })).toHaveCount(0);
});

test("dark mobile reading controls stay in bounds and support keyboard page changes", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.__documentViewOptions = { theme: "dark" }; });
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await page.getByRole("button", { name: "Open document view", exact: true }).click();
    const dialog = page.getByRole("dialog"), next = dialog.getByRole("button", { name: "Next reading page", exact: true });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByLabel("Reading page", { exact: true })).not.toHaveValue("cover");
    const bounds = await dialog.getByRole("navigation", { name: "Document reading pages" }).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
    expect((await next.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: path.join(output, "reading-pages-mobile-dark.png") });
});
