import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { keyboardDriver, pointerDriver, type FocusRecord } from "../support/driver";

/**
 * The case-study library, on its real screens, over the fixture harness: an
 * in-memory library with the database's rules, and injected actions that run
 * the real service. There is no sign-in, no Supabase and no network here.
 * This is not an authenticated hosted run, and sign-in and the on/off switch
 * are not exercised by it; those are covered by unit tests.
 *
 * The library list, the editor and the library's part of the review screen
 * are new and are measured for size and accessibility. The rest of the
 * review screen is not re-measured here.
 */
const EVIDENCE = process.env.E2E_EVIDENCE === "1";
const DIR = path.resolve(EVIDENCE ? "docs/evidence/stage2-tranche-2g4/client" : "test-results/import-fixture/case-library");
const ROOT = "/admin-e2e-import-fixture/case-library";

test("Case-study library: add, save, fail and retry, conflict, approve, rename a kind of work, start from an older one, and choose for a proposal", async ({ page, context, hasTouch }, testInfo) => {
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

    const run = `lib-${project}-${Date.now()}`;
    const control = async (op: Record<string, unknown> = {}) => (await page.request.post(`${ROOT}/${run}/state`, { data: op })).json();
    const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
    const saveLine = page.locator("[data-save-line]");
    const delivered = page.getByLabel(/What did you do\?/);
    const wouldWarnOnLeaving = (target: Page) => target.evaluate(() => { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });

    /** Size, overflow and accessibility of the given new part of the screen. */
    const checkpoint = async (name: string, scope: string) => {
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const small = await page.locator(`${scope} button, ${scope} a, ${scope} input:not([type=checkbox]):not([type=radio]), ${scope} textarea`).evaluateAll((controls) => controls
            .filter((control) => (control as HTMLElement).offsetParent !== null)
            .map((control) => ({ control: ((control as HTMLElement).innerText || control.getAttribute("aria-label") || control.id || control.tagName).trim().slice(0, 40), ...(({ width, height }) => ({ width: Math.round(width), height: Math.round(height) }))(control.getBoundingClientRect()) }))
            .filter((size) => size.width < 44 || size.height < 44));
        const axe = await new AxeBuilder({ page }).include(scope).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const blocking = axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")).map((violation) => `${violation.id}: ${violation.help}`);
        let screenshot: string | null = null;
        if (EVIDENCE && ["desktop", "phone"].includes(project)) {
            shot += 1;
            screenshot = `${String(shot).padStart(2, "0")}-${name}-${viewport.width}x${viewport.height}.jpg`;
            mkdirSync(DIR, { recursive: true });
            // The review screen is long and mostly unchanged: only its past-jobs section is pictured.
            if (scope === "[data-past-jobs-extras]") await page.locator("#review-experience").screenshot({ path: path.join(DIR, screenshot), type: "jpeg", quality: 50, scale: "css", animations: "disabled" });
            else await page.screenshot({ path: path.join(DIR, screenshot), type: "jpeg", quality: 50, scale: "css", animations: "disabled", fullPage: true });
        }
        (results.checkpoints as unknown[]).push({ name, scope, sidewaysOverflowPx: sideways, undersized: small, blockingAccessibility: blocking, screenshot });
        expect.soft(sideways, `${name}: the page must not scroll sideways`).toBeLessThanOrEqual(1);
        expect.soft(small, `${name}: controls must be at least 44 by 44 px`).toEqual([]);
        expect.soft(blocking, `${name}: no critical or serious accessibility violation`).toEqual([]);
    };

    try {
        // ── 1. An empty library, then a first past job ───────────────────────
        await page.goto(`${ROOT}/${run}`);
        await expect(page.getByText("You haven't added any here yet.")).toBeVisible();
        await checkpoint("library-empty", "[data-library]");
        await use.activate(page.getByRole("link", { name: "Add a past job" }));
        await expect(page.getByRole("heading", { level: 1, name: "Add a past job" })).toBeVisible();
        await expect(saveLine).toHaveText("Nothing to save yet");
        expect(await wouldWarnOnLeaving(page), "nothing typed, nothing to warn about").toBe(false);

        await use.fill(page.getByLabel("What was the job?"), "Kitchen refit, 14 Example Road");
        await expect(saveLine).toHaveText("Not saved yet");
        expect(await wouldWarnOnLeaving(page), "leaving with unsaved typing asks first").toBe(true);
        await use.fill(page.getByLabel("Add another kind of work"), "Kitchen Installation");
        await use.activate(button("Add"));
        await expect(button("Kitchen Installation")).toHaveAttribute("aria-pressed", "true");
        await use.fill(delivered, "We refitted the kitchen and moved the sink.");
        // Client and price are out of the way, and off, until asked for.
        await expect(page.getByText("Unless you change it here, the client is not mentioned and no price is shown.")).toBeVisible();
        await checkpoint("editor-new", "[data-case-study-editor]");
        await use.activate(button("Save draft"));
        await expect(saveLine).toHaveText("Saved");
        expect(await wouldWarnOnLeaving(page)).toBe(false);
        let state = await control();
        expect(state.studies).toHaveLength(1);
        expect(state.studies[0]).toMatchObject({ title: "Kitchen refit, 14 Example Road", clientDisplay: "hidden", showValue: false, approvedRevision: null, tags: ["Kitchen Installation"] });
        const id = state.studies[0].id as string;

        // ── 2. A save that fails keeps the words, says so honestly, and can be retried ──
        await control({ failBefore: "case_study_save_draft" });
        await use.fill(delivered, "We refitted the kitchen, moved the sink and tiled the floor.");
        await use.activate(button("Save draft"));
        await expect(saveLine).toContainText("doesn't show your changes yet");
        await expect(saveLine).not.toContainText(/nothing (was )?changed/i);
        await expect(delivered).toHaveValue("We refitted the kitchen, moved the sink and tiled the floor.");
        await checkpoint("editor-save-not-confirmed", "[data-case-study-editor]");
        // The latest saved copy is offered beside what was typed. The contractor keeps their own words.
        await use.activate(button("Keep what I typed"));
        await use.activate(button("Save draft"));
        await expect(saveLine).toHaveText("Saved");

        // A save whose answer is lost after it landed is found to be saved, not reported as failed.
        await control({ failAfter: "case_study_save_draft" });
        await use.fill(delivered, "We refitted the kitchen, moved the sink, tiled the floor and decorated.");
        await use.activate(button("Save draft"));
        await expect(saveLine).toHaveText("Saved");
        state = await control();
        expect(state.studies[0].delivered).toBe("We refitted the kitchen, moved the sink, tiled the floor and decorated.");

        // ── 3. Changed somewhere else: nothing typed is lost, and the contractor decides ──
        await control({ editElsewhere: { id, delivered: "Edited in another tab." } });
        await use.fill(delivered, "Typed here, in the stale tab.");
        await use.activate(button("Save draft"));
        await expect(saveLine).toContainText("This was changed somewhere else");
        await expect(page.locator("[data-latest]")).toContainText("Edited in another tab.");
        await expect(delivered, "what was typed is still in the box").toHaveValue("Typed here, in the stale tab.");
        state = await control();
        expect(state.studies[0].delivered, "the other tab's save was not overwritten").toBe("Edited in another tab.");
        await checkpoint("editor-conflict", "[data-case-study-editor]");
        await use.activate(button("Keep what I typed"));
        await use.activate(button("Save draft"));
        await expect(saveLine).toHaveText("Saved");
        expect((await control()).studies[0].delivered).toBe("Typed here, in the stale tab.");

        // ── 4. Check and approve: exactly what a client would see, then an explicit yes ──
        await use.activate(button("Check what clients would see"));
        const preview = page.locator("[data-approved-preview]");
        await expect(preview).toContainText("Kitchen refit, 14 Example Road");
        await expect(preview).toContainText("Typed here, in the stale tab.");
        await expect(preview).not.toContainText("Client");
        const facts = page.locator("[data-approve-facts]");
        await expect(facts).toContainText("The client isn't mentioned.");
        await expect(facts).toContainText("No price is shown.");
        await expect(facts).toContainText("Kinds of work, in this order: Kitchen Installation.");
        await checkpoint("editor-check", "[data-case-study-editor]");
        await use.activate(button("Approve"));
        await expect(page.locator("[data-check-notice]")).toContainText("Tick the box");
        expect((await control()).studies[0].approvedRevision, "not approved without the tick").toBeNull();
        // A kind of work is renamed somewhere else after the check was loaded. What is on this screen is
        // no longer what would be approved, so the approval is refused and the check is loaded again.
        await control({ renameElsewhere: { from: "Kitchen Installation", to: "Kitchen fitting" } });
        await use.check(page.getByLabel("This is accurate and I'm happy for clients to see it"));
        await use.activate(button("Approve"));
        await expect(page.locator("[data-check-notice]")).toContainText("This changed after you opened this check. Nothing was approved.");
        await expect(facts).toContainText("Kinds of work, in this order: Kitchen fitting.");
        await expect(page.getByLabel("This is accurate and I'm happy for clients to see it"), "the tick does not carry over to a different version").not.toBeChecked();
        expect((await control()).studies[0].approvedRevision, "nothing was approved from the out-of-date check").toBeNull();
        await checkpoint("editor-check-refused", "[data-case-study-editor]");
        await control({ renameElsewhere: { from: "Kitchen fitting", to: "Kitchen Installation" } });
        // Renamed back elsewhere: this screen is out of date again, and is refused again.
        await use.check(page.getByLabel("This is accurate and I'm happy for clients to see it"));
        await use.activate(button("Approve"));
        await expect(facts).toContainText("Kinds of work, in this order: Kitchen Installation.");
        expect((await control()).studies[0].approvedRevision).toBeNull();
        await use.check(page.getByLabel("This is accurate and I'm happy for clients to see it"));
        await use.activate(button("Approve"));
        await expect(page.locator("[data-check-notice]")).toHaveText("Approved. Proposals can now use this version.");
        state = await control();
        expect(state.studies[0].approved).toMatchObject({ title: "Kitchen refit, 14 Example Road", delivered: "Typed here, in the stale tab.", client_display: "hidden", client_text: "", show_value: false, disciplines: ["Kitchen Installation"] });

        // ── 5. Naming a client needs their agreement, and says so on the check ──
        await use.activate(button("More, if you want: client and price"));
        await expect(page.getByLabel("Don't mention them")).toBeChecked();
        await use.check(page.getByLabel("Name them"));
        await use.fill(page.getByLabel("The client's name"), "Mrs Patel");
        await use.activate(button("Save draft"));
        await expect(saveLine).toHaveText("Saved");
        await expect(page.locator("[data-approval-line]")).toContainText("Proposals keep using the approved version until you approve again");
        await expect(page.locator("[data-approval-line]")).toContainText("how the client is referred to");
        await use.activate(button("Check what clients would see"));
        await expect(page.getByRole("alert").filter({ hasText: "confirm that they've agreed" })).toBeVisible();
        await expect(button("Approve")).toHaveCount(0);
        expect((await control()).studies[0].approved.client_display, "the approved copy still hides the client").toBe("hidden");
        // Back to not mentioning them.
        await use.check(page.getByLabel("Don't mention them"));
        await use.activate(button("Save draft"));
        await expect(saveLine).toHaveText("Saved");

        // ── 6. On the list: status in words, and renaming a kind of work shows as a change since approval ──
        await use.activate(page.getByRole("link", { name: "Back to case studies" }));
        const row = page.locator(`[data-study="${id}"]`);
        await expect(row.locator("[data-study-state]")).toHaveText("Approved");
        await use.activate(button("Rename Kitchen Installation"));
        await use.fill(page.getByLabel("New name for Kitchen Installation"), "Kitchens");
        await use.activate(button("Save name"));
        await expect(page.locator('[data-kind="Kitchens"]')).toBeVisible();
        await expect(row.locator("[data-study-state]")).toHaveText("Approved, with changes not yet approved: the kinds of work, or their order");
        await expect(row).toContainText("Approved as: Kitchen Installation");
        state = await control();
        expect(state.studies[0].approved.disciplines, "the approved copy keeps the words that were approved").toEqual(["Kitchen Installation"]);
        await checkpoint("library-list", "[data-library]");

        // ── 7. A new version of an older case study: a draft, client left out, older one untouched ──
        await use.activate(button("Start a new version of Older job 2"));
        await expect(page.getByLabel("What was the job?")).toHaveValue("Older job 2");
        await expect(page.getByText("Unless you change it here, the client is not mentioned and no price is shown.")).toHaveCount(0);
        await expect(page.getByLabel("Don't mention them"), "the older entry's client is not shown unless the contractor chooses").toBeChecked();
        state = await control();
        expect(state.studies[1]).toMatchObject({ title: "Older job 2", clientDisplay: "hidden", showValue: false, approvedRevision: null, legacyIndex: 1 });
        expect(state.older, "the older case studies are unchanged").toEqual(["Older job 1", "Older job 2", "Older job 3", "Older job 4", "Older job 5", "Older job 6", "Older job 7"]);

        // ── 8. Choosing for a proposal: approved ones only, real counts, nothing chosen for the contractor ──
        await page.goto(`${ROOT}/${run}/review`);
        const extras = page.locator("[data-past-jobs-extras]");
        const libraryBox = page.getByRole("checkbox", { name: /Kitchen refit, 14 Example Road/ });
        await expect(libraryBox).not.toBeChecked();
        await expect(extras.getByText("Older job 2", { exact: false })).toHaveCount(0);
        await expect(extras.locator("[data-past-jobs-unapproved]")).toHaveText("1 case study in your library isn't approved yet, so it can't be chosen.");
        await use.check(libraryBox);
        await expect(extras.locator("[data-past-jobs-count]")).toContainText("Showing 1 past job (0 older, 1 from your library)");
        for (const n of [1, 2, 3, 4, 5, 6]) await use.check(page.getByRole("checkbox", { name: new RegExp(`^Older job ${n} `) }));
        await expect(extras.locator("[data-past-jobs-blocked]")).toHaveText("You've chosen 7 past jobs to show (6 older and 1 new). A proposal shows up to 6. Untick 1.");
        await expect(page.locator('[data-send-missing="caseStudySelection"]')).toBeVisible();
        await checkpoint("review-too-many", "[data-past-jobs-extras]");
        await use.check(page.getByRole("checkbox", { name: /^Older job 7 / }));
        await expect(extras.locator("[data-past-jobs-blocked]")).toContainText("Only 6 of your 7 older ones are counted, because only 6 are ever shown.");
        await page.getByRole("checkbox", { name: /^Older job 7 / }).uncheck();
        await page.getByRole("checkbox", { name: /^Older job 6 / }).uncheck();
        await expect(extras.locator("[data-past-jobs-blocked]")).toHaveCount(0);
        await expect(page.locator('[data-send-missing="caseStudySelection"]')).toHaveCount(0);
        await expect(extras.locator("[data-past-jobs-count]")).toContainText("Showing 6 past jobs (5 older, 1 from your library)");

        // ── 9. A chosen case study that can no longer be sent stays ticked, says why, and blocks sending ──
        await control({ select: ["o1", `lib:${id}`], archiveElsewhere: id });
        await page.goto(`${ROOT}/${run}/review`);
        const cannot = page.locator("[data-past-jobs-cannot-send]");
        await expect(cannot).toContainText("This case study has been archived, so it can't be sent.");
        await expect(page.locator('[data-send-missing="caseStudySelection"]')).toBeVisible();
        await expect(page.getByRole("checkbox", { name: /^Older job 1 / }), "the older choice is untouched").toBeChecked();
        expect((await control({ publish: true })).publish, "the stand-in publish refuses too").toMatchObject({ success: false, error: expect.stringContaining("can't be sent") });
        await checkpoint("review-cannot-send", "[data-past-jobs-extras]");
        await use.activate(cannot.getByRole("button", { name: "Untick it" }));
        await expect(cannot).toHaveCount(0);
        await expect(page.locator('[data-send-missing="caseStudySelection"]')).toHaveCount(0);

        // ── 10. Library switched off, with a library tick already saved: shown, not dropped ──
        await control({ libraryOff: true, select: ["o1", `lib:${id}`] });
        await page.goto(`${ROOT}/${run}/review`);
        await expect(page.locator("[data-past-jobs-cannot-send]")).toContainText("isn't available right now. It can't be sent.");
        await expect(page.getByRole("checkbox", { name: /Kitchen refit, 14 Example Road/ })).toHaveCount(0);
        expect((await control({ publish: true })).publish).toMatchObject({ success: false, error: expect.stringContaining("can't be sent") });
        // And an older-only proposal is as it always was: no library part at all.
        await control({ select: ["o1"] });
        await page.goto(`${ROOT}/${run}/review`);
        await expect(page.getByRole("checkbox", { name: /^Older job 1 / })).toBeChecked();
        await expect(page.locator("[data-past-jobs-cannot-send]")).toHaveCount(0);
        await expect(page.locator('[data-send-missing="caseStudySelection"]')).toHaveCount(0);

        // ── 11. The library's tables missing: said plainly, never shown as empty ──
        await control({ libraryOff: false, unavailable: true });
        await page.goto(`${ROOT}/${run}`);
        await expect(page.locator('[data-library="unavailable"]')).toContainText("isn't available right now. Your older case studies below still work.");
        await expect(page.getByText("You haven't added any here yet.")).toHaveCount(0);

        // Asked for and blocked: the two marketing analytics tags, and the made-up picture address the
        // synthetic proposal carries (a reserved .test name that exists nowhere). Nothing else is asked for.
        expect(outside.filter((host) => !["plausible.io", "www.clarity.ms", "images.example.test"].includes(host)), "no outside host was contacted").toEqual([]);
        if (keyboardRun) {
            const withoutFocus = focusLog.filter((entry) => !entry.visibleFocus).map((entry) => entry.control);
            results.keyboard = { controlsReached: focusLog.length, withoutVisibleFocus: Array.from(new Set(withoutFocus)) };
            // Controls on the new screens. The older review screen's own controls are not re-judged here.
            const mine = withoutFocus.filter((name) => !/Older job/.test(name));
            expect(mine, "every new control reached by keyboard shows where focus is").toEqual([]);
        }
        results.blockedThirdPartyHosts = Array.from(new Set(outside));
        results.outcome = testInfo.errors.length === 0 ? "passed" : "failed";
    } finally {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(path.join(DIR, `results-case-library-${project}.json`), `${JSON.stringify(results, null, 2)}\n`);
    }
});
