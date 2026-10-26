import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let errors: string[] = [];
const scope = {
    component: "Actual ReviewSendClient/ProposalDocumentDialog/ProposalDocumentReader/ProposalDocumentView under actual ThemeProvider",
    style: "Actual dialog/reader/workspace CSS modules compiled from the checkout; document renderer Tailwind utilities NOT_RUN",
    context: "SYNTHETIC data; refusing actions/router; in-memory localStorage stand-in; real Auth/DB/Next/persistence NOT_RUN",
    pages: "Logical web section groups, NOT physical PDF pagination",
    saveSendPdfPublicationWon: "NOT_RUN",
    assistiveTechnology: "NOT_RUN; keyboard focus only",
};

type Theme = "system-c" | "dark";
const rgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};
// The --review-* values in src/components/proposal-workspace.module.css.
const COLOURS: Record<Theme, Record<"ink" | "muted" | "border" | "surface" | "field" | "focus", string>> = {
    "system-c": { ink: "#18221a", muted: "#566257", border: "#d5ded2", surface: "#fafcf8", field: "#ffffff", focus: "#176d49" },
    dark: { ink: "#f2f7ef", muted: "#b8c5b5", border: "#3b4b3c", surface: "#131c15", field: "#101812", focus: "#a5e8b8" },
};
const THEMES: Theme[] = ["system-c", "dark"];

test.beforeEach(async ({ page, context }) => {
    requests = []; errors = [];
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Styled document reader - offline synthetic proposal</title></head><body><p>LOCAL FIXTURE: actual styled reader over synthetic data;no account,database,save,send or PDF provider.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
});

test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__readerStyledLocal?.calls ?? [])).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, errors }), contentType: "application/json" });
});

async function openReader(page: Page, options: { theme: Theme; longTerms?: boolean; shortParts?: boolean }, viewport = { width: 1280, height: 900 }) {
    await page.setViewportSize(viewport);
    await page.evaluate(value => { window.__readerStyledOptions = value; }, options);
    await page.addScriptTag({ content: bundle });
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    const open = page.getByRole("button", { name: "Open document view", exact: true });
    await open.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => el instanceof HTMLDialogElement && el.matches(":modal"))).toBe(true);
    return { open, dialog, back: dialog.getByRole("button", { name: "Back to drafting", exact: true }) };
}

const style = (locator: Locator, property: string, pseudo?: string) =>
    locator.evaluate((el, [name, part]) => getComputedStyle(el, part || null).getPropertyValue(name), [property, pseudo ?? ""] as const);

/** Where focus is: an index into the dialog's tabbable controls, "body", or an element outside. */
async function focusProbe(page: Page) {
    return page.evaluate(() => {
        const dialog = document.querySelector("dialog[data-proposal-document-dialog]");
        const active = document.activeElement;
        if (!active || active === document.body) return { at: "body" as const, ring: "" };
        if (!dialog?.contains(active)) return { at: `outside:${active.tagName}#${active.id}`, ring: "" };
        const tabbable = [...dialog.querySelectorAll<HTMLElement>("a[href],button,select,input,textarea,[tabindex]")]
            .filter(el => !el.matches(":disabled") && el.getAttribute("tabindex") !== "-1" && el.checkVisibility());
        const css = getComputedStyle(active);
        return { at: tabbable.indexOf(active as HTMLElement), ring: active.matches(":focus-visible") ? `${css.outlineStyle} ${css.outlineWidth} ${css.outlineColor}` : "none" };
    });
}
const tabbableNames = (dialog: Locator) => dialog.evaluate(dialogElement =>
    [...dialogElement.querySelectorAll<HTMLElement>("a[href],button,select,input,textarea,[tabindex]")]
        .filter(el => !el.matches(":disabled") && el.getAttribute("tabindex") !== "-1" && el.checkVisibility())
        .map(el => `${el.tagName.toLowerCase()}:${el instanceof HTMLSelectElement ? el.labels?.[0]?.textContent : el.getAttribute("role") ?? el.textContent?.trim()}`));

