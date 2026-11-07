import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { keyboardDriver, pointerDriver, type FocusRecord } from "../support/driver";

/**
 * The three optional questions about a past job, on the real guided screen,
 * over the fixture harness: an in-memory library with the database's rules
 * and injected actions that run the real service.
 *
 * There is no sign-in, no Supabase and no network here. This is not an
 * authenticated hosted run. The phone project is a phone-sized viewport with
 * touch: it shows layout, not a real on-screen keyboard. Nothing here says
 * anything about the quality of anyone's writing: the words are the
 * contractor's own, with three fixed lead-ins.
 */
const EVIDENCE = process.env.E2E_EVIDENCE === "1";
const DIR = path.resolve(EVIDENCE ? "docs/evidence/stage2-tranche-2g4/depth" : "test-results/import-fixture/guided-depth");
const ROOT = "/admin-e2e-import-fixture/case-library";
const SCOPE = "[data-guided-capture]";

test("Guided depth: notes that are not sent, an explicit Add, slow answers while typing, edits elsewhere, a full text, and coming back", async ({ page, context, hasTouch }, testInfo) => {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    const focusLog: FocusRecord[] = [];
    const use = keyboardRun ? keyboardDriver(page, focusLog) : pointerDriver(Boolean(hasTouch));
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const results: Record<string, unknown> = { project, viewport, input: keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", outcome: "failed", checkpoints: [] as unknown[] };
    let shot = 0;

    const outside: string[] = [];
    await context.route((url) => url.hostname !== "127.0.0.1", async (route) => {
        outside.push(new URL(route.request().url()).host);
        await route.abort();
    });

    const run = `depth-${project}-${Date.now()}`;
    const control = async (op: Record<string, unknown> = {}) => (await page.request.post(`${ROOT}/${run}/state`, { data: op })).json();
    const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
    const question = (name: string) => page.getByRole("heading", { level: 1, name });
    const saveLine = page.locator("[data-save-line]");
    const answer = page.locator("#guided-answer");
    const note = page.locator("#guided-note");
    const next = button("Save and next");
    const addButton = button(/^Add to .What you did.$/);
    const editText = button(/^Edit .What you did.$/);
    const leave = page.locator("[data-leave]");
    const wouldWarnOnLeaving = (target: Page) => target.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
    const calls = async () => (await control()).calls as string[];
    const draft = async () => (await control()).studies[0].draft as Record<string, string>;
    const toDepth = async () => { await use.activate(button("See all answers")); await use.activate(button("Add more about this job")); };
    const count = (text: string, part: string) => text.split(part).length - 1;

    const checkpoint = async (name: string) => {
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const small = await page.locator(`${SCOPE} button, ${SCOPE} a, ${SCOPE} input:not([type=checkbox]):not([type=radio]), ${SCOPE} textarea`).evaluateAll((controls) => controls
            .filter((entry) => (entry as HTMLElement).offsetParent !== null)
            .map((entry) => ({ control: ((entry as HTMLElement).innerText || entry.getAttribute("aria-label") || entry.id || entry.tagName).trim().slice(0, 40), ...(({ width, height }) => ({ width: Math.round(width), height: Math.round(height) }))(entry.getBoundingClientRect()) }))
            .filter((size) => size.width < 44 || size.height < 44));
        const axe = await new AxeBuilder({ page }).include(SCOPE).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const blocking = axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")).map((violation) => `${violation.id}: ${violation.help}`);
        let screenshot: string | null = null;
        if (EVIDENCE && ["desktop", "phone"].includes(project)) {
            shot += 1;
            screenshot = `${String(shot).padStart(2, "0")}-${name}-${viewport.width}x${viewport.height}.jpg`;
            mkdirSync(DIR, { recursive: true });
            await page.screenshot({ path: path.join(DIR, screenshot), type: "jpeg", quality: 50, scale: "css", animations: "disabled", fullPage: true });
        }
        (results.checkpoints as unknown[]).push({ name, sidewaysOverflowPx: sideways, undersized: small, blockingAccessibility: blocking, screenshot });
        expect.soft(sideways, `${name}: the page must not scroll sideways`).toBeLessThanOrEqual(1);
        expect.soft(small, `${name}: controls must be at least 44 by 44 px`).toEqual([]);
        expect.soft(blocking, `${name}: no critical or serious accessibility violation`).toEqual([]);
    };

    try {
        // ── 0. A saved job with a short "what you did" ──
        await page.goto(`${ROOT}/${run}/study/new/guided`);
        await use.fill(answer, "Loft conversion");
        await use.activate(next);
        await expect(question("What kinds of work did this job involve?")).toBeVisible();
        const id = (await control()).studies[0].id as string;
        await use.activate(button("See all answers"));
        await use.activate(button("Answer: What did you do?"));
        await use.fill(answer, "Converted the loft.");
        await use.activate(next);
        await expect(question("What did it mean for the client?")).toBeVisible();

        // ── 1. The optional questions are offered from the summary, not inside the six ──
        await toDepth();
        await expect(question("Was anything tricky about this job?")).toBeVisible();
        await expect(page.getByText("More about this job, 1 of 3 (optional)")).toBeVisible();
        await expect(page.locator("[data-depth-room]")).toContainText("4,962 characters");
        await expect(note).toHaveValue("");
        await expect(addButton).toHaveCount(0);
        await checkpoint("depth-question");

        // ── 2. Only spaces: not addable, not sent, and not invisible to leaving ──
        let before = (await calls()).length;
        await use.fill(note, "   ");
        await expect(page.locator('[data-depth-status="nothing"]')).toBeVisible();
        await expect(addButton).toHaveCount(0);
        await expect(saveLine).toHaveText("Saved. Typed but not added: the tricky part.");
        expect(await wouldWarnOnLeaving(page), "spaces typed in a note still ask before a reload").toBe(true);
        // Nothing to save, a note of spaces, and a wish to leave: not gone, not locked.
        await use.activate(button("Back to case studies"));
        await expect(page.locator("[data-leave-notes]")).toContainText("Typed but not added to your text: the tricky part. A save doesn't include it.");
        await expect(button("Save, then go")).toBeDisabled();
        await expect(button("Go without saving")).toBeEnabled();
        await checkpoint("leave-with-note");
        await use.activate(button("Stay here"));
        await expect(leave).toHaveCount(0);
        await expect(note, "still editable: nothing was locked").toHaveValue("   ");
        expect(page.url()).toContain(`/study/${id}/guided`);
        expect((await calls()).length, "nothing was sent").toBe(before);
        await use.activate(button("Clear this box"));
        await expect(note).toHaveValue("");
        await expect(saveLine).toHaveText("Saved.");
        expect(await wouldWarnOnLeaving(page)).toBe(false);

        // ── 3. "Save and next" with a slow answer, and a note typed while it is on its way ──
        await use.activate(button("See all answers"));
        await use.activate(button("Answer: Roughly where?"));
        await use.fill(answer, "Leeds");
        await toDepth();
        await expect(page.locator("[data-also-saving]")).toHaveText("Saving will save your changes to: the place.");
        await control({ delayMs: 5000 });
        await use.activate(next);
        await expect(saveLine).toContainText("Saving…");
        await use.fill(note, "Typed while saving");
        await expect(page.locator("[data-move-held]")).toHaveText("Your answers were saved. What you typed for the tricky part hasn't been added to your text, so this is still open.");
        await expect(question("Was anything tricky about this job?"), "it did not move on").toBeVisible();
        await expect(note).toHaveValue("Typed while saving");
        await expect(saveLine).toHaveText("Saved. Typed but not added: the tricky part.");
        await control({ delayMs: 0 });
        expect((await draft()).place, "the answer that was sent was saved").toBe("Leeds");
        expect(JSON.stringify(await control()), "the note was not sent or stored").not.toContain("Typed while saving");
        await checkpoint("next-held-by-note");
        await use.activate(button("Clear this box"));

        // ── 4. "Save, then go" to the list with a slow answer, and a note typed while it is on its way ──
        await use.activate(editText);
        await use.fill(answer, "Converted the loft into a bedroom.");
        await toDepth();
        await control({ delayMs: 5000 });
        await use.activate(button("Back to case studies"));
        await use.activate(button("Save, then go"));
        await expect(saveLine).toContainText("Saving…");
        await use.fill(note, "Typed while leaving");
        const held = page.locator("[data-leave-held]");
        await expect(held).toHaveText("Your answers were saved. What you typed for the tricky part hasn't been added to your text, so you're still here.");
        expect(page.url(), "it did not leave").toContain(`/study/${id}/guided`);
        await expect(note).toHaveValue("Typed while leaving");
        await expect(button("Save, then go")).toBeDisabled();
        await control({ delayMs: 0 });
        expect((await draft()).delivered).toBe("Converted the loft into a bedroom.");
        await checkpoint("leave-held-by-note");
        await use.activate(button("Stay here"));
        await use.activate(button("Clear this box"));
        await expect(saveLine).toHaveText("Saved.");

        // ── 5. The same on the way to the full form; going without it is the contractor's to choose; nothing is kept between visits ──
        await use.activate(editText);
        await use.fill(answer, "Converted the loft into a bedroom and fitted a staircase.");
        await toDepth();
        await control({ delayMs: 5000 });
        await use.activate(button("Use the full form instead"));
        await use.activate(button("Save, then go"));
        await expect(saveLine).toContainText("Saving…");
        await use.fill(note, "Typed on the way to the full form");
        await expect(held).toContainText("hasn't been added to your text, so you're still here.");
        expect(page.url()).toContain(`/study/${id}/guided`);
        await control({ delayMs: 0 });
        before = (await calls()).length;
        await use.activate(button("Go without saving"));
        await expect(page.getByRole("heading", { level: 1, name: "Edit this past job" })).toBeVisible();
        await expect(page.getByLabel(/What did you do\?/)).toHaveValue("Converted the loft into a bedroom and fitted a staircase.");
        expect((await calls()).length, "going without it wrote nothing").toBe(before);
        expect(JSON.stringify(await control())).not.toContain("Typed on the way");
        await use.activate(page.getByRole("link", { name: "Go through the questions instead" }));
        await use.activate(button("Add more about this job"));
        await expect(note, "a new visit starts with no notes").toHaveValue("");
        await expect(saveLine).toHaveText("Saved.");

        // ── 6. Changed elsewhere while my words are still a note: no second paragraph, nothing hidden, not called saved ──
        await use.fill(note, "My own tricky part");
        await use.activate(button("See all answers"));
        await use.activate(button("Change: Roughly where?"));
        await use.fill(answer, "York");
        await toDepth();
        await expect(note, "moving about did not touch the note").toHaveValue("My own tricky part");
        await control({ editElsewhere: { id, delivered: "Remote rewrite.\n\nThe tricky part: remote challenge" } });
        await use.activate(next);
        await expect(saveLine).toContainText("This was changed somewhere else");
        const latest = page.locator("[data-latest]");
        await expect(latest).toContainText("The tricky part: remote challenge");
        await expect(latest).toContainText("What you've typed but not added (the tricky part) stays as it is, whichever you choose.");
        await expect(page.locator("[data-replace-warning]"), "I did not change that text, so nothing of mine replaces it").toHaveCount(0);
        await use.activate(button("Keep my changes"));
        await expect(page.locator("[data-depth-present]")).toContainText("already has a paragraph starting");
        await expect(page.locator('[data-depth-status="present"]')).toContainText("What you typed here hasn't been added. Copy it into");
        await expect(note).toHaveValue("My own tricky part");
        await expect(addButton, "a second paragraph is not offered").toHaveCount(0);
        await checkpoint("note-beside-existing-paragraph");
        await use.activate(button("Clear this box"));
        await use.activate(next);
        await expect(question("What did you do about it?")).toBeVisible();
        let saved = await draft();
        expect(saved).toMatchObject({ place: "York", delivered: "Remote rewrite.\n\nThe tricky part: remote challenge" });
        expect(count(saved.delivered, "The tricky part: ")).toBe(1);

        // ── 7. Add: the exact paragraph is shown first, the press sends nothing, and the save stores exactly that ──
        const response = "Lifted the units in through the window.";
        await use.fill(note, response);
        const preview = page.locator("[data-depth-preview]");
        expect(await preview.evaluate((element) => element.textContent)).toBe(`What we did about it: ${response}`);
        await checkpoint("ready-to-add");
        before = (await calls()).length;
        await use.activate(addButton);
        await expect(page.locator("[data-depth-present]")).toBeVisible();
        await expect(note, "the box is gone once its words are in the text").toHaveCount(0);
        await expect(saveLine).toHaveText("Changes not saved: what you did.");
        expect((await calls()).length, "Add made no request").toBe(before);
        expect((await draft()).delivered, "and nothing is stored until a save").toBe("Remote rewrite.\n\nThe tricky part: remote challenge");
        expect(await wouldWarnOnLeaving(page)).toBe(true);

        // Changed elsewhere after I added: keeping mine replaces that whole text, and the screen says so first.
        await control({ editElsewhere: { id, delivered: "Second remote rewrite.\n\nThe tricky part: remote challenge" } });
        await use.activate(next);
        await expect(latest).toContainText("Second remote rewrite.");
        await expect(page.locator("[data-replace-warning]")).toContainText("Keeping your changes will replace the saved");
        expect((await draft()).delivered, "the other edit was not saved over").toBe("Second remote rewrite.\n\nThe tricky part: remote challenge");
        await checkpoint("replace-warning");
        await use.activate(button("Keep my changes"));
        await use.activate(next);
        await expect(question("Is there anything you do differently because of this job?")).toBeVisible();
        saved = await draft();
        expect(saved.delivered).toBe(`Remote rewrite.\n\nThe tricky part: remote challenge\n\nWhat we did about it: ${response}`);
        expect(saved.place).toBe("York");

        // ── 8. A save that fails after an Add: nothing is added twice, and it saves on the next try ──
        await use.fill(note, "We measure access before ordering.");
        await use.activate(addButton);
        await control({ failBefore: "case_study_save_draft" });
        await use.activate(next);
        await expect(saveLine).toContainText("We couldn't confirm the save");
        await expect(question("Is there anything you do differently because of this job?")).toBeVisible();
        await use.activate(button("Keep my changes"));
        await use.activate(next);
        await expect(question("That's the basics")).toBeVisible();
        const withAll = `Remote rewrite.\n\nThe tricky part: remote challenge\n\nWhat we did about it: ${response}\n\nWhat we do differently now: We measure access before ordering.`;
        expect((await draft()).delivered).toBe(withAll);

        // ── 9. The whole text is one box; typing in it while a slow save runs is not moved out of sight ──
        await use.activate(button("See all answers"));
        await use.activate(button("Change: What did you do?"));
        await expect(answer, "the paragraphs are ordinary text in the one box").toHaveValue(withAll);
        await use.fill(answer, `${withAll} First edit.`);
        await control({ delayMs: 5000 });
        await use.activate(next);
        await expect(saveLine).toContainText("Saving…");
        await use.fill(answer, `${withAll} First edit. Typed while saving.`);
        await expect(page.locator("[data-move-held]")).toHaveText("Your earlier answers were saved. What you typed after that isn't saved yet, so this question is still open.");
        await expect(question("What did you do?")).toBeVisible();
        await control({ delayMs: 0 });
        expect((await draft()).delivered).toBe(`${withAll} First edit.`);
        await use.activate(next);
        await expect(question("What did it mean for the client?")).toBeVisible();
        saved = await draft();
        expect(saved.delivered).toBe(`${withAll} First edit. Typed while saving.`);
        for (const words of ["The tricky part: ", "What we did about it: ", "What we do differently now: "]) expect(count(saved.delivered, words), words).toBe(1);

        // Every paragraph is there already, so none is offered again.
        await toDepth();
        for (const title of ["Was anything tricky about this job?", "What did you do about it?", "Is there anything you do differently because of this job?"]) {
            await expect(question(title)).toBeVisible();
            await expect(page.locator("[data-depth-present]")).toBeVisible();
            await expect(note).toHaveCount(0);
            await expect(addButton).toHaveCount(0);
            await use.activate(button("Next"));
        }
        await expect(question("That's the basics")).toBeVisible();

        // ── 10. A text already at its limit needs nothing more and still saves ──
        const full = "y".repeat(5000);
        await control({ editElsewhere: { id, delivered: full } });
        await page.goto(`${ROOT}/${run}/study/${id}/guided`);
        await use.activate(button("Add more about this job"));
        await expect(page.locator("[data-depth-no-room]")).toHaveText(/There's no room left in .What you did.\. Shorten it there first, or leave this out\./);
        await expect(note).toHaveCount(0);
        await expect(addButton).toHaveCount(0);
        await checkpoint("no-room");
        before = (await calls()).length;
        await use.activate(button("Skip"));
        await use.activate(button("Skip"));
        await expect(question("That's the basics")).toBeVisible();
        expect((await calls()).length, "visiting them sent nothing").toBe(before);
        await use.activate(button("See all answers"));
        await use.activate(button("Change: Roughly where?"));
        await use.fill(answer, "Hull");
        await use.activate(next);
        await expect(saveLine).toHaveText("Saved.");
        saved = await draft();
        expect(saved.place).toBe("Hull");
        expect(saved.delivered).toBe(full);

        // Nothing here approved, archived or chose anything for a proposal.
        const end = await control();
        expect(end.studies[0]).toMatchObject({ approvedRevision: null, approved: null, clientDisplay: "hidden", showValue: false, tags: [] });
        expect(end.selected).toEqual([]);
        expect((end.calls as string[]).filter((name) => !["case_study_create", "case_study_save_draft"].includes(name)), "only create and save were ever called").toEqual([]);

        expect(outside.filter((host) => !["plausible.io", "www.clarity.ms"].includes(host)), "no outside host was contacted").toEqual([]);
        if (keyboardRun) {
            const withoutFocus = focusLog.filter((entry) => !entry.visibleFocus).map((entry) => entry.control);
            results.keyboard = { controlsReached: focusLog.length, withoutVisibleFocus: Array.from(new Set(withoutFocus)) };
            expect(withoutFocus, "every control reached by keyboard shows where focus is").toEqual([]);
        }
        results.blockedThirdPartyHosts = Array.from(new Set(outside));
        results.outcome = testInfo.errors.length === 0 ? "passed" : "failed";
    } finally {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(path.join(DIR, `results-guided-depth-${project}.json`), `${JSON.stringify(results, null, 2)}\n`);
    }
});
