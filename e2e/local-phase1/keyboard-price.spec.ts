import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalKeyboardPriceFixture } from "./keyboard-price-entry";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const ESTIMATE = "local-keyboard-price-estimate";
const RETAINED_A = "line-keyboard-retained-a";
const RETAINED_B = "line-keyboard-retained-b";
const NEW_DESC = "TEST DATA - Keyboard added line";
const CONTRACT_BEFORE = "£180.00";
const CONTRACT_AFTER = "£230.00";
const MOD = process.platform === "darwin" ? "Meta" : "Control";

const scope = {
    pricing: "REAL_EstimateClient inline new-line keyboard handlers (Tab/Shift+Tab/Meta|Ctrl+Enter)",
    saveLine: "MOCK append on existing estimateId from submitted args",
    mouseCases: "NOT_THIS_LEG (C5 edit/remove, C7 mouse add)",
    unitHandlerTests: "NOT_SUBSTITUTE (see price-entry-continuation.test.tsx)",
    authDatabaseHosted: "NOT_RUN",
};

type Snapshot = Pick<LocalKeyboardPriceFixture, "estimates" | "priceSaveAttempts" | "priceSaveAcknowledgements" | "unexpectedWrites">;

const snapshot = (page: Page): Promise<Snapshot> => page.evaluate(() => {
    const f = window.__keyboardPriceLocal;
    return {
        estimates: structuredClone(f.estimates),
        priceSaveAttempts: f.priceSaveAttempts,
        priceSaveAcknowledgements: f.priceSaveAcknowledgements,
        unexpectedWrites: f.unexpectedWrites,
    };
});

const activeId = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.id ?? "");

const tabUntil = async (page: Page, match: (id: string) => boolean, max = 120, backwards = false) => {
    for (let step = 0; step < max; step += 1) {
        const id = await activeId(page);
        if (match(id)) return id;
        await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
    }
    throw new Error(`tabUntil: no match after ${max} tabs`);
};

const tabUntilLabel = async (page: Page, label: string | RegExp, max = 120) => {
    for (let step = 0; step < max; step += 1) {
        const name = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || !el.matches("button,a,input,select,textarea,summary")) return "";
            const labelled = el.getAttribute("aria-label") ?? "";
            const text = el.textContent?.trim() ?? "";
            return `${labelled} ${text}`.trim();
        });
        if (typeof label === "string" ? name.includes(label) : label.test(name)) return;
        await page.keyboard.press("Tab");
    }
    throw new Error(`tabUntilLabel: ${String(label)} not reached`);
};

test.beforeEach(async ({ page, context }) => {
    requests = [];
    pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local keyboard price workspace fixture</title></head><body><p>LOCAL FIXTURE: keyboard-only Tab and Command/Ctrl+Enter Save-and-add-next on an estimate with retained lines. No pointer path.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, modifier: MOD, ...await snapshot(page), requests, pageErrors }), contentType: "application/json" });
});

test("Tab through inline new-line fields; Command/Ctrl+Enter Save-and-add-next keeps retained rows and opens a fresh draft", async ({ page }) => {
    const before = await snapshot(page);
    await expect(page.locator(`[data-price-line="${RETAINED_A}"]`)).toBeVisible();
    await expect(page.locator(`[data-price-line="${RETAINED_B}"]`)).toBeVisible();
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_BEFORE);

    await page.evaluate(() => { document.getElementById("app")?.setAttribute("tabindex", "-1"); document.getElementById("app")?.focus(); });
    await tabUntilLabel(page, "Show quantities and rates");
    await page.keyboard.press("Enter");
    await tabUntilLabel(page, "Add a price line");
    await page.keyboard.press("Enter");
    await expect(page.locator("[data-new-price-line]")).toBeVisible();

    await tabUntilLabel(page, "Quantity and rate");
    await page.keyboard.press("Enter");

    await tabUntil(page, id => id === "new-line-description");
    await page.keyboard.type(NEW_DESC);
    await page.keyboard.press("Shift+Tab");
    await expect.poll(() => activeId(page)).not.toBe("new-line-description");
    await tabUntil(page, id => id === "new-line-description");

    await tabUntil(page, id => id === "new-line-quantity");
    await page.keyboard.type("2");
    await tabUntil(page, id => id === "new-line-rate");
    await page.keyboard.type("25");

    await page.keyboard.press(`${MOD}+Enter`);
    await expect(page.locator("[data-new-price-line]")).toBeVisible();
    await expect(page.locator(`[data-price-line="${RETAINED_A}"]`)).toContainText("TEST DATA - Keyboard retained A");
    await expect(page.locator(`[data-price-line="${RETAINED_B}"]`)).toContainText("TEST DATA - Keyboard retained B");
    await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_AFTER);
    await expect.poll(() => activeId(page)).toBe("new-line-description");
    await expect(page.locator("#new-line-description")).toHaveValue("");

    const after = await snapshot(page);
    expect(after.priceSaveAcknowledgements).toBe(1);
    expect(after.priceSaveAttempts).toHaveLength(1);
    expect(after.priceSaveAttempts[0]).toMatchObject({
        projectId: "local-keyboard-price-job",
        estimateId: ESTIMATE,
        line: { description: NEW_DESC, quantity: 2, unit: "m2", unit_rate: 25 },
    });
    expect(after.estimates[0].estimate_lines.filter(l => l.id === RETAINED_A || l.id === RETAINED_B))
        .toEqual(before.estimates[0].estimate_lines);
    const saved = after.estimates[0].estimate_lines.find(l => l.description === NEW_DESC);
    expect(saved).toMatchObject({ line_total: 50, trade_section: "General" });
    expect(after.unexpectedWrites).toEqual([]);

    await page.screenshot({ path: path.join(output, "keyboard-price-save-and-add-next.png"), fullPage: true });
});
