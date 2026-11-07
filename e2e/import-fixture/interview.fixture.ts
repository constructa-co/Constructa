import { expect, test, type Locator, type Page } from "@playwright/test";
import { keyboardDriver, pointerDriver, type FocusRecord } from "../support/driver";
import { Recorder } from "../support/recorder";

const FOLDERS = { evidence: "docs/evidence/stage2-tranche-2g3", smoke: "test-results/import-fixture/interview" };
const HARNESS = "/admin-e2e-import-fixture/interview";
const EMPTY_PROFILE = { capability_statement: null, years_trading: null, accreditations: null, insurance_details: null };

test("Guided company interview: one question at a time, skip, back, resume, draft, approval", async ({ page, context, hasTouch }, testInfo) => {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    const focusLog: FocusRecord[] = [];
    const use = keyboardRun ? keyboardDriver(page, focusLog) : pointerDriver(Boolean(hasTouch));
    const recorder = new Recorder(page, testInfo, keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", process.env.E2E_EVIDENCE === "1", FOLDERS);

    // Nothing but this machine may be contacted.
    const outside: string[] = [];
    await context.route((url) => url.hostname !== "127.0.0.1", async (route) => {
        outside.push(new URL(route.request().url()).host);
        await route.abort();
    });

    const run = `interview-${project}-${Date.now()}`;
    const control = async (op: Record<string, unknown> = {}) => (await page.request.post(`${HARNESS}/state?run=${run}`, { data: op })).json();
    const button = (name: string | RegExp, scope: Page | Locator = page) => scope.getByRole("button", { name, exact: typeof name === "string" });
    const answer = page.locator("#interview-answer");
    const alert = page.getByRole("alert").filter({ hasText: /\S/ });
    const main = page.locator("main main");
    const onQuestion = (n: number) => expect(page.getByText(`Question ${n} of 8`)).toBeVisible();
    const next = async (text: string) => { await use.fill(answer, text); await use.activate(button(/Save and continue|Try again/)); };
    const draftBox = page.getByLabel("Put together from your answers");
    const fact = (field: string) => page.locator(`[data-interview-fact="${field}"]`);

    try {
        await page.goto(`${HARNESS}?run=${run}`);
        await onQuestion(1);
        await expect(page.getByText("What work does your business do most?")).toBeVisible();
        await expect(page.getByRole("link", { name: "Enter details by hand instead" })).toHaveAttribute("href", "/dashboard/settings/profile");
        await recorder.checkpoint("interview-first-question", { scope: "main main" });

        await next("Kitchen and bathroom fitting");
        await onQuestion(2);
        await expect(page.getByText("What year did this business start trading?")).toBeVisible();
        await recorder.checkpoint("interview-business-started", { scope: "main main" });

        // How long the business has traded is asked as a year, apart from personal experience.
        await next("17");
        await expect(alert).toContainText("Enter the year as four numbers");
        await onQuestion(2);
        await next("2021");
        await onQuestion(3);
        await expect(page.getByText("How long have you personally been doing this kind of work?")).toBeVisible();
        await next("22 years as a joiner");

        // Skip, carry on, come back.
        await onQuestion(4);
        await use.activate(button("Skip"));
        await onQuestion(5);
        await next("Homeowners and local landlords");
        await onQuestion(6);
        await use.activate(button("Back"));
        await onQuestion(5);
        await expect(answer).toHaveValue("Homeowners and local landlords");
        await use.activate(button("Back"));
        await onQuestion(4);
        await expect(page.getByText("You skipped this one.")).toBeVisible();
        await next("Leeds");
        await onQuestion(5);
        const savesBefore = (await control()).saves;
        await use.activate(button("Save and continue"));
        await onQuestion(6);
        expect((await control()).saves, "an unchanged answer is not saved again").toBe(savesBefore);

        // A save fails: the words stay, and it can be retried.
        await control({ fail: "company_interview_save_answer" });
        await next("We tidy up every day and turn up when we say we will");
        await expect(alert).toContainText("Nothing was changed");
        await expect(answer).toHaveValue("We tidy up every day and turn up when we say we will");
        await recorder.checkpoint("interview-save-failed", { scope: "main main" });
        await use.activate(button("Try again"));
        await onQuestion(7);

        // Leave and come back: the interview resumes where it was left.
        await page.reload();
        await onQuestion(7);
        await expect(page.getByText("Do you hold any trade memberships or qualifications")).toBeVisible();
        await next("Gas Safe registered, number 123456");
        await onQuestion(8);
        await expect(page.getByText("What insurance do you want clients to know you have?")).toBeVisible();
        // An answer is changed somewhere else in the instant the draft is being put together.
        // The draft that appears must be written from the newer answer, never the older one.
        await control({ raceAnswer: ["area", "Leeds and Bradford"] });
        await next("Public liability £2 million");

        // The draft: built from the answers, nothing saved to the profile.
        await expect(page.getByRole("heading", { level: 1, name: "Your introduction" })).toBeVisible();
        await expect(draftBox).toHaveValue(
            "Smith Builders specialises in kitchen and bathroom fitting. We cover Leeds and Bradford. We mainly work for homeowners and local landlords. The business has been trading since 2021. Experience in the trade: 22 years as a joiner.\n\nHow we work: we tidy up every day and turn up when we say we will.",
        );
        await expect(main).toContainText("Built by fixed rules from your answers to questions 1, 2, 3, 4, 5, 6. Nothing has been added.");
        await expect(main).not.toContainText(/Evil Website|NICEIC/);
        await expect(fact("years_trading")).toContainText("5");
        await expect(fact("accreditations")).toContainText("Gas Safe registered, number 123456");
        await expect(fact("insurance_details")).toContainText("Public liability £2 million");
        const previewed = await control();
        expect(previewed.profile, "a draft changes nothing on the profile").toMatchObject(EMPTY_PROFILE);
        expect(previewed.tablesRead, "website suggestions are never read").toEqual(["company_interview_answers", "company_narrative_drafts", "profiles"]);
        expect(previewed.draftSaves, "the save written from the older answer was refused, and one from the newer answer accepted").toBe(2);
        expect(previewed.draftTexts, "no draft holds the older answer").toHaveLength(1);
        expect(previewed.draftTexts[0]).toContain("We cover Leeds and Bradford.");
        await recorder.checkpoint("interview-review", { scope: "main main" });
        await recorder.checkpoint("interview-review-facts", { scope: "main main", focusOn: fact("accreditations") });

        // An answer changes somewhere else after the draft was built: nothing from the old draft can be saved.
        await control({ lateAnswer: ["area", "Leeds, Bradford and York"] });
        await use.activate(button("Save as my introduction"));
        await expect(alert).toContainText("changed after this was put together, so nothing was saved");
        await expect(draftBox).toHaveValue(/We cover Leeds, Bradford and York\./);
        expect((await control()).profile).toMatchObject(EMPTY_PROFILE);
        await recorder.checkpoint("interview-answers-changed", { scope: "main main" });

        // The business name is changed on the Profile form after the draft was written.
        // The draft names the old business, so it cannot be saved as it stands.
        await control({ profile: ["company_name", "Smith & Daughters Ltd"] });
        await use.activate(button(/Save as my introduction|Try again/));
        await expect(alert).toContainText("changed after this was put together, so nothing was saved");
        await expect(draftBox).toHaveValue(/^Smith & Daughters Ltd specialises in/);
        expect((await control()).profile).toMatchObject(EMPTY_PROFILE);
        await recorder.checkpoint("interview-business-name-changed", { scope: "main main" });

        // The profile is edited by hand somewhere else: it is not overwritten.
        await control({ profile: ["capability_statement", "Typed by hand in another tab"] });
        await use.activate(button(/Save as my introduction|Try again/));
        await expect(page.getByRole("status").filter({ hasText: "Your profile changed after this was shown" })).toBeVisible();
        await expect(main).toContainText("Typed by hand in another tab");
        expect((await control()).profile.capability_statement).toBe("Typed by hand in another tab");
        await recorder.checkpoint("interview-profile-changed", { scope: "main main" });

        // The contractor rewords it. The record cannot be written once; nothing changes; the retry saves it as their words.
        const own = "Smith & Daughters fits kitchens and bathrooms across Leeds and Bradford. Family run.";
        await use.fill(draftBox, own);
        await expect(main).toContainText("You have changed the wording, so it will be saved as your own words.");
        await control({ fail: "record-approval" });
        await use.activate(button("Replace my introduction with this"));
        await expect(alert).toContainText("Nothing was changed");
        await expect(draftBox).toHaveValue(own);
        expect((await control()).profile.capability_statement).toBe("Typed by hand in another tab");
        await use.activate(button("Try again"));
        await expect(main).toContainText("Saved to your profile, with your own changes to the wording.");
        const approved = await control();
        expect(approved.profile).toMatchObject({ capability_statement: own, years_trading: null, accreditations: null, insurance_details: null });
        expect(approved.drafts.at(-1)).toEqual({ status: "approved", edited: true, generator: "template" });

        // Facts are saved one at a time, word for word.
        await use.activate(button("Save memberships and qualifications on my profile"));
        await expect(fact("accreditations")).toContainText("Saved to your profile.");
        expect((await control()).profile).toMatchObject({ accreditations: "Gas Safe registered, number 123456", insurance_details: null, years_trading: null });
        await recorder.checkpoint("interview-approved", { scope: "main main" });

        // As shipped, AI wording is off: the whole journey above made no provider call and touched no budget.
        const shipped = await control();
        expect(shipped.providerCalls, "no provider call with AI wording off").toBe(0);
        expect(shipped.aiAttempts, "no attempt reserved with AI wording off").toEqual([]);
        expect(shipped.budgetCalls, "the budget was not even consulted").toBe(0);
        expect(shipped.drafts.every((entry: { generator: string }) => entry.generator === "template")).toBe(true);
        await expect(main).not.toContainText(/Reword it|writing assistant|Show the plain version/);

        expect(outside.filter((host) => !["plausible.io", "www.clarity.ms"].includes(host)), "no outside host was contacted").toEqual([]);
        if (keyboardRun) {
            recorder.keyboard(focusLog);
            expect(recorder.results.keyboard?.withoutVisibleFocus, "every control reached by keyboard shows where focus is").toEqual([]);
        }
        recorder.write(testInfo.errors.length === 0 ? "passed" : "failed");
    } catch (error) {
        recorder.write("failed");
        throw error;
    }
});

/**
 * The switched-on screen, shown with a CANNED generator. AI wording is on
 * here only because this fixture run asks for it by name; the application
 * ships with it off. The replies are ones this spec wrote. Nothing here is
 * evidence about what a real model writes.
 */
test("Interview AI wording (canned, switched on in the fixture only): plain and reworded versions, quiet fallback, edit and approve", async ({ page, context, hasTouch }, testInfo) => {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    const focusLog: FocusRecord[] = [];
    const use = keyboardRun ? keyboardDriver(page, focusLog) : pointerDriver(Boolean(hasTouch));
    const recorder = new Recorder(page, testInfo, keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", process.env.E2E_EVIDENCE === "1", { evidence: "docs/evidence/stage2-tranche-2g3/ai-wiring", smoke: "test-results/import-fixture/ai-wiring" });

    const outside: string[] = [];
    await context.route((url) => url.hostname !== "127.0.0.1", async (route) => {
        outside.push(new URL(route.request().url()).host);
        await route.abort();
    });

    const run = `ai-${project}-${Date.now()}`;
    const control = async (op: Record<string, unknown> = {}) => (await page.request.post(`${HARNESS}/state?run=${run}`, { data: op })).json();
    const button = (name: string | RegExp, scope: Page | Locator = page) => scope.getByRole("button", { name, exact: typeof name === "string" });
    const answer = page.locator("#interview-answer");
    const main = page.locator("main main");
    const onQuestion = (n: number) => expect(page.getByText(`Question ${n} of 8`)).toBeVisible();
    const next = async (text: string) => { await use.fill(answer, text); await use.activate(button(/Save and continue|Try again/)); };
    const skip = () => use.activate(button("Skip"));
    const plainBox = page.getByLabel("Put together from your answers");
    const wordedBox = page.getByLabel("Worded for you from your answers");
    const quiet = page.getByRole("status").filter({ hasText: "here is the plain version" });

    const WORDED = "Smith Builders fits kitchens and bathrooms in Leeds. The business has been trading since 2021.\n\nWe tidy up every day.";
    const PLAIN = "Smith Builders specialises in kitchen and bathroom fitting. We cover Leeds. The business has been trading since 2021.\n\nHow we work: we tidy up every day.";

    try {
        await page.goto(`${HARNESS}?run=${run}`);
        await onQuestion(1);
        await next("Kitchen and bathroom fitting");
        await next("2021");
        await onQuestion(3);
        await skip();
        await next("Leeds");
        await onQuestion(5);
        await skip();
        await next("We tidy up every day");
        await onQuestion(7);
        await next("Gas Safe registered");
        await onQuestion(8);
        expect((await control()).providerCalls, "answering questions never calls the provider").toBe(0);

        // Finishing the interview asks for one reworded draft.
        await control({ aiReply: { text: WORDED } });
        await skip();
        await expect(page.getByRole("heading", { level: 1, name: "Your introduction" })).toBeVisible();
        await expect(wordedBox).toHaveValue(WORDED);
        await expect(main).toContainText("Worded by our writing assistant from your answers to questions 1, 2, 4, 6. It can get things wrong, so check it says only what you told us.");
        await expect(main).toContainText("Nothing saved");
        await expect(main).not.toContainText(/Gas Safe registered\.|verified/i);
        const worded = await control();
        expect(worded).toMatchObject({ providerCalls: 1, aiAttempts: ["ok"], aiCharged: [120] });
        expect(worded.drafts.at(-1)).toEqual({ status: "draft", edited: null, generator: "ai" });
        expect(worded.profile.capability_statement, "a reworded draft changes nothing on the profile").toBeNull();
        expect(worded.tablesRead).toEqual(["company_interview_answers", "company_narrative_drafts", "profiles"]);
        await recorder.checkpoint("ai-worded-draft", { scope: "main main" });

        // The plain version is one tap away and costs nothing.
        await use.activate(button("Show the plain version"));
        await expect(plainBox).toHaveValue(PLAIN);
        await expect(main).toContainText("Built by fixed rules");
        expect((await control()).providerCalls, "the plain version makes no call").toBe(1);
        await recorder.checkpoint("ai-plain-version", { scope: "main main" });

        // A reworded reply that adds a claim is not shown: plain version, one quiet line, no block.
        await control({ aiReply: { text: "Smith Builders is an award-winning kitchen and bathroom fitter in Leeds." } });
        await use.activate(button("Reword it for me"));
        await expect(quiet).toContainText("We couldn't reword it just now, so here is the plain version.");
        await expect(plainBox).toHaveValue(PLAIN);
        await expect(main).not.toContainText("award-winning");
        expect(await control()).toMatchObject({ providerCalls: 2, aiAttempts: ["ok", "rejected:tripwire"] });
        await recorder.checkpoint("ai-quiet-fallback", { scope: "main main" });

        // The provider fails: the same quiet fallback, charged, no retry.
        await control({ aiReply: { error: true } });
        await use.activate(button("Reword it for me"));
        await expect(quiet).toBeVisible();
        expect(await control()).toMatchObject({ providerCalls: 3, aiAttempts: ["ok", "rejected:tripwire", "error"], aiCharged: [120, 120, 500] });

        // The allowance is used up: nothing is called, and nothing blocks.
        await control({ aiAllowance: "used-up" });
        await use.activate(button("Reword it for me"));
        await expect(quiet).toContainText("You can try again later.");
        await expect(plainBox).toHaveValue(PLAIN);
        await expect(button(/Save as my introduction/)).toBeEnabled();
        expect((await control({ aiAllowance: "normal" })).providerCalls, "a refused allowance makes no call").toBe(3);

        // Reworded again on request; leaving and coming back shows it without another call.
        await control({ aiReply: { text: WORDED } });
        await use.activate(button("Reword it for me"));
        await expect(wordedBox).toHaveValue(WORDED);
        await page.reload();
        await expect(wordedBox).toHaveValue(WORDED);
        expect((await control()).providerCalls, "loading the page never calls the provider").toBe(4);

        // The contractor changes the wording and approves: saved as their own words.
        const own = "Smith Builders fits kitchens and bathrooms in and around Leeds. We tidy up every day.";
        await use.fill(wordedBox, own);
        await expect(main).toContainText("You have changed the wording, so it will be saved as your own words.");
        await use.activate(button("Save as my introduction"));
        await expect(main).toContainText("Saved to your profile, with your own changes to the wording.");
        const approved = await control();
        expect(approved.profile).toMatchObject({ capability_statement: own, accreditations: null, years_trading: null });
        expect(approved.drafts.at(-1)).toEqual({ status: "approved", edited: true, generator: "ai" });
        expect(approved.providerCalls, "approving never calls the provider").toBe(4);
        expect(approved.aiAttempts).toEqual(["ok", "rejected:tripwire", "error", "ok"]);
        await recorder.checkpoint("ai-edited-and-approved", { scope: "main main" });

        expect(outside.filter((host) => !["plausible.io", "www.clarity.ms"].includes(host)), "no outside host was contacted").toEqual([]);
        if (keyboardRun) {
            recorder.keyboard(focusLog);
            expect(recorder.results.keyboard?.withoutVisibleFocus, "every control reached by keyboard shows where focus is").toEqual([]);
        }
        recorder.write(testInfo.errors.length === 0 ? "passed" : "failed");
    } catch (error) {
        recorder.write("failed");
        throw error;
    }
});
