import { expect, test, type Locator, type Page } from "@playwright/test";
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

const LONG_DRAFT = "  Exact long-page draft.\nKept while reading.  ";
async function openLongTermsScrolledToEnd(page: Page) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.__documentViewOptions = { longTerms: true }; });
    await page.addScriptTag({ content: bundle });
    await page.locator("#wording-scope").fill(LONG_DRAFT);
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    await page.getByRole("button", { name: "Open document view", exact: true }).click();
    const dialog = page.getByRole("dialog"), select = dialog.getByLabel("Reading page", { exact: true });
    const scroller = dialog.locator("[data-document-view-scroll]");
    const keys = await select.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
    await select.selectOption("terms");
    const footer = dialog.locator("[data-proposal-document] > footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeInViewport();
    expect(await scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(1000);
    return { dialog, select, scroller, keys };
}
const scrollTop = (scroller: Locator) => scroller.evaluate(element => element.scrollTop);
const overflow = (scroller: Locator) => scroller.evaluate(element => element.scrollHeight - element.clientHeight);

test("a long reading page scrolled to its end starts the next and the selected page at their beginning", async ({ page }) => {
    const { dialog, select, scroller, keys } = await openLongTermsScrolledToEnd(page);
    const next = dialog.getByRole("button", { name: "Next reading page", exact: true });
    const nextKey = keys[keys.indexOf("terms") + 1];

    await next.click();
    await expect(select).toHaveValue(nextKey);
    await expect(dialog.getByRole("status")).toContainText(`Web reading page ${keys.indexOf(nextKey) + 1} of ${keys.length}`);
    expect(await scrollTop(scroller)).toBe(0);
    await expect(dialog.locator(`[data-doc-section='${nextKey}']`)).toBeInViewport();
    // Next keeps focus unless it has just reached the last page and been disabled.
    await expect(keys.indexOf(nextKey) === keys.length - 1 ? select : next).toBeFocused();

    // Back to the long page: the selected page opens at its start, not at the earlier footer position.
    await select.selectOption("terms");
    await expect(dialog.getByRole("status")).toContainText(`Web reading page ${keys.indexOf("terms") + 1} of ${keys.length}`);
    expect(await overflow(scroller)).toBeGreaterThan(1000);
    expect(await scrollTop(scroller)).toBe(0);
    await expect(dialog.locator("#doc-terms")).toBeInViewport();

    await dialog.locator("[data-proposal-document] > footer").scrollIntoViewIfNeeded();
    expect(await scrollTop(scroller)).toBeGreaterThan(1000);
    await select.selectOption("cover");
    await expect(dialog.getByRole("status")).toContainText(`Web reading page 1 of ${keys.length}`);
    expect(await overflow(scroller)).toBeGreaterThan(0);
    expect(await scrollTop(scroller)).toBe(0);
    await expect(dialog.locator("[data-proposal-document] > header h1")).toBeInViewport();
    await expect(dialog.locator("[data-proposal-document]")).toContainText("END OF SYNTHETIC TERMS TEST");
});

test("reaching the last reading page by keyboard keeps focus on the page chooser", async ({ page }) => {
    const { dialog, select, scroller, keys } = await openLongTermsScrolledToEnd(page);
    await select.selectOption(keys[keys.length - 2]);
    const next = dialog.getByRole("button", { name: "Next reading page", exact: true });
    await next.focus();
    await page.keyboard.press("Enter");
    await expect(select).toHaveValue(keys[keys.length - 1]);
    await expect(next).toBeDisabled();
    await expect(select).toBeFocused();
    await expect(dialog.getByRole("status")).toContainText(`Web reading page ${keys.length} of ${keys.length}`);
    expect(await scrollTop(scroller)).toBe(0);

    const previous = dialog.getByRole("button", { name: "Previous reading page", exact: true });
    await select.selectOption(keys[1]);
    await previous.focus();
    await page.keyboard.press("Enter");
    await expect(select).toHaveValue("cover");
    await expect(previous).toBeDisabled();
    await expect(select).toBeFocused();
});

test("a same-page render keeps the reader's scroll position, page and exact draft", async ({ page }) => {
    const { dialog, select, scroller } = await openLongTermsScrolledToEnd(page);
    const before = await scrollTop(scroller);
    const navigation = await dialog.getByRole("navigation", { name: "Document reading pages" }).elementHandle();
    // Re-render the actual client with unchanged props, then let React and layout settle.
    await page.evaluate(() => window.__documentViewLocal.setLock(null));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(select).toHaveValue("terms");
    expect(await scrollTop(scroller)).toBe(before);
    await expect(dialog.locator("[data-proposal-document] > footer")).toBeInViewport();
    expect(await page.evaluate(element => element!.isConnected, navigation)).toBe(true);

    await dialog.getByRole("button", { name: "Back to drafting", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "1. Prepare proposal", exact: true }).click();
    await expect(page.locator("#wording-scope")).toHaveValue(LONG_DRAFT);
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
});