test("the compiled bundle uses the checkout's actual reader CSS modules, components and theme provider", async () => {
    const manifest = JSON.parse(readFileSync(path.join(output, "source-manifest.json"), "utf8")) as { sourceHashes: Record<string, string>; scope: string };
    const root = process.cwd();
    for (const file of [
        "src/components/proposal/proposal-document-dialog.module.css",
        "src/components/proposal/proposal-document-reader.module.css",
        "src/components/proposal-workspace.module.css",
        "src/components/proposal/proposal-document-dialog.tsx",
        "src/components/proposal/proposal-document-reader.tsx",
        "src/components/proposal/proposal-document-view.tsx",
        "src/lib/theme-context.tsx",
    ]) {
        const absolute = path.join(root, file);
        expect(manifest.sourceHashes[absolute], file).toBe(createHash("sha256").update(readFileSync(absolute, "utf8")).digest("hex"));
    }
    expect(manifest.scope).toContain("Tailwind utilities NOT compiled");
});

for (const theme of THEMES) {
    test(`${theme} desktop: the actual theme provider and workspace CSS module style the native reader`, async ({ page }) => {
        const colours = COLOURS[theme];
        const { dialog, back } = await openReader(page, { theme });
        expect(await dialog.evaluate(el => el.closest("[data-dark]")?.getAttribute("data-dark"))).toBe(String(theme === "dark"));
        expect(await style(dialog, "background-color")).toBe(rgb(colours.surface));
        expect(await style(dialog, "color")).toBe(rgb(colours.ink));
        expect(await style(dialog, "border-top-color")).toBe(rgb(colours.border));
        expect(await style(dialog, "background-color", "::backdrop")).toBe("rgba(24, 34, 26, 0.62)");
        expect(await style(dialog.getByText("Document view", { exact: true }), "color")).toBe(rgb(colours.focus));
        expect(await style(dialog.getByText("Read-only draft. Nothing is saved or sent here.", { exact: true }), "color")).toBe(rgb(colours.muted));
        expect(await style(back, "background-color")).toBe(rgb(colours.field));
        expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);

        const navigation = dialog.getByRole("navigation", { name: "Document reading pages" });
        expect(await style(navigation, "position")).toBe("sticky");
        expect(await style(navigation, "background-color")).toBe(rgb(colours.surface));
        expect(await style(navigation, "border-top-color")).toBe(rgb(colours.border));
        const select = dialog.getByLabel("Reading page", { exact: true });
        expect(await style(select, "background-color")).toBe(rgb(colours.field));
        expect(await style(select, "color")).toBe(rgb(colours.ink));
        expect(await style(dialog.getByRole("button", { name: "Previous reading page", exact: true }), "opacity")).toBe("0.5");

        // The finished document keeps its own light paper in both themes.
        expect(await style(dialog.locator("[data-document-view-scroll]"), "background-color")).toBe("rgb(231, 229, 228)");
        const article = dialog.locator("[data-proposal-document]");
        expect(await style(article, "background-color")).toBe("rgb(255, 255, 255)");
        expect(await style(article, "color")).toBe("rgb(41, 37, 36)");

        // Computed module sizes. The app's Tailwind preflight (border-box) is not
        // loaded here, so outer boxes may add the 1px border; that is NOT_RUN.
        expect(await style(dialog, "width")).toBe("960px");
        expect(await style(dialog, "height")).toBe("868px");
        await page.screenshot({ path: path.join(output, `reader-styled-desktop-${theme}.png`) });
    });

    test(`${theme}: native Tab and Shift+Tab stay in the dialog with module focus rings; Escape and Back return focus`, async ({ page }) => {
        const ring = `solid 3px ${rgb(COLOURS[theme].focus)}`;
        const { open, dialog, back } = await openReader(page, { theme });
        await expect(back).toBeFocused();
        const names = await tabbableNames(dialog);
        // Cover page: Previous is disabled and so is not in the tab order.
        expect(names).toEqual(["button:Back to drafting", "div:region", "select:Reading page", "button:Next reading page"]);
        const n = names.length;
        expect((await focusProbe(page)).at).toBe(0);

        const forward = [];
        for (let press = 0; press < 2 * (n + 1); press++) {
            await page.keyboard.press("Tab");
            forward.push(await focusProbe(page));
        }
        const forwardInside = forward.filter(step => step.at !== "body");
        expect(forwardInside.map(step => step.at).slice(0, 2 * n)).toEqual(Array.from({ length: 2 * n }, (_, i) => (i + 1) % n));
        expect(forwardInside.every(step => step.ring === ring)).toBe(true);

        await back.focus();
        const reverse = [];
        for (let press = 0; press < 2 * (n + 1); press++) {
            await page.keyboard.press("Shift+Tab");
            reverse.push(await focusProbe(page));
        }
        const reverseInside = reverse.filter(step => step.at !== "body");
        expect(reverseInside.map(step => step.at).slice(0, 2 * n)).toEqual(Array.from({ length: 2 * n }, (_, i) => (((n - 1 - i) % n) + n) % n));
        expect(reverseInside.every(step => step.ring === ring)).toBe(true);

        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(open).toBeFocused();

        await page.keyboard.press("Enter");
        await expect(dialog).toBeVisible();
        await expect(back).toBeFocused();
        // A fresh view starts at the cover again.
        await expect(dialog.getByLabel("Reading page", { exact: true })).toHaveValue("cover");
        await page.keyboard.press("Enter");
        await expect(dialog).toHaveCount(0);
        await expect(open).toBeFocused();
    });
}

