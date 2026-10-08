import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { keyboardDriver, pointerDriver, type FocusRecord } from "../support/driver";

/**
 * The older case-study editor's save, on the real screen, over the fixture
 * harness. The save here is an in-memory stand-in that returns the outcomes
 * the real action can return; the real action is covered by unit tests.
 *
 * This shows HONEST saving: what the editor says, what it keeps, and what it
 * sends. It is NOT about two tabs. The last step shows, on purpose, that a
 * stale editor still overwrites a newer list and is told "saved": that fault
 * is still open and nothing here closes it.
 *
 * No sign-in, no Supabase, no network. Not an authenticated hosted run. The
 * phone project is a phone-sized viewport, not a real phone.
 */
const EVIDENCE = process.env.E2E_EVIDENCE === "1";
const DIR = path.resolve(EVIDENCE ? "docs/evidence/legacy-case-editor-honest-save" : "test-results/import-fixture/case-study-save");
const HARNESS = "/admin-e2e-import-fixture/case-study";
const OWN = "we refitted the kitchen moved the wall and replastered throughout";
const UNKNOWN = "We couldn't confirm whether that was saved. Your changes are still on this page. Saving again sends this whole list and replaces whatever is stored, including anything changed in another tab or window.";

test("Older case-study editor: says saved only when it was, keeps what was typed, and still does not protect against another tab", async ({ page, context, hasTouch }, testInfo) => {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    const focusLog: FocusRecord[] = [];
    const use = keyboardRun ? keyboardDriver(page, focusLog) : pointerDriver(Boolean(hasTouch));
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const results: Record<string, unknown> = { project, viewport, input: keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", outcome: "failed", steps: [] as string[] };
    let shot = 0;

    const outside: string[] = [];
    await context.route((url) => url.hostname !== "127.0.0.1", async (route) => {
        outside.push(new URL(route.request().url()).host);
        await route.abort();
    });

    const run = `save-${project}-${Date.now()}`;
    const control = async (op: Record<string, unknown> = {}) => (await page.request.post(`${HARNESS}/state?run=${run}`, { data: op })).json();
    const delivered = page.getByLabel("What We Delivered", { exact: true });
    const saveButton = page.getByRole("button", { name: /^(Save All Case Studies|Try again|Saving\.\.\.)$/ });
    const status = page.locator("[data-case-studies-save-status]");
    const storedText = async () => ((await control()).stored as Array<{ whatWeDelivered: string }>)[0]?.whatWeDelivered;
    const wouldWarnOnLeaving = (target: Page) => target.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
    const done = async (name: string) => {
        (results.steps as string[]).push(name);
        if (EVIDENCE && ["desktop", "phone"].includes(project)) {
            shot += 1;
            mkdirSync(DIR, { recursive: true });
            await page.screenshot({ path: path.join(DIR, `${String(shot).padStart(2, "0")}-${name}-${viewport.width}x${viewport.height}.jpg`), type: "jpeg", quality: 50, scale: "css", animations: "disabled", fullPage: true });
        }
    };

    try {
        // ── 1. Nothing changed: nothing is sent ──
        await page.goto(`${HARNESS}?run=${run}`);
        await expect(delivered).toHaveValue(OWN);
        expect(await wouldWarnOnLeaving(page)).toBe(false);
        await use.activate(saveButton);
        await expect(status).toHaveText("There's nothing new to save.");
        expect((await control()).saveCalls, "an untouched save sent nothing").toBe(0);
        await done("nothing-to-save");

        // ── 2. A change is unsaved until a save is confirmed ──
        await use.fill(delivered, "First edit.");
        await expect(status).toHaveText("Changes not saved.");
        expect(await wouldWarnOnLeaving(page), "reload asks first").toBe(true);
        await use.activate(saveButton);
        await expect(status).toHaveText("Saved.");
        let state = await control();
        expect(state.saveCalls).toBe(1);
        expect(state.stored[0].whatWeDelivered).toBe("First edit.");
        expect(state.lastSent[0].legacyNote, "a key the editor does not know about was sent back unchanged").toBe("kept exactly");
        expect(state.lastSent[0].valueAdded).toBe("family could stay in the house the whole time");
        expect(await wouldWarnOnLeaving(page)).toBe(false);

        // ── 3. Pressed several times at once: one request ──
        await use.fill(delivered, "Second edit.");
        await control({ saveDelayMs: 1500 });
        await saveButton.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click(); });
        await expect(status).toHaveText("Saved.");
        expect((await control()).saveCalls, "three presses, one save").toBe(2);

        // ── 4. A slow answer: what is typed meanwhile is kept, and is NOT covered by "saved" ──
        await use.fill(delivered, "Sent to be saved.");
        await control({ saveDelayMs: 5000 });
        await use.activate(saveButton);
        await expect(status).toHaveText("Saving…");
        await use.fill(delivered, "Sent to be saved. Then more, typed while saving.");
        await expect(status).toHaveText("Changes not saved.", { timeout: 20_000 });
        await expect(delivered, "the typing is still there").toHaveValue("Sent to be saved. Then more, typed while saving.");
        await control({ saveDelayMs: 0 });
        expect(await storedText(), "what was sent is what was saved").toBe("Sent to be saved.");
        expect(await wouldWarnOnLeaving(page)).toBe(true);
        await done("typed-while-saving");
        await use.activate(saveButton);
        await expect(status).toHaveText("Saved.");
        expect(await storedText()).toBe("Sent to be saved. Then more, typed while saving.");

        // ── 5. No row came back, and signed out: said plainly, nothing cleared, nothing called saved ──
        await use.fill(delivered, "Typed before a save that was not confirmed.");
        await control({ saveMode: "no-row" });
        await use.activate(saveButton);
        await expect(status).toHaveText("The save wasn't confirmed: your company profile wasn't available to save to. Your changes are still on this page.");
        await expect(delivered).toHaveValue("Typed before a save that was not confirmed.");
        await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
        expect(await storedText()).toBe("Sent to be saved. Then more, typed while saving.");
        await control({ saveMode: "signed-out" });
        await use.activate(saveButton);
        await expect(status).toHaveText("You're signed out, so nothing was sent. Sign in again to save. Your case studies are still on this page.");
        await expect(delivered).toHaveValue("Typed before a save that was not confirmed.");
        expect(await wouldWarnOnLeaving(page)).toBe(true);
        await done("not-confirmed");

        // ── 6. Not known whether it was saved; then the old wording typed back in. Still not known. ──
        // In this run the list WAS written and the answer was lost. The editor cannot know that.
        await control({ saveMode: "written-unknown" });
        await use.activate(saveButton);
        await expect(status).toHaveText(UNKNOWN);
        expect(await storedText(), "it had in fact been written").toBe("Typed before a save that was not confirmed.");
        await use.fill(delivered, "Sent to be saved. Then more, typed while saving.");
        // The screen now matches the last list the editor KNEW was saved. That does not make storage known.
        await expect(status).toHaveText(UNKNOWN);
        expect(await wouldWarnOnLeaving(page), "still asks before leaving").toBe(true);
        expect(await storedText(), "and what is stored is not what is on the screen").toBe("Typed before a save that was not confirmed.");
        await done("not-known-after-typing-it-back");
        // A plain link is asked about too. (Navigation made by code, and Back and Forward, are not covered.)
        await page.evaluate(() => { const link = document.createElement("a"); link.href = "/admin-e2e-import-fixture"; link.textContent = "a plain link"; link.id = "fixture-plain-link"; document.body.append(link); });
        page.once("dialog", (dialog) => { expect(dialog.message()).toBe("Your case studies have changes that aren't saved, or a save that wasn't confirmed. Leave anyway?"); void dialog.dismiss(); });
        await page.locator("#fixture-plain-link").click();
        await expect(delivered).toHaveValue("Sent to be saved. Then more, typed while saving.");
        // Saving again is sent, although the screen matches the old baseline, and its confirmation ends the doubt.
        const before = (await control()).saveCalls as number;
        await use.activate(page.getByRole("button", { name: "Try again" }));
        await expect(status).toHaveText("Saved.");
        state = await control();
        expect(state.saveCalls).toBe(before + 1);
        expect(state.stored[0].whatWeDelivered).toBe("Sent to be saved. Then more, typed while saving.");
        expect(await wouldWarnOnLeaving(page)).toBe(false);

        // ── 7. STILL OPEN: this editor is stale after another tab saves, overwrites it, and is told "saved" ──
        const elsewhere = [{ ...state.stored[0], whatWeDelivered: "Rewritten in another tab." }, { id: "added-elsewhere", projectName: "Added in another tab", photos: ["", "", ""] }];
        await control({ storeElsewhere: elsewhere });
        await use.fill(delivered, "Typed in this stale tab.");
        await use.activate(saveButton);
        await expect(status, "no warning: the overwrite is a real save").toHaveText("Saved.");
        state = await control();
        expect(state.stored, "the other tab's entry is gone and its rewrite replaced").toHaveLength(1);
        expect(state.stored[0].whatWeDelivered).toBe("Typed in this stale tab.");
        await done("still-open-stale-overwrite");

        expect(outside.filter((host) => !["plausible.io", "www.clarity.ms"].includes(host)), "no outside host was contacted").toEqual([]);
        results.blockedThirdPartyHosts = Array.from(new Set(outside));
        results.stillOpen = "A stale editor overwrote a newer list and was told 'saved'. Not fixed by this change.";
        results.outcome = testInfo.errors.length === 0 ? "passed" : "failed";
    } finally {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(path.join(DIR, `results-case-study-save-${project}.json`), `${JSON.stringify(results, null, 2)}\n`);
    }
});
