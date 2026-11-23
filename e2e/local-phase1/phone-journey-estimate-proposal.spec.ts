/**
 * CON-043 remaining scope: synthetic offline phone evidence for estimate add-line +
 * working total + proposal review at 360/390/430. Uses two existing fixture compiles
 * (existing-estimate-add + proposal-view); programme leg excluded.
 */

import { expect, test, type Locator, type Page, type BrowserContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());
const estimateOut = process.env.CONSTRUCTA_LOCAL_ESTIMATE_OUTPUT!;
const proposalOut = process.env.CONSTRUCTA_LOCAL_PROPOSAL_OUTPUT!;
const evidenceRoot = process.env.CONSTRUCTA_PHONE_EVIDENCE_DIR ?? path.join(repoRoot, "docs/evidence/con-043-phone-journey-evidence");
mkdirSync(evidenceRoot, { recursive: true });

const estimateBundle = readFileSync(path.join(estimateOut, "components.js"), "utf8");
const estimateCss = readFileSync(path.join(estimateOut, "components.css"), "utf8");
const estimateManifest = JSON.parse(readFileSync(path.join(estimateOut, "source-manifest.json"), "utf8")) as {
    sourceHashes: Record<string, string>;
    scope: string;
};
const proposalBundle = readFileSync(path.join(proposalOut, "components.js"), "utf8");
const proposalCss = readFileSync(path.join(proposalOut, "components.css"), "utf8");
const proposalManifest = JSON.parse(readFileSync(path.join(proposalOut, "source-manifest.json"), "utf8")) as {
    sourceHashes: Record<string, string>;
    scope: string;
};

const PHONE_VIEWPORTS = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
] as const;

const RETAINED_A = "line-retained-excavation";
const RETAINED_B = "line-retained-fascia";
const NEW_DESC = "TEST DATA - Phone journey added line";
const NEW_ACTIVITY = "Rainwater";
const CONTRACT_BEFORE = "£180.00";
const CONTRACT_AFTER = "£230.00";
const PREPARE = "1. Prepare proposal";
const REVIEW = "2. Review document";

const scope = {
    acceptance: "SYNTHETIC_OFFLINE_ONLY — not hosted Constructa acceptance",
    programmePhoneList: "NOT_RUN (shipped PR216 at 611d767)",
    estimateUnitFullWidth: "NOT_RUN (shipped #203)",
    advancedDockPadding: "NOT_RUN (shipped CON-032/181)",
    estimateFixture: "existing-estimate-add compile",
    proposalFixture: "proposal-view compile (Prepare/Review controls)",
    saveLine: "MOCK refuse/ack label per existing-estimate-add fixture",
    authDatabaseHosted: "NOT_RUN",
};

const fixturePage = async (page: Page, context: BrowserContext, bundle: string, css: string, label: string) => {
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent(`<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>CON-043 ${label} — LOCAL FIXTURE</title></head><body><p>LOCAL FIXTURE: synthetic offline only; not hosted acceptance.</p><div id="app"></div></body></html>`);
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
};

const fillNewLineDraft = async (page: Page) => {
    await page.getByRole("button", { name: "Add a price line", exact: true }).click();
    const showQty = page.getByRole("button", { name: "Show quantities and rates", exact: true });
    if (await showQty.isVisible()) await showQty.click();
    const qtyMode = page.getByRole("button", { name: "Quantity and rate", exact: true });
    if (await qtyMode.isVisible()) await qtyMode.click();
    await page.getByLabel("New work description").fill(NEW_DESC);
    await page.locator("[data-new-price-activity] summary").click();
    await page.getByLabel("Activity for this new line").fill(NEW_ACTIVITY);
    await page.getByLabel("New priced quantity").fill("2");
    await page.getByLabel("New priced unit").selectOption("nr");
    await page.getByLabel("New unit rate in pounds").fill("25");
};

async function expectControlReachable(page: Page, locator: Locator) {
    await locator.scrollIntoViewIfNeeded();
    const reachable = await locator.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const cx = rect.left + rect.width / 2;
        const cy = Math.min(rect.bottom - 2, rect.top + rect.height / 2);
        const hit = document.elementFromPoint(cx, cy);
        return hit === el || (hit !== null && el.contains(hit));
    });
    expect(reachable).toBe(true);
}