test("keyboard reading pages start at the cover and stop at both boundaries", async ({ page }) => {
    const { dialog } = await openReader(page, { theme: "system-c" });
    const select = dialog.getByLabel("Reading page", { exact: true });
    const previous = dialog.getByRole("button", { name: "Previous reading page", exact: true });
    const next = dialog.getByRole("button", { name: "Next reading page", exact: true });
    const keys = await select.locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value));
    const sections = await dialog.locator("[data-proposal-document] > section").evaluateAll(items => items.map(item => item.getAttribute("data-doc-section")));
    expect(keys).toEqual(["cover", ...sections]);
    expect(keys.at(-1)).toBe("response");
    await expect(select).toHaveValue("cover");
    await expect(previous).toBeDisabled();

    await next.focus();
    for (let pageNumber = 2; pageNumber <= keys.length; pageNumber++) {
        await page.keyboard.press("Enter");
        await expect(select).toHaveValue(keys[pageNumber - 1]);
        await expect(dialog.getByRole("status")).toContainText(`Web reading page ${pageNumber} of ${keys.length}`);
        await expect(dialog.locator(`[data-doc-section='${keys[pageNumber - 1]}']`)).toBeVisible();
        await expect(dialog.locator("[data-proposal-document] > section:visible")).toHaveCount(1);
    }
    await expect(next).toBeDisabled();
    await expect(select).toBeFocused();
    expect(await style(next, "opacity")).toBe("0.5");
    expect(await tabbableNames(dialog)).toEqual(["button:Back to drafting", "div:region", "button:Previous reading page", "select:Reading page"]);

    await previous.focus();
    for (let pageNumber = keys.length - 1; pageNumber >= 1; pageNumber--) {
        await page.keyboard.press("Enter");
        await expect(select).toHaveValue(keys[pageNumber - 1]);
    }
    await expect(previous).toBeDisabled();
    await expect(select).toBeFocused();
    await expect(dialog.locator("[data-proposal-document] > header")).toBeVisible();
});

