import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { keyboardDriver, pointerDriver, type FocusRecord } from "../support/driver";

/**
 * A past job by answering questions, on the real guided screen and the real
 * full form, over the fixture harness: an in-memory library with the
 * database's rules and injected actions that run the real service.
 *
 * There is no sign-in, no Supabase and no network here. This is not an
 * authenticated hosted run. Sign-in and the on/off switch live in the real
 * pages, which the harness does not use; they are covered by unit tests of
 * those pages. The phone project is a phone-sized viewport with touch: it
 * shows layout, not a real on-screen keyboard.
 */
const EVIDENCE = process.env.E2E_EVIDENCE === "1";
const DIR = path.resolve(EVIDENCE ? "docs/evidence/stage2-tranche-2g4/guided" : "test-results/import-fixture/guided");
const ROOT = "/admin-e2e-import-fixture/case-library";
const SCOPE = "[data-guided-capture]";

test("Guided basics: questions, skip and back, an unconfirmed first save, a lost answer, edits elsewhere, leaving, resume, and approval left to the full form", async ({ page, context, hasTouch }, testInfo) => {
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

    const run = `guided-${project}-${Date.now()}`;
    const control = async (op: Record<string, unknown> = {}) => (await page.request.post(`${ROOT}/${run}/state`, { data: op })).json();
    const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
    const question = (name: string) => page.getByRole("heading", { level: 1, name });
    const saveLine = page.locator("[data-save-line]");
    const answer = page.locator("#guided-answer");
    const next = button("Save and next");
    const wouldWarnOnLeaving = (target: Page) => target.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
    const writes = async () => ((await control()).calls as string[]).length;

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
        // ── 1. The way in, and a first question that saves nothing until it has a name ──
        await page.goto(`${ROOT}/${run}`);
        await use.activate(page.getByRole("link", { name: "Answer a few questions instead" }));
        await expect(question("What was the job?")).toBeVisible();
        await expect(page.getByText("Question 1 of 6")).toBeVisible();
        await expect(saveLine).toHaveText("Nothing saved yet.");
        await expect(page.getByRole("link", { name: "Use the full form instead" })).toHaveAttribute("href", `${ROOT}/${run}/study/new`);
        expect(await wouldWarnOnLeaving(page), "nothing typed, nothing to warn about").toBe(false);
        await checkpoint("first-question");
        // The buttons sit in the page, under the box. Nothing is pinned over where a phone keyboard would be.
        expect(await next.evaluate((element) => { for (let node: Element | null = element; node; node = node.parentElement) { if (["fixed", "sticky"].includes(getComputedStyle(node).position)) return false; } return true; }), "controls are in page flow").toBe(true);

        await use.activate(next);
        await expect(page.locator("[data-guided-refusal]")).toHaveText("Give the job a name first. You can change it later.");
        expect(((await control()).studies as unknown[]).length, "nothing was added without a name").toBe(0);
        expect(await writes()).toBe(0);

        // ── 2. The first save gets no answer: no retry, no promise, and the contractor decides ──
        await control({ failAfter: "case_study_create" });
        await use.fill(answer, "Loft conversion, Example Lane");
        expect(await wouldWarnOnLeaving(page), "leaving with unsaved typing asks first").toBe(true);
        await use.activate(next);
        const unknown = page.locator("[data-create-unknown]");
        await expect(unknown).toBeVisible();
        await expect(saveLine).toHaveText("We couldn't confirm whether this was added. Check your case studies before adding it again.");
        await expect(unknown).toContainText("We can't promise that won't make a second copy.");
        await expect(unknown.getByRole("link", { name: /Check my case studies/ })).toHaveAttribute("target", "_blank");
        await expect(next, "there is no plain retry").toHaveCount(0);
        await expect(answer, "what was typed is still there").toHaveValue("Loft conversion, Example Lane");
        await expect(question("What was the job?"), "it did not move on").toBeVisible();
        expect(((await control()).calls as string[]).filter((name) => name === "case_study_create"), "it was asked once, and not again by itself").toHaveLength(1);
        await checkpoint("first-save-not-confirmed");
        // In this run it had in fact been added. The screen could not know, said so, and did not guess.
        // Adding it again is the contractor's own press, and here it does make a second copy.
        await use.activate(button("It isn't there. Add it again"));
        await expect(question("What kinds of work did this job involve?")).toBeVisible();
        let state = await control();
        expect((state.studies as Array<{ title: string }>).map((study) => study.title), "no promise of no second copy was made, and none was kept").toEqual(["Loft conversion, Example Lane", "Loft conversion, Example Lane"]);
        const id = state.studies[1].id as string;
        // The page now has the case study's own address, so a reload comes back to it.
        await expect.poll(() => page.url()).toContain(`/study/${id}/guided`);
        expect(state.studies[1]).toMatchObject({ clientDisplay: "hidden", showValue: false, approvedRevision: null, tags: [] });
        // Each new screen starts at its question.
        expect(await page.evaluate(() => document.activeElement?.id)).toBe("guided-heading");

        // ── 3. Kinds of work: nothing ticked for you; one added here is ticked here ──
        await expect(page.getByText("You haven't added any kinds of work yet.")).toBeVisible();
        await use.fill(page.getByLabel("Add another kind of work"), "Loft Conversion");
        await use.activate(button("Add"));
        await expect(button("Loft Conversion")).toHaveAttribute("aria-pressed", "true");
        await expect(saveLine).toHaveText("Changes not saved: the kinds of work.");
        expect(((await control()).studies[1].tags as string[]), "ticked on screen is not saved until saved").toEqual([]);
        await checkpoint("kinds-of-work");
        await use.activate(next);
        await expect(question("What did you do?")).toBeVisible();
        expect((await control()).studies[1].tags).toEqual(["Loft Conversion"]);

        // ── 4. Back and Skip make no request and clear nothing ──
        const did = "Converted the loft into a bedroom.\nFitted two roof windows and a new staircase.";
        await use.fill(answer, did);
        let before = await writes();
        await use.activate(button("Back"));
        await expect(question("What kinds of work did this job involve?")).toBeVisible();
        await expect(saveLine).toHaveText("Changes not saved: what you did.");
        await use.activate(button("Skip for now"));
        await expect(answer, "what was typed before going back is still there").toHaveValue(did);
        expect(await writes(), "Back and Skip sent nothing").toBe(before);
        expect((await control()).studies[1].delivered).toBe("");
        await use.activate(next);
        await expect(question("What did it mean for the client?")).toBeVisible();
        expect((await control()).studies[1].delivered, "saved exactly as typed, line break and all").toBe(did);

        before = await writes();
        await use.activate(button("Skip"));
        await expect(question("Roughly where?")).toBeVisible();
        expect(await writes(), "skipping an unanswered question sent nothing").toBe(before);

        // ── 5. Two answers left unsaved are saved together, and the screen says so first ──
        await use.fill(answer, "Headingley");
        await use.activate(button("Back"));
        await use.fill(answer, "They gained a bedroom without moving house.");
        await expect(page.locator("[data-also-saving]")).toHaveText("Saving will also save your changes to: the place.");
        await expect(saveLine).toHaveText("Changes not saved: what it meant for the client, the place.");
        await checkpoint("several-unsaved");
        before = await writes();
        await use.activate(next);
        await expect(question("Roughly where?")).toBeVisible();
        await expect(saveLine).toHaveText("Saved.");
        expect(await writes(), "one save wrote both").toBe(before + 1);
        expect((await control()).studies[1].draft).toMatchObject({ place: "Headingley", value_added: "They gained a bedroom without moving house." });
        // Nothing unsaved and already answered: Enter in the box simply moves on.
        await expect(button("Next")).toBeVisible();
        await answer.press("Enter");
        await expect(question("How long did it take?")).toBeVisible();
        expect(await writes()).toBe(before + 1);

        // ── 6. A save whose answer is lost: says it doesn't know, stays, and a second try does not write twice ──
        await use.fill(answer, "6 weeks");
        await control({ loseSaveAndLook: true });
        before = ((await control()).calls as string[]).filter((name) => name === "case_study_save_draft").length;
        await use.activate(next);
        await expect(saveLine).toContainText("We couldn't confirm whether this was saved.");
        await expect(question("How long did it take?"), "it did not move on").toBeVisible();
        await expect(answer).toHaveValue("6 weeks");
        await use.activate(next);
        await expect(question("Client and price")).toBeVisible();
        state = await control();
        expect((state.calls as string[]).filter((name) => name === "case_study_save_draft"), "the earlier write was found, and not repeated").toHaveLength(before + 1);
        expect(state.studies[1].draft.duration_text).toBe("6 weeks");

        // ── 7. Client and price: off unless chosen, and a name does not carry its own permission ──
        await expect(page.getByLabel("Don't mention them")).toBeChecked();
        await expect(page.getByLabel("Show a price for this job")).not.toBeChecked();
        await use.check(page.getByLabel("Name them"));
        await use.fill(page.getByLabel("The client's name"), "Mr Example");
        await expect(page.getByLabel("They've agreed to be named")).not.toBeChecked();
        await checkpoint("client-and-price");
        await use.activate(next);
        await expect(question("That's the basics")).toBeVisible();
        await expect(page.locator('[data-guided-screen="done"]')).toContainText("It's saved as a draft. Clients can't see it, and no proposal uses it, until you check and approve it on the full form.");
        state = await control();
        expect(state.studies[1]).toMatchObject({ clientDisplay: "named", clientNamedOk: false, approvedRevision: null, approved: null });
        expect(state.selected, "no proposal's choices were touched").toEqual([]);
        expect((state.calls as string[]).some((name) => /approve|archive/.test(name)), "the questions never approve or archive").toBe(false);
        await checkpoint("finished");

        // The existing full form is where it is checked, and its existing rule refuses a name without permission.
        await use.activate(page.getByRole("link", { name: "Check and approve on the full form" }));
        await expect(page.getByRole("heading", { level: 1, name: "Edit this past job" })).toBeVisible();
        await use.activate(button("Check what clients would see"));
        await expect(page.locator("[data-approve]").getByRole("alert")).toHaveText("To name the client, confirm that they've agreed to be named. Or choose not to name them.");
        await expect(button("Approve")).toHaveCount(0);

        // ── 8. Coming back: what is saved, and only what is saved ──
        await use.activate(page.getByRole("link", { name: "Go through the questions instead" }));
        const summary = page.locator('[data-guided-screen="summary"]');
        await expect(summary).toContainText("Anything you typed but didn't save isn't here, and we don't keep track of questions you skipped.");
        await expect(summary.locator('[data-summary="delivered"]')).toContainText("Fitted two roof windows and a new staircase.");
        await expect(summary.locator('[data-summary="kinds"]')).toContainText("Loft Conversion");
        await expect(summary.locator('[data-summary="client"]')).toContainText("The client is named: Mr Example. You haven't said they've agreed to it.");
        await expect(button("Finish")).toBeVisible();
        await checkpoint("summary");
        await use.activate(button("Change: Roughly where?"));
        await use.fill(answer, "Typed and never saved");
        expect(await wouldWarnOnLeaving(page)).toBe(true);
        // Opened again, as on another device: only the saved answer is there.
        await page.goto(`${ROOT}/${run}/study/${id}/guided`);
        await expect(page.locator('[data-summary="place"]')).toContainText("Headingley");
        await expect(page.getByText("Typed and never saved")).toHaveCount(0);

        // ── 9. Changed somewhere else: never saved over; and each choice does what it says ──
        await use.activate(button("Change: Roughly where?"));
        await use.fill(answer, "Leeds 6");
        await control({ editElsewhere: { id, delivered: "Rewritten elsewhere." } });
        await use.activate(next);
        await expect(saveLine).toContainText("This was changed somewhere else");
        await expect(page.locator("[data-latest]")).toContainText("Rewritten elsewhere.");
        await expect(page.locator("[data-latest]")).toContainText("Keeping your changes keeps only the answers you changed (the place).");
        await expect(page.locator("[data-latest]")).toContainText("Client and price: The client is named: Mr Example. You haven't said they've agreed to it. No price is shown.");
        await expect(answer, "what was typed is still in the box").toHaveValue("Leeds 6");
        await expect(question("Roughly where?")).toBeVisible();
        state = await control();
        expect(state.studies[1].draft, "the other edit was not saved over").toMatchObject({ delivered: "Rewritten elsewhere.", place: "Headingley" });
        await checkpoint("changed-elsewhere");
        await use.activate(button("Keep my changes"));
        await expect(saveLine).toHaveText("Changes not saved: the place.");
        await use.activate(next);
        await expect(question("How long did it take?")).toBeVisible();
        expect((await control()).studies[1].draft, "my answer went on top of the latest; the wording I had not touched was not put back").toMatchObject({ delivered: "Rewritten elsewhere.", place: "Leeds 6" });

        await use.fill(answer, "7 weeks");
        await control({ editElsewhere: { id, delivered: "Rewritten elsewhere, again." } });
        await use.activate(next);
        await expect(page.locator("[data-latest]")).toContainText("Rewritten elsewhere, again.");
        before = await writes();
        await use.activate(button("Use the saved version instead"));
        await expect(answer).toHaveValue("6 weeks");
        await expect(saveLine).toHaveText("Saved.");
        expect(await writes(), "choosing the saved version writes nothing").toBe(before);

        // ── 10. Leaving with something unsaved: a choice, and a failed save does not leave ──
        await use.fill(answer, "8 weeks");
        await use.activate(button("Back to case studies"));
        const leave = page.locator("[data-leave]");
        await expect(leave).toContainText("Not saved yet: how long it took.");
        await checkpoint("before-you-go");
        await use.activate(button("Stay here"));
        await expect(leave).toHaveCount(0);
        await control({ failBefore: "case_study_save_draft" });
        await use.activate(button("Back to case studies"));
        await use.activate(button("Save, then go"));
        await expect(saveLine).toContainText("We couldn't confirm the save");
        await expect(answer, "the save failed, so it stayed and kept the answer").toHaveValue("8 weeks");
        expect(page.url()).toContain(`/study/${id}/guided`);
        await use.activate(button("Keep my changes"));
        await use.activate(button("Back to case studies"));
        await use.activate(button("Save, then go"));
        await expect(page.getByRole("heading", { name: "Your case studies" })).toBeVisible();
        expect((await control()).studies[1].draft.duration_text).toBe("8 weeks");

        // ── 11. The browser's own Back button asks first too ──
        await page.goto(`${ROOT}/${run}/study/${id}/guided`);
        await use.activate(button("Change: Roughly where?"));
        await use.fill(answer, "Not saved, and not lost");
        page.once("dialog", (dialog) => { expect(dialog.message()).toBe("You have changes that aren't saved. Leave without saving them?"); void dialog.dismiss(); });
        await page.evaluate(() => window.history.back());
        await expect(answer, "refused: still here, with the typing").toHaveValue("Not saved, and not lost");
        expect(page.url()).toContain(`/study/${id}/guided`);
        page.once("dialog", (dialog) => void dialog.accept());
        await page.evaluate(() => window.history.back());
        await expect(page.getByRole("heading", { name: "Your case studies" })).toBeVisible();
        expect((await control()).studies[1].draft.place, "leaving without saving saved nothing").toBe("Leeds 6");

        // ── 12. An approved case study: the questions change the draft, not what proposals use ──
        await page.goto(`${ROOT}/${run}/study/${id}/guided`);
        await use.activate(button("Change: Client and price"));
        await use.check(page.getByLabel("Don't mention them"));
        await use.activate(next);
        await use.activate(page.getByRole("link", { name: "Check and approve on the full form" }));
        await use.activate(button("Check what clients would see"));
        await use.check(page.getByLabel("This is accurate and I'm happy for clients to see it"));
        await use.activate(button("Approve"));
        await expect(page.locator("[data-check-notice]")).toHaveText("Approved. Proposals can now use this version.");
        const approved = (await control()).studies[1];
        expect(approved.approved).toMatchObject({ delivered: "Rewritten elsewhere, again.", client_display: "hidden", client_text: "" });

        await use.activate(page.getByRole("link", { name: "Go through the questions instead" }));
        await expect(page.locator("[data-approval-line]")).toHaveText("Approved earlier. Proposals keep using the approved version until you approve again on the full form.");
        await use.activate(button("Change: What did you do?"));
        await use.fill(answer, "Changed after it was approved.");
        await use.activate(next);
        await expect(saveLine).toHaveText("Saved.");
        state = await control();
        expect(state.studies[1].delivered).toBe("Changed after it was approved.");
        expect(state.studies[1].approved, "the approved copy is exactly as it was").toEqual(approved.approved);
        expect(state.studies[1].approvedRevision).toBe(approved.approvedRevision);
        expect(state.selected).toEqual([]);

        // ── 13. The library's tables missing: said plainly, nothing claimed, typing kept ──
        await control({ unavailable: true });
        await page.goto(`${ROOT}/${run}/study/new/guided`);
        await use.fill(answer, "A job while the library is away");
        await use.activate(next);
        await expect(saveLine).toHaveText("The new case-study library isn't available right now. Your older case studies still work.");
        await expect(question("What was the job?")).toBeVisible();
        await expect(answer).toHaveValue("A job while the library is away");
        await control({ unavailable: false });
        expect(((await control()).studies as unknown[]).length).toBe(2);

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
        writeFileSync(path.join(DIR, `results-guided-${project}.json`), `${JSON.stringify(results, null, 2)}\n`);
    }
});
