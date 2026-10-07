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
        await next("Public liability £2 million");

        // The draft: built from the answers, nothing saved to the profile.
        await expect(page.getByRole("heading", { level: 1, name: "Your introduction" })).toBeVisible();
        await expect(draftBox).toHaveValue(
            "Smith Builders specialises in kitchen and bathroom fitting. We cover Leeds. We mainly work for homeowners and local landlords. The business has been trading since 2021. Experience in the trade: 22 years as a joiner.\n\nHow we work: we tidy up every day and turn up when we say we will.",
        );
        await expect(main).toContainText("Built by fixed rules from your answers to questions 1, 2, 3, 4, 5, 6. Nothing has been added.");
        await expect(main).not.toContainText(/Evil Website|NICEIC/);
        await expect(fact("years_trading")).toContainText("5");
        await expect(fact("accreditations")).toContainText("Gas Safe registered, number 123456");
        await expect(fact("insurance_details")).toContainText("Public liability £2 million");
        const previewed = await control();
        expect(previewed.profile, "a draft changes nothing on the profile").toMatchObject(EMPTY_PROFILE);
        expect(previewed.tablesRead, "website suggestions are never read").toEqual(["company_interview_answers", "company_narrative_drafts", "profiles"]);
        await recorder.checkpoint("interview-review", { scope: "main main" });
        await recorder.checkpoint("interview-review-facts", { scope: "main main", focusOn: fact("accreditations") });

        // An answer changes somewhere else after the draft was built: nothing from the old draft can be saved.
        await control({ lateAnswer: ["area", "Leeds and Bradford"] });
        await use.activate(button("Save as my introduction"));
        await expect(alert).toContainText("Your answers changed after this was put together, so nothing was saved");
        await expect(draftBox).toHaveValue(/We cover Leeds and Bradford\./);
        expect((await control()).profile).toMatchObject(EMPTY_PROFILE);
        await recorder.checkpoint("interview-answers-changed", { scope: "main main" });

        // The profile is edited by hand somewhere else: it is not overwritten.
        await control({ profile: ["capability_statement", "Typed by hand in another tab"] });
        await use.activate(button(/Save as my introduction|Try again/));
        await expect(page.getByRole("status").filter({ hasText: "Your profile changed after this was shown" })).toBeVisible();
        await expect(main).toContainText("Typed by hand in another tab");
        expect((await control()).profile.capability_statement).toBe("Typed by hand in another tab");
        await recorder.checkpoint("interview-profile-changed", { scope: "main main" });

        // The contractor rewords it. The record cannot be written once; nothing changes; the retry saves it as their words.
        const own = "Smith Builders fits kitchens and bathrooms across Leeds and Bradford. Family run.";
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