for (const viewport of PHONE_VIEWPORTS) {
    test(`CON-043 estimate @${viewport.width}px: add line, working total, dock must not hide Save line`, async ({ page, context }, info) => {
        const requests: string[] = [];
        const pageErrors: string[] = [];
        page.on("request", r => requests.push(r.url()));
        page.on("pageerror", e => pageErrors.push(e.message));

        await page.setViewportSize(viewport);
        await fixturePage(page, context, estimateBundle, estimateCss, "estimate");
        await page.evaluate(() => {
            window.__existingEstimateAddLocal.script = { saveLine: ["refuse", "ack"] };
        });

        const saveLine = page.getByRole("button", { name: "Save line", exact: true });
        const dock = page.locator("[data-running-total]");
        const inViewTotal = dock.locator("[data-running-total-values] [data-in-view-contract-sum]");

        await expect(page.locator(`[data-price-line="${RETAINED_A}"]`)).toBeVisible();
        await expect(page.locator(`[data-price-line="${RETAINED_B}"]`)).toBeVisible();
        await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_BEFORE);
        await expect(inViewTotal).toHaveText(CONTRACT_BEFORE);

        await fillNewLineDraft(page);
        await saveLine.scrollIntoViewIfNeeded();
        await saveLine.click({ trial: true });
        await saveLine.click();
        await expect(page.getByRole("alert")).toContainText("price save not acknowledged");
        const tryAgain = page.getByRole("button", { name: "Try again", exact: true });
        await tryAgain.scrollIntoViewIfNeeded();
        await tryAgain.click({ trial: true });
        await tryAgain.click();
        await expect(page.locator("[data-price-line]")).toHaveCount(3);
        await expect(page.locator("[data-contract-sum]")).toHaveText(CONTRACT_AFTER);
        await expect(inViewTotal).toHaveText(CONTRACT_AFTER);

        const addLine = page.getByRole("button", { name: "Add a price line", exact: true });
        await addLine.scrollIntoViewIfNeeded();
        await addLine.click({ trial: true });

        await page.screenshot({
            path: path.join(evidenceRoot, `con043-phone-${viewport.width}-estimate-total.png`),
            fullPage: true,
        });

        expect(requests).toEqual([]);
        expect(pageErrors).toEqual([]);
        await info.attach("estimate-scope", { body: JSON.stringify({ viewport, scope, requests, pageErrors }), contentType: "application/json" });
    });

    test(`CON-043 proposal @${viewport.width}px: Prepare and Review document controls reachable`, async ({ page, context }, info) => {
        const requests: string[] = [];
        const pageErrors: string[] = [];
        page.on("request", r => requests.push(r.url()));
        page.on("pageerror", e => pageErrors.push(e.message));

        await page.setViewportSize(viewport);
        await fixturePage(page, context, proposalBundle, proposalCss, "proposal");

        const reviewTab = page.getByRole("button", { name: REVIEW, exact: true });
        await expect(page.getByRole("button", { name: PREPARE, exact: true })).toHaveAttribute("aria-pressed", "true");
        await expectControlReachable(page, reviewTab);
        const bounds = await reviewTab.boundingBox();
        expect(bounds!.width).toBeGreaterThan(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);

        await reviewTab.click();
        await expect(page.locator("#proposal-final-review")).toBeVisible();
        await expect(page.locator("[data-proposal-document]")).toBeVisible();

        await page.screenshot({
            path: path.join(evidenceRoot, `con043-phone-${viewport.width}-proposal-review.png`),
            fullPage: true,
        });

        expect(requests).toEqual([]);
        expect(pageErrors).toEqual([]);
        await info.attach("proposal-scope", { body: JSON.stringify({ viewport, scope, requests, pageErrors }), contentType: "application/json" });
    });
}

test.afterAll(() => {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
    const payload = {
        recordedAt: new Date().toISOString(),
        registerId: "CON-043",
        branch,
        head,
        base: "611d767df409a20d17a0e818247d5fece3ebc059",
        composerModel: "composer-2.5-fast=false",
        viewports: PHONE_VIEWPORTS.map(v => v.width),
        compileOutputs: {
            estimate: estimateOut,
            proposal: proposalOut,
        },
        estimateBundleScope: estimateManifest.scope,
        proposalBundleScope: proposalManifest.scope,
        sourceHashes: {
            estimate: Object.entries(estimateManifest.sourceHashes).map(([path, sha256]) => ({ path, sha256 })),
            proposal: Object.entries(proposalManifest.sourceHashes).map(([path, sha256]) => ({ path, sha256 })),
        },
        limitations: [
            "Two-legged offline fixture (estimate then proposal-view), not one continuous routed journey.",
            "Synthetic offline Playwright on about:blank; not Auth, PostgREST, Next routing or hosted URL.",
            "Programme phone date list accepted at 611d767 — not re-tested here.",
            "MOCK saveLine refusal/ack only on estimate leg; proposal leg uses existing synthetic context.",
        ],
        scope,
        playwright: { reportPath: path.join(estimateOut, "browser-results.json"), note: "The final reporter writes this after capture; read its completed result separately." },
    };
    const body = JSON.stringify(payload, null, 2);
    writeFileSync(path.join(evidenceRoot, "con043-phone-journey-evidence.json"), JSON.stringify({
        ...payload,
        evidenceManifestSha256: createHash("sha256").update(body).digest("hex"),
    }, null, 2));
});