for (const theme of THEMES) {
    test(`${theme} 390px: long synthetic terms stay exact, in bounds and scroll without sideways overflow`, async ({ page }) => {
        const { dialog, back } = await openReader(page, { theme, longTerms: true }, { width: 390, height: 844 });
        expect(await style(dialog, "width")).toBe("374px");
        expect(await style(dialog, "height")).toBe("828px");
        const box = (await dialog.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(390);
        // Narrow-screen rules from the dialog and reader modules: Back takes the
        // header's full content width (computed, as box-sizing preflight is absent).
        const widths = await back.evaluate(el => {
            const parent = el.parentElement!, css = getComputedStyle(parent);
            return { back: parseFloat(getComputedStyle(el).width), header: parent.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight) };
        });
        expect(Math.abs(widths.back - widths.header)).toBeLessThan(1);
        const navigation = dialog.getByRole("navigation", { name: "Document reading pages" });
        expect(await navigation.locator("> div").first().evaluate(el => getComputedStyle(el).display)).toBe("grid");
        const navBox = (await navigation.boundingBox())!;
        expect(navBox.x).toBeGreaterThanOrEqual(box.x);
        expect(navBox.x + navBox.width).toBeLessThanOrEqual(box.x + box.width);
        for (const control of [dialog.getByLabel("Reading page", { exact: true }), dialog.getByRole("button", { name: "Next reading page", exact: true })]) {
            expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        expect(await style(dialog, "background-color")).toBe(rgb(COLOURS[theme].surface));

        await dialog.getByLabel("Reading page", { exact: true }).selectOption("terms");
        const body = dialog.locator("[data-doc-section='terms'] ol > li > p");
        expect(await body.textContent()).toBe(await page.evaluate(() => window.__readerStyledLocal.termBody));
        const scroller = dialog.locator("[data-document-view-scroll]");
        expect(await scroller.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
        expect(await scroller.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await body.evaluate(el => getComputedStyle(el).overflowY)).not.toBe("hidden");
        const footer = dialog.locator("[data-proposal-document] > footer");
        await footer.scrollIntoViewIfNeeded();
        await expect(footer).toBeInViewport();
        await expect(dialog.locator("[data-proposal-document]")).toContainText("END OF SYNTHETIC STYLED TERMS");
        await page.screenshot({ path: path.join(output, `reader-styled-390-${theme}.png`) });
    });
}

test("named reading parts move only on Go and focus the exact retained clause below sticky controls", async ({ page }) => {
    const { dialog } = await openReader(page, { theme: "system-c" }, { width: 390, height: 844 });
    await dialog.getByLabel("Reading page", { exact: true }).selectOption("terms");
    const parts = dialog.getByLabel("Part of this reading page", { exact: true });
    const clauses = dialog.locator("[data-doc-section='terms'] [data-doc-terms] > li");
    const texts = await clauses.allTextContents();
    expect(texts).toHaveLength(12);
    await expect(parts.locator("option")).toHaveCount(12);
    const scroller = dialog.locator("[data-document-view-scroll]");
    const before = await scroller.evaluate(el => el.scrollTop);
    await parts.selectOption("8");
    expect(await scroller.evaluate(el => el.scrollTop)).toBe(before);
    await expect(clauses.nth(8)).not.toBeFocused();
    await dialog.getByRole("button", { name: "Go to part", exact: true }).click();
    await expect(clauses.nth(8)).toBeFocused();
    const clauseBox = (await clauses.nth(8).boundingBox())!;
    const controlsBox = (await dialog.getByRole("navigation", { name: "Document reading pages" }).boundingBox())!;
    expect(clauseBox.y).toBeGreaterThanOrEqual(controlsBox.y + controlsBox.height);
    expect(await scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(before);
    expect(await clauses.allTextContents()).toEqual(texts);
    expect(await scroller.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("the exact source draft is retained across reading with no Save, Send or navigation", async ({ page }) => {
    await page.evaluate(() => { window.__readerStyledOptions = { theme: "system-c" }; });
    await page.addScriptTag({ content: bundle });
    const input = page.locator("#wording-scope"), raw = "  Exact styled-reader draft.\n  Indented second line kept.  ";
    await input.fill(raw);
    const original = await input.elementHandle();
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
    await page.getByRole("button", { name: "2. Review document", exact: true }).click();
    const open = page.getByRole("button", { name: "Open document view", exact: true });
    await open.click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reading page", { exact: true }).selectOption("scope");
    await expect(dialog.locator("[data-doc-section='scope']")).toContainText("Exact styled-reader draft.");
    await expect(dialog.locator("[data-doc-section='scope']")).toContainText("Indented second line kept.");
    await expect(dialog.locator("input,textarea,form")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: /save|send|download|publish|accept/i })).toHaveCount(0);
    await expect(dialog.getByRole("button")).toHaveCount(3);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
    await open.click();
    await dialog.getByRole("button", { name: "Back to drafting", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();

    await page.getByRole("button", { name: "1. Prepare proposal", exact: true }).click();
    await expect(input).toHaveValue(raw);
    expect(await page.evaluate(el => el === document.getElementById("wording-scope"), original)).toBe(true);
    await expect(page.locator("[data-save-status='unsaved']")).toBeVisible();
});

test("Go to part with the inner reader not overflowing focuses the actual Clarifications subheading without moving the background page", async ({ page }) => {
    const { dialog } = await openReader(page, { theme: "system-c", shortParts: true }, { width: 1280, height: 1400 });
    const scroller = dialog.locator("[data-document-view-scroll]");
    await dialog.getByLabel("Reading page", { exact: true }).selectOption("scope");
    // Input condition for this boundary, measured rather than assumed: the
    // short synthetic scope (real subheadings) fits its inner scroll container.
    expect(await scroller.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
    const parts = dialog.getByLabel("Part of this reading page", { exact: true });
    await expect(parts.locator("option")).toHaveText(["Not included", "Clarifications"]);
    const section = dialog.locator("[data-doc-section='scope']");
    const notIncluded = section.getByRole("heading", { name: "Not included", exact: true, level: 3 });
    const clarifications = section.getByRole("heading", { name: "Clarifications", exact: true, level: 3 });
    await expect(notIncluded).toBeVisible();
    await expect(clarifications).toBeVisible();

    // Choosing a part alone never moves the inner container or focuses the target.
    const scrollTopBefore = await scroller.evaluate(el => el.scrollTop);
    await parts.selectOption("1");
    expect(await scroller.evaluate(el => el.scrollTop)).toBe(scrollTopBefore);
    await expect(clarifications).not.toBeFocused();

    // From here, count real window.scrollBy calls and record the background offset.
    await page.evaluate(() => {
        const w = window as unknown as Record<string, number>;
        const original = window.scrollBy;
        w.__a072ScrollByCount = 0;
        window.scrollBy = function (...args: unknown[]) {
            w.__a072ScrollByCount += 1;
            return (original as unknown as (...values: unknown[]) => unknown).apply(window, args);
        } as unknown as typeof window.scrollBy;
        w.__a072ScrollY = window.scrollY;
    });

    // One explicit Go focuses the actual Clarifications h3: no inner scroll is
    // needed (everything already fits) and the background page must not move.
    await dialog.getByRole("button", { name: "Go to part", exact: true }).click();
    await expect(clarifications).toBeFocused();
    const after = await page.evaluate(() => {
        const w = window as unknown as Record<string, number>;
        return { calls: w.__a072ScrollByCount, y: window.scrollY, before: w.__a072ScrollY };
    });
    expect(after.calls).toBe(0);
    expect(after.y).toBe(after.before);
    expect(await scroller.evaluate(el => el.scrollTop)).toBe(scrollTopBefore);
    await expect(section).toContainText("Existing synthetic scope.");
    await expect(section).toContainText("SYNTHETIC excluded item.");
    await expect(section).toContainText("SYNTHETIC clarification note.");
    await expect(notIncluded).toBeVisible();
    await expect(clarifications).toBeVisible();
});

/**
 * Whether a run of document text is actually painted inside the dialog: the
 * range's client rect must survive every clipping ancestor up to the dialog.
 * This reads real layout position, so a status counter alone cannot pass.
 */
async function textPainted(dialog: Locator, wanted: string, selector?: string) {
    return dialog.evaluate((dialogEl, { text, selector }) => {
        const root = selector ? dialogEl.querySelector(selector) : dialogEl;
        if (!root) return false;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node) {
            const start = node.textContent!.indexOf(text);
            if (start >= 0) {
                const range = document.createRange();
                range.setStart(node, start);
                range.setEnd(node, start + text.length);
                const viewport = dialogEl.querySelector("[data-web-page-viewport]");
                for (const rect of range.getClientRects()) {
                    if (rect.width <= 0 || rect.height <= 0) continue;
                    let visible = true;
                    for (let el = node.parentElement; el && visible; el = el.parentElement) {
                        const css = getComputedStyle(el);
                        if (/(auto|scroll|hidden|clip)/.test(css.overflowX) || /(auto|scroll|hidden|clip)/.test(css.overflowY)) {
                            const box = el.getBoundingClientRect();
                            if (rect.bottom <= box.top || rect.top >= box.bottom || rect.right <= box.left || rect.left >= box.right) visible = false;
                        }
                        if (el === viewport) break;
                    }
                    if (visible) return true;
                }
            }
            node = walker.nextNode();
        }
        return false;
    }, { text: wanted, selector });
}

const flatten = (text: string | null) => (text ?? "").replace(/\s+/g, " ").trim();

test("paginated web view splits the exact long terms into measured pages that really move on Next and Previous, keeping every word, the response mount and the section view", async ({ page }) => {
    test.setTimeout(90000);
    const { dialog } = await openReader(page, { theme: "system-c", longTerms: true }, { width: 390, height: 844 });
    const termBody = await page.evaluate(() => window.__readerStyledLocal.termBody);
    expect(termBody).toBeTruthy();
    const firstLine = termBody!.split("\n")[0];
    const coverTitle = (await dialog.locator("[data-proposal-document] > header h1").textContent())!;

    // Section view first: the long terms are one retained, exact scrolling block.
    await dialog.getByLabel("Reading page", { exact: true }).selectOption("terms");
    const body = dialog.locator("[data-doc-section='terms'] ol > li > p");
    expect(await body.textContent()).toBe(termBody);
    const scroller = dialog.locator("[data-document-view-scroll]");
    expect(await scroller.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    const sectionStatus = await dialog.getByRole("status").textContent();
    expect(sectionStatus).toContain("Web reading page");

    // Page mode contains the whole proposal, not just the previously selected section.
    await dialog.getByRole("button", { name: "Paginated web view", exact: true }).click({ timeout: 5000 });
    const status = dialog.getByRole("status").filter({ hasText: /^Web page \d+ of \d+/ });
    await expect(status).toContainText(/Web page 1 of \d+/);
    await expect.poll(async () => Number(/Web page 1 of (\d+)/.exec(await status.textContent() ?? "")?.[1])).toBeGreaterThan(1);
    const total = Number(/Web page 1 of (\d+)/.exec(await status.textContent() ?? "")?.[1]);
    // The split is measured from the real layout, asserted not assumed: N > 1.
    expect(total).toBeGreaterThan(1);

    // Page 1 paints the cover, not a counter over the unchanged terms section.
    expect(await textPainted(dialog, coverTitle, "[data-proposal-document] > header h1")).toBe(true);
    expect(await textPainted(dialog, "END OF SYNTHETIC STYLED TERMS")).toBe(false);

    // Every word of the original terms and the response mount are still in the document.
    const article = dialog.locator("[data-proposal-document]");
    expect(flatten(await article.textContent())).toContain(flatten(termBody));
    await expect(dialog.locator("[data-doc-section='response']")).toHaveCount(1);
    await expect(dialog.getByRole("button", { name: /save|send|download|publish|accept/i })).toHaveCount(0);
    // The section-mode controls are restored on explicit return below.

    const next = dialog.getByRole("button", { name: "Next web page", exact: true });
    const previous = dialog.getByRole("button", { name: "Previous web page", exact: true });
    await expect(previous).toBeDisabled();
    const backgroundY = await page.evaluate(() => window.scrollY);

    // Prove the long terms span real distinct painted pages within the complete proposal.
    let firstTermsPage = -1, finalTermsPage = -1;
    for (let webPage = 2; webPage <= total; webPage++) {
        await next.click();
        await expect(status).toContainText(`Web page ${webPage} of ${total}`);
        if (firstTermsPage < 0 && await textPainted(dialog, firstLine)) firstTermsPage = webPage;
        if (await textPainted(dialog, "END OF SYNTHETIC STYLED TERMS")) finalTermsPage = webPage;
    }
    await expect(next).toBeDisabled();
    expect(firstTermsPage).toBeGreaterThan(1);
    expect(finalTermsPage).toBeGreaterThan(firstTermsPage);
    expect(await textPainted(dialog, coverTitle, "[data-proposal-document] > header h1")).toBe(false);

    // Still no action buttons, the full text and the response mount after paging.
    await expect(dialog.getByRole("button", { name: /save|send|download|publish|accept/i })).toHaveCount(0);
    expect(flatten(await article.textContent())).toContain(flatten(termBody));
    await expect(dialog.locator("[data-doc-section='response']")).toHaveCount(1);

    // Previous walks back to the first page and really repaints it.
    for (let webPage = total - 1; webPage >= 1; webPage--) {
        await previous.click();
        await expect(status).toContainText(`Web page ${webPage} of ${total}`);
    }
    await expect(previous).toBeDisabled();
    expect(await textPainted(dialog, coverTitle, "[data-proposal-document] > header h1")).toBe(true);
    expect(await textPainted(dialog, "END OF SYNTHETIC STYLED TERMS")).toBe(false);

    // The page behind the modal never moved during any of the page turns.
    expect(await page.evaluate(() => window.scrollY)).toBe(backgroundY);

    // Section view returns to the retained section controls with the original
    // long terms still complete in one scrolling block.
    await dialog.getByRole("button", { name: "Section view", exact: true }).click();
    await expect(dialog.getByRole("status").filter({ hasText: /Web reading page/ })).toContainText(/Web reading page \d+ of \d+/);
    await expect(dialog.getByLabel("Reading page", { exact: true })).toBeAttached();
    expect(await body.textContent()).toBe(termBody);
    expect(await scroller.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect(dialog.locator("[data-proposal-document]")).toContainText("END OF SYNTHETIC STYLED TERMS");
    await dialog.getByLabel("Reading page", { exact: true }).selectOption("cover");
    await expect(dialog.locator("[data-proposal-document] > header")).toBeVisible();
});
