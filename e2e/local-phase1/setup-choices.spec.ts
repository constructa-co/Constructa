import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalCompanyFixture } from "./company-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");

const EXPECTED_SUGGESTION_LABELS = [
    "General building",
    "Refurbishment & fit-out",
    "Groundworks & civils",
    "Demolition & site preparation",
    "Brickwork & blockwork",
    "Carpentry & joinery",
    "Electrical installation",
    "Plumbing & heating",
    "Ventilation & air conditioning",
    "Roofing",
    "Cladding & facades",
    "Plastering & drylining",
    "Flooring & tiling",
    "Painting & decorating",
    "Glazing & window installation",
    "Landscaping & fencing",
] as const;

const INITIAL_FREE_TEXT = "Custom specialist repairs";
const AFTER_ROOFING_TOGGLE = "Custom specialist repairs, Roofing";
const TRADE_ANSWER_FOR_SAVE = "Exact custom trade answer, Roofing";

const PIXEL_TOLERANCE = 1;
const MIN_CONTROL_HEIGHT = 44;
const CORNER_RADIUS_PX = 8;

let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    leg: "C20_A007_ALIGNED_CHOICES_AND_FREE_TEXT",
    component: "Actual OnboardingClient trade step via company-entry fixture",
    compile: "REUSE build-company.mjs + company-entry.tsx unchanged",
    geometry: "Control/group only; no whole-page height gate",
    tailwindPreflight: "NOT_COMPILED_IN_FIXTURE",
    auth: "NOT_RUN",
    database: "NOT_RUN",
};

async function bootOffline(page: import("@playwright/test").Page) {
    await page.setContent(
        '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local setup choices - simulated saves</title></head><body><p>LOCAL FIXTURE: saves and routing are simulated. No account or database.</p><div id="app"></div></body></html>',
    );
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
}

function suggestionGroup(page: import("@playwright/test").Page) {
    return page.locator('[role="group"][aria-labelledby="setup-work-suggestions"]');
}

async function readSuggestionLabels(page: import("@playwright/test").Page) {
    return suggestionGroup(page).getByRole("button").evaluateAll(buttons =>
        buttons.map(button => {
            const clone = button.cloneNode(true) as HTMLElement;
            clone.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
            return clone.textContent?.replace(/\s+/g, " ").trim() ?? "";
        }),
    );
}

