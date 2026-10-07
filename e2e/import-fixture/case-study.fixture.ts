import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import { keyboardDriver, pointerDriver, type FocusRecord } from "../support/driver";

/**
 * The case-study wording suggestion, on the real screen, over the fixture
 * harness. Only the suggestion panel and its notice are measured for size
 * and accessibility: the rest of this screen is older, was not changed here,
 * and is not claimed to meet those checks.
 */
const EVIDENCE = process.env.E2E_EVIDENCE === "1";
const DIR = path.resolve(EVIDENCE ? "docs/evidence/cohort-ai-bounds" : "test-results/import-fixture/case-study");
const HARNESS = "/admin-e2e-import-fixture/case-study";

const OWN_DELIVERED = "we refitted the kitchen moved the wall and replastered throughout";
const OWN_VALUE = "family could stay in the house the whole time";
const BETTER_DELIVERED = "We refitted the kitchen, moved the wall and replastered throughout.";
const BETTER_VALUE = "The family could stay in the house the whole time.";

test("Case-study wording: a suggestion waits for a decision and never replaces text by arriving", async ({ page, context, hasTouch }, testInfo) => {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    const focusLog: FocusRecord[] = [];
    const use = keyboardRun ? keyboardDriver(page, focusLog) : pointerDriver(Boolean(hasTouch));
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const results: Record<string, unknown> = { project, viewport, input: keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", outcome: "failed", checkpoints: [] as unknown[] };
    let shot = 0;

    // Nothing but this machine may be contacted.
    const outside: string[] = [];
    await context.route((url) => url.hostname !== "127.0.0.1", async (route) => {
        outside.push(new URL(route.request().url()).host);
        await route.abort();
    });

    const run = `case-study-${project}-${Date.now()}`;
    const control = async (op: Record<string, unknown> = {}, name = run) => (await page.request.post(`${HARNESS}/state?run=${name}`, { data: op })).json();
    const ask = page.getByRole("button", { name: /AI Enhance|Enhancing/ });
    const delivered = page.getByLabel("What We Delivered", { exact: true });
    const value = page.getByLabel("Value Added", { exact: true });
    const panel = (section: string) => page.locator(`[data-case-study-suggestion="${section}"]`);
    const notice = page.locator("[data-case-study-notice]");
    const useIt = (scope: Locator) => scope.getByRole("button", { name: /Use this wording|Replace what I have now with this/ });
    const keep = (scope: Locator) => scope.getByRole("button", { name: "Keep my own" });

    /** Size, contrast and overflow of the suggestion panel and its notice only. */
    const checkpoint = async (name: string) => {
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const small = await page.locator("[data-case-study-suggestion] button").evaluateAll((buttons) => buttons
            .map((button) => ({ name: (button.textContent ?? "").trim(), ...(({ width, height }) => ({ width: Math.round(width), height: Math.round(height) }))(button.getBoundingClientRect()) }))
            .filter((size) => size.width < 44 || size.height < 44));
        const pastEdge = await page.locator("[data-case-study-suggestion], [data-case-study-notice]").evaluateAll((elements) => elements
            .filter((element) => !element.classList.contains("sr-only") && element.getBoundingClientRect().right > window.innerWidth + 1).length);
        const axe = await new AxeBuilder({ page }).include("[data-case-study-suggestion]").include("[data-case-study-notice]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const blocking = axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")).map((violation) => `${violation.id}: ${violation.help}`);
        let screenshot: string | null = null;
        if (EVIDENCE && ["desktop", "phone"].includes(project)) {
            shot += 1;
            screenshot = `${String(shot).padStart(2, "0")}-${name}-${viewport.width}x${viewport.height}.jpg`;
            mkdirSync(DIR, { recursive: true });
            await page.screenshot({ path: path.join(DIR, screenshot), type: "jpeg", quality: 55, scale: "css", animations: "disabled", fullPage: true });
        }
        (results.checkpoints as unknown[]).push({ name, sidewaysOverflowPx: sideways, undersizedPanelButtons: small, panelPastViewport: pastEdge, blockingAccessibility: blocking, screenshot });
        expect.soft(sideways, `${name}: the page must not scroll sideways`).toBeLessThanOrEqual(1);
        expect.soft(small, `${name}: panel buttons must be at least 44 by 44 px`).toEqual([]);
        expect.soft(pastEdge, `${name}: the panel must stay inside the viewport`).toBe(0);
        expect.soft(blocking, `${name}: no critical or serious accessibility violation in the panel`).toEqual([]);
    };

    try {
        await page.goto(`${HARNESS}?run=${run}`);
        await expect(delivered).toHaveValue(OWN_DELIVERED);

        // 1. A suggestion arrives. Nothing in the form changes.
        await control({ reply: { reply: { whatWeDelivered: BETTER_DELIVERED, valueAdded: BETTER_VALUE } } });
        await use.activate(ask);
        await expect(panel("whatWeDelivered")).toContainText(BETTER_DELIVERED);
        await expect(panel("valueAdded")).toContainText(BETTER_VALUE);
        await expect(delivered, "arriving must not replace the contractor's text").toHaveValue(OWN_DELIVERED);
        await expect(value).toHaveValue(OWN_VALUE);
        await expect(notice).toContainText("Nothing changes unless you choose to use it");
        await expect(panel("whatWeDelivered")).toHaveAttribute("data-state", "fresh");
        await checkpoint("suggestion-waiting");

        // 2. Use one, keep the other. Each is its own decision.
        await use.activate(useIt(panel("whatWeDelivered")));
        await expect(delivered).toHaveValue(BETTER_DELIVERED);
        await expect(panel("whatWeDelivered")).toHaveCount(0);
        await expect(value, "the other section is untouched until decided").toHaveValue(OWN_VALUE);
        await use.activate(keep(panel("valueAdded")));
        await expect(value).toHaveValue(OWN_VALUE);
        await expect(panel("valueAdded")).toHaveCount(0);
        let state = await control();
        expect(state.providerCalls, "one press is one call for both sections").toBe(1);
        expect(state.attempts).toEqual(["ok"]);

        // 3. The contractor edits while the request is on its way. The edit survives, and the suggestion says it is out of date.
        await control({ delayMs: 1500, reply: { reply: { whatWeDelivered: "We refitted the kitchen, moved the wall and replastered throughout the house.", valueAdded: BETTER_VALUE } } });
        await use.activate(ask);
        await expect(ask, "a second press is not possible while one is in flight").toBeDisabled();
        const edited = `${BETTER_DELIVERED} We also laid a new floor.`;
        await use.fill(delivered, edited);
        await expect(panel("whatWeDelivered")).toBeVisible();
        await expect(delivered, "text typed during the request is kept").toHaveValue(edited);
        await expect(panel("whatWeDelivered")).toHaveAttribute("data-state", "stale");
        await expect(panel("whatWeDelivered")).toContainText("You have changed this since you asked");
        await expect(useIt(panel("whatWeDelivered"))).toHaveText("Replace what I have now with this");
        state = await control({ delayMs: 0 });
        expect(state.providerCalls, "still one call for that press").toBe(2);
        expect(state.sent[1].whatWeDelivered, "what was sent is what was there at the press").toBe(BETTER_DELIVERED);
        await checkpoint("suggestion-out-of-date");
        await use.activate(keep(panel("whatWeDelivered")));
        await expect(delivered).toHaveValue(edited);
        await use.activate(keep(panel("valueAdded")));

        // 4. A reply that adds a claim is dropped: nothing to use, an honest message, text unchanged.
        await control({ reply: { reply: { whatWeDelivered: "Award-winning kitchen refit finished in 4 weeks.", valueAdded: BETTER_VALUE } } });
        await use.activate(ask);
        await expect(notice).toContainText("Nothing has been changed");
        await expect(page.locator("[data-case-study-suggestion]")).toHaveCount(0);
        await expect(delivered).toHaveValue(edited);
        await expect(page.getByText("Case study enhanced")).toHaveCount(0);
        await checkpoint("suggestion-dropped");

        // 5. The allowance is used up: no call, said plainly.
        await control({ allowance: "used-up", reply: { reply: { whatWeDelivered: BETTER_DELIVERED, valueAdded: BETTER_VALUE } } });
        const before = (await control()).providerCalls;
        await use.activate(ask);
        await expect(notice).toContainText("as much as is allowed for now");
        state = await control({ allowance: "normal" });
        expect(state.providerCalls).toBe(before);
        expect(state.attempts).toEqual(["ok", "ok", "rejected:tripwire"]);

        // 6. As the application ships it: switched off. The button says so and reaches nothing.
        const off = `off-${run}`;
        await page.goto(`${HARNESS}?run=${off}`);
        await use.activate(ask);
        await expect(notice).toContainText("isn't switched on for this yet");
        await expect(delivered).toHaveValue(OWN_DELIVERED);
        const offState = await control({}, off);
        expect(offState.providerCalls).toBe(0);
        expect(offState.attempts).toEqual([]);
        await checkpoint("switched-off");

        // The marketing analytics tags are the only outside hosts the page asks for, and they are blocked.
        expect(outside.filter((host) => !["plausible.io", "www.clarity.ms"].includes(host)), "no outside host was contacted").toEqual([]);
        if (keyboardRun) {
            const panelControls = focusLog.filter((entry) => /Use this wording|Replace what I have now|Keep my own|AI Enhance/.test(entry.control));
            expect(panelControls.length).toBeGreaterThan(0);
            expect(panelControls.filter((entry) => !entry.visibleFocus).map((entry) => entry.control), "the suggestion's controls show focus").toEqual([]);
            results.keyboard = { controlsReached: focusLog.length, panelControlsWithoutVisibleFocus: [] };
        }
        results.provider = { calls: state.providerCalls, attempts: state.attempts, charged: state.charged };
        results.blockedThirdPartyHosts = Array.from(new Set(outside));
        results.outcome = testInfo.errors.length === 0 ? "passed" : "failed";
    } finally {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(path.join(DIR, `results-case-study-${project}.json`), `${JSON.stringify(results, null, 2)}\n`);
    }
});