async function assertSuggestionGridGeometry(page: import("@playwright/test").Page, columns: 1 | 2) {
    const group = suggestionGroup(page);
    await expect(page.getByText("Or tap any that fit", { exact: false })).toBeVisible();
    const boxes = await group.getByRole("button").evaluateAll(buttons =>
        buttons.map(button => {
            const rect = button.getBoundingClientRect();
            const style = getComputedStyle(button);
            return {
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top,
                radius: Number.parseFloat(style.borderTopLeftRadius) || 0,
                scrollWidth: button.scrollWidth,
                clientWidth: button.clientWidth,
            };
        }),
    );
    expect(boxes).toHaveLength(16);
    const groupOverflow = await group.evaluate(node => ({
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        height: node.getBoundingClientRect().height,
        columns: getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
    }));
    expect(groupOverflow.columns).toBe(columns);
    expect(groupOverflow.scrollWidth).toBeLessThanOrEqual(groupOverflow.clientWidth + PIXEL_TOLERANCE);

    for (const box of boxes) {
        expect(Math.abs(box.height - boxes[0].height)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
        expect(box.height).toBeGreaterThanOrEqual(MIN_CONTROL_HEIGHT - PIXEL_TOLERANCE);
        expect(Math.abs(box.radius - CORNER_RADIUS_PX)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
        expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + PIXEL_TOLERANCE);
    }

    if (columns === 2) {
        for (let row = 0; row < 8; row += 1) {
            const left = boxes[row * 2];
            const right = boxes[row * 2 + 1];
            expect(Math.abs(left.width - right.width)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
            expect(Math.abs(left.height - right.height)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
            expect(Math.abs(left.top - right.top)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
            if (row > 0) {
                const prevLeft = boxes[(row - 1) * 2];
                const prevRight = boxes[(row - 1) * 2 + 1];
                expect(Math.abs(left.left - prevLeft.left)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
                expect(Math.abs(right.left - prevRight.left)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
            }
        }
    } else {
        const referenceWidth = boxes[0].width;
        for (const [index, box] of boxes.entries()) {
            expect(Math.abs(box.width - referenceWidth)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
            expect(Math.abs(box.left - boxes[0].left)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
            if (index > 0) expect(box.top).toBeGreaterThan(boxes[index - 1].top);
        }
    }
    await test.info().attach("control-geometry", {
        body: JSON.stringify({ columns, group: groupOverflow, boxes }), contentType: "application/json",
    });
}

async function assertRoofingToggle(
    page: import("@playwright/test").Page,
    mode: "click" | "keyboard",
) {
    const work = page.locator("#setup-work");
    const roofing = suggestionGroup(page).getByRole("button", { name: "Roofing", exact: true });
    await work.fill(INITIAL_FREE_TEXT);
    if (mode === "click") {
        await roofing.click();
    } else {
        await roofing.focus();
        await page.keyboard.press("Space");
    }
    await expect(work).toHaveValue(AFTER_ROOFING_TOGGLE);
    await expect(roofing).toHaveAttribute("aria-pressed", "true");
    if (mode === "click") {
        await roofing.click();
    } else {
        await roofing.focus();
        await page.keyboard.press("Space");
    }
    await expect(work).toHaveValue(INITIAL_FREE_TEXT);
    await expect(roofing).toHaveAttribute("aria-pressed", "false");
    expect(await page.evaluate(() => window.__phase1Local.calls)).toEqual([]);
    expect(await page.evaluate(() => window.__phase1Local.navigation)).toEqual([]);
}

async function assertReadablePhoneChoices(page: import("@playwright/test").Page, compact: boolean) {
    const group = suggestionGroup(page);
    const before = await group.evaluate(node => node.getBoundingClientRect().height);
    const longest = group.getByRole("button", { name: "Ventilation & air conditioning", exact: true });
    await longest.click();
    await expect(longest).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#setup-work")).toHaveValue(`${INITIAL_FREE_TEXT}, Ventilation & air conditioning`);
    await assertSuggestionGridGeometry(page, compact ? 2 : 1);
    const labels = await group.getByRole("button").evaluateAll(buttons => buttons.map(button => {
        const box = button.getBoundingClientRect();
        const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
        const textBoxes: { left: number; right: number; top: number; bottom: number }[] = [];
        while (walker.nextNode()) {
            if (!walker.currentNode.textContent?.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            for (const rect of range.getClientRects()) textBoxes.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
        }
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, textBoxes };
    }));
    for (const label of labels) {
        expect(label.textBoxes.length).toBeGreaterThan(0);
        for (const box of label.textBoxes) {
            expect(box.left).toBeGreaterThanOrEqual(label.left - PIXEL_TOLERANCE);
            expect(box.right).toBeLessThanOrEqual(label.right + PIXEL_TOLERANCE);
            expect(box.top).toBeGreaterThanOrEqual(label.top - PIXEL_TOLERANCE);
            expect(box.bottom).toBeLessThanOrEqual(label.bottom + PIXEL_TOLERANCE);
        }
    }
    const selected = await group.evaluate(node => node.getBoundingClientRect().height);
    // Compare with the accepted C20 measured 390px single-column baseline,
    // not an arbitrary fixed height cap or a full-page acceptance claim.
    if (compact) {
        expect(before).toBeLessThan(794);
        expect(selected).toBeLessThan(794);
    }
    await test.info().attach("phone-reflow", { body: JSON.stringify({ viewport: page.viewportSize(), compact, old390GroupHeight: 794, before, selected, labels }), contentType: "application/json" });
    await page.screenshot({ path: path.join(output, `phone-choices-${page.viewportSize()!.width}.png`), fullPage: true });
    await longest.click();
    await expect(page.locator("#setup-work")).toHaveValue(INITIAL_FREE_TEXT);
    expect(await page.evaluate(() => window.__phase1Local.calls)).toEqual([]);
    expect(await page.evaluate(() => window.__phase1Local.navigation)).toEqual([]);
}

async function assertRefusedTradeSaveThenRetry(page: import("@playwright/test").Page) {
    const work = page.locator("#setup-work");
    const roofing = suggestionGroup(page).getByRole("button", { name: "Roofing", exact: true });
    await work.fill("Exact custom trade answer");
    await roofing.click();
    await expect(work).toHaveValue(TRADE_ANSWER_FOR_SAVE);
    await expect(roofing).toHaveAttribute("aria-pressed", "true");

    await page.evaluate(() => {
        window.__phase1Local.nextSave = "refused";
    });
    await page.getByRole("button", { name: "Save and continue", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Local fixture: save not acknowledged.");
    await expect(work).toHaveValue(TRADE_ANSWER_FOR_SAVE);
    await expect(roofing).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("What kind of work do you do?", { exact: true })).toBeVisible();

    const afterRefusal: Pick<LocalCompanyFixture, "calls" | "profile" | "navigation"> = await page.evaluate(() => ({
        calls: window.__phase1Local.calls,
        profile: window.__phase1Local.profile,
        navigation: window.__phase1Local.navigation,
    }));
    expect(afterRefusal.calls).toEqual([{ step: "trade", businessType: TRADE_ANSWER_FOR_SAVE }]);
    expect(afterRefusal.profile.business_type).toBeUndefined();
    expect(afterRefusal.navigation).toEqual([]);

    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByLabel("Business or trading name")).toBeVisible();
    const afterRetry: Pick<LocalCompanyFixture, "calls" | "profile"> = await page.evaluate(() => ({
        calls: window.__phase1Local.calls,
        profile: window.__phase1Local.profile,
    }));
    expect(afterRetry.calls).toEqual([
        { step: "trade", businessType: TRADE_ANSWER_FOR_SAVE },
        { step: "trade", businessType: TRADE_ANSWER_FOR_SAVE },
    ]);
    expect(afterRetry.profile.business_type).toBe(TRADE_ANSWER_FOR_SAVE);
}

test.beforeEach(async ({ page, context }) => {
    requests = [];
    pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await bootOffline(page);
});

test.afterEach(async ({}, testInfo) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await testInfo.attach("scope", { body: JSON.stringify({ ...scope, requests, pageErrors }), contentType: "application/json" });
});

test.describe("desktop 1280x900", () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test("two-column aligned suggestions, free-text toggle, and refused trade save retry", async ({ page }) => {
        await page.locator("#setup-work").fill(INITIAL_FREE_TEXT);
        expect(await readSuggestionLabels(page)).toEqual([...EXPECTED_SUGGESTION_LABELS]);
        await assertSuggestionGridGeometry(page, 2);
        await assertRoofingToggle(page, "click");
        await assertRefusedTradeSaveThenRetry(page);
        expect(await page.evaluate(() => window.__phase1Local.calls.length)).toBe(2);
    });
});

test.describe("phone 390x844", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("compact two-column aligned suggestions, readable labels, keyboard toggle, and refused trade save retry", async ({ page }) => {
        await page.locator("#setup-work").fill(INITIAL_FREE_TEXT);
        expect(await readSuggestionLabels(page)).toEqual([...EXPECTED_SUGGESTION_LABELS]);
        await assertSuggestionGridGeometry(page, 2);
        await assertReadablePhoneChoices(page, true);
        await assertRoofingToggle(page, "keyboard");
        await assertRefusedTradeSaveThenRetry(page);
        expect(await page.evaluate(() => window.__phase1Local.calls.length)).toBe(2);
    });
});

test.describe("narrow phone 320x844", () => {
    test.use({ viewport: { width: 320, height: 844 } });

    test("retains readable single-column fallback, all choices, free text and refused save retry", async ({ page }) => {
        await page.locator("#setup-work").fill(INITIAL_FREE_TEXT);
        expect(await readSuggestionLabels(page)).toEqual([...EXPECTED_SUGGESTION_LABELS]);
        await assertSuggestionGridGeometry(page, 1);
        await assertReadablePhoneChoices(page, false);
        await assertRoofingToggle(page, "keyboard");
        await assertRefusedTradeSaveThenRetry(page);
        expect(await page.evaluate(() => window.__phase1Local.calls.length)).toBe(2);
    });
});
