import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { publicationRecords, syntheticUserExists } from "./support/backend";
import { luminance } from "./support/checks";
import { keyboardDriver, pointerDriver, type Driver, type FocusRecord } from "./support/driver";
import { APPROVED_DISPOSABLE_PROJECT, SYNTHETIC_EMAIL_DOMAIN, readE2EEnv } from "./support/env";
import { AI_MARKER, COMPANY, JOB, PAYMENT_STAGES, PRICE, STAGES, expectedPrice, expectedProgramme } from "./support/journey-data";
import { failNextServerAction, guardNetwork, stubControl, stubLog } from "./support/harness";
import { EVIDENCE_DIR, Recorder } from "./support/recorder";

const env = readE2EEnv();
const money = expectedPrice();
const programme = expectedProgramme();

/** Third-party hosts the pages ask for. All are blocked; none is needed for the journey. */
const EXPECTED_THIRD_PARTIES = ["plausible.io", "www.clarity.ms", "api.postcodes.io"];
const RESPONSE = {
    acknowledgement: {
        option: "Ask the client to confirm they have received it",
        heading: "Confirm you have received this proposal",
        notice: "It is not acceptance of the proposal and does not create a contract.",
        action: "Confirm receipt",
        recorded: "Receipt confirmed",
        history: "Receipt confirmed",
        askedFor: "confirmation of receipt",
        pdfLine: "Client: receipt confirmed",
    },
    nonBindingIntent: {
        option: "Ask the client whether they intend to go ahead",
        heading: "Tell us you intend to go ahead",
        notice: "Saying you intend to proceed is not binding on you or the contractor.",
        action: "I intend to proceed (not binding)",
        recorded: "Intention to proceed recorded",
        history: "Intention to proceed (not binding)",
        askedFor: "a non-binding intention to proceed",
        pdfLine: "Client: intention to proceed (not binding)",
    },
};

/** Nothing on the Phase 1 path may offer the client a binding acceptance. */
const BINDING_ACCEPTANCE_CONTROL = /^(accept|accept (the |this )?proposal|i accept|sign and accept|agree and sign)/i;

async function pdfText(file: string): Promise<{ pages: number; text: string }> {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return { pages: totalPages, text: text.replace(/\s+/g, " ") };
}

test("Phase 1 journey: sign up to a recorded client response", async ({ page, context, browser, viewport, hasTouch, isMobile, deviceScaleFactor, locale, timezoneId }, testInfo) => {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    const focusLog: FocusRecord[] = [];
    const driverFor = (target: Page): Driver => (keyboardRun ? keyboardDriver(target, focusLog) : pointerDriver(Boolean(hasTouch)));
    const use = driverFor(page);
    const recorder = new Recorder(page, testInfo, keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", env.evidence);
    const blockedHosts = new Set<string>();
    await guardNetwork(context, blockedHosts);
    await stubControl({ reset: true });

    const email = `e2e-${env.runId}-${project}-${randomBytes(3).toString("hex")}@${SYNTHETIC_EMAIL_DOMAIN}`;
    const password = process.env.E2E_SYNTHETIC_PASSWORD?.trim() || `E2e-${randomBytes(12).toString("base64url")}`;
    const main = page.locator("main main");
    const button = (name: string | RegExp, scope: Page | Locator = page) => scope.getByRole("button", { name, exact: typeof name === "string" });
    let projectId = "";

    /** Opens a fresh browser with no session: the client's view. */
    const asClient = async (url: string) => {
        const clientContext = await browser.newContext({ viewport, hasTouch, isMobile, deviceScaleFactor, locale, timezoneId });
        await guardNetwork(clientContext, blockedHosts);
        const clientPage = await clientContext.newPage();
        await clientPage.goto(url);
        return { clientContext, clientPage, client: driverFor(clientPage) };
    };

    /**
     * Changes the application theme. The switch lives in the side navigation.
     * A phone has no switch of its own and follows the preference saved for
     * the account, which is what is set here.
     */
    const switchTheme = async () => {
        const toggle = page.locator("aside").getByRole("button", { name: /^(Full Dark Theme|Default Theme)$/ });
        if (await toggle.first().isVisible()) {
            await use.activate(toggle.first());
            return;
        }
        await page.evaluate(() => localStorage.setItem("constructa-theme", localStorage.getItem("constructa-theme") === "dark" ? "system-c" : "dark"));
        await page.reload();
    };

    const openProjectTab = async (name: "Brief" | "Estimating" | "Programme" | "Proposal") => {
        await use.activate(main.getByRole("navigation").first().getByRole("link", { name, exact: true }));
    };

    try {
        // ── 1. Account ───────────────────────────────────────────────────────
        await test.step("signed-out visitors cannot open the dashboard", async () => {
            recorder.step("protected route redirects to sign in");
            await page.goto("/dashboard");
            await expect(page).toHaveURL(/\/login$/);
        });

        await test.step("sign up and sign in", async () => {
            recorder.step("sign up, then sign in");
            await use.activate(button("Sign up"));
            await use.fill(page.getByLabel("Email address"), email);
            await use.fill(page.getByLabel("Password", { exact: true }), password);
            await use.fill(page.getByLabel("Confirm password"), password);
            const signup = page.waitForResponse((response) => response.url().includes("/auth/v1/signup"));
            await use.activate(button("Create account"));
            const signupResponse = await signup;

            // Where the account was created is the isolation proof.
            expect(new URL(signupResponse.url()).host).toBe(`${APPROVED_DISPOSABLE_PROJECT.ref}.supabase.co`);
            expect(signupResponse.status()).toBe(200);
            const created = await signupResponse.json();
            const userId = String(created.user?.id ?? created.id ?? "");
            expect(await syntheticUserExists(userId, email), "the new account exists in the disposable project").toBe(true);
            recorder.results.database.accountCreatedIn = APPROVED_DISPOSABLE_PROJECT.name;
            await expect(page.getByText("Account created.")).toBeVisible();
            await recorder.checkpoint("account-created", { scope: "form" });

            await context.clearCookies();
            await page.goto("/login");
            await recorder.checkpoint("sign-in", { scope: "form", capture: false });
            await use.fill(page.getByLabel("Email address"), email);
            await use.fill(page.getByLabel("Password", { exact: true }), password);
            await use.activate(button("Sign in"));
            await expect(page).toHaveURL(/\/onboarding$/);
        });

        // ── 2. Company setup ─────────────────────────────────────────────────
        await test.step("short company setup", async () => {
            recorder.step("company setup: the work in the contractor's words, then business name");
            await expect(page.getByText("Step 1 of 2")).toBeVisible();
            await use.activate(button("Save and continue"));
            await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
            await recorder.checkpoint("setup-trade-needed", { scope: "form", capture: false });

            await use.fill(page.getByRole("textbox", { name: "What kind of work does your business do?" }), COMPANY.trade);
            await use.activate(button(/Save and continue|Try again/));
            await expect(page.getByText("Step 2 of 2")).toBeVisible();
            await use.fill(page.getByLabel("Business or trading name"), COMPANY.name);
            await use.fill(page.getByLabel(/Your name/), COMPANY.owner);
            await recorder.checkpoint("setup-business", { scope: "form" });
            await use.activate(button("Save and continue"));

            // Setup lands on proposal readiness; the first project is one step on.
            await expect(page).toHaveURL(/\/dashboard\/settings\/profile\/readiness$/);
            await expect(main.getByRole("heading", { level: 1, name: COMPANY.name })).toBeVisible();
            await recorder.checkpoint("setup-readiness", { scope: "main main", capture: false });
            await use.activate(main.getByRole("link", { name: "Create first project" }));
            await expect(page).toHaveURL(/\/dashboard\/projects\/new$/);
        });

        // ── 3. First project ─────────────────────────────────────────────────
        await test.step("one blank project", async () => {
            recorder.step("zero projects, then the first blank project");
            await expect(page.getByRole("heading", { level: 1, name: "Add your first job" })).toBeVisible();
            await use.activate(button("Create project and start the brief"));
            await expect(page.getByLabel("Job name")).toHaveAttribute("aria-invalid", "true");
            await use.fill(page.getByLabel("Job name"), JOB.name);
            await use.fill(page.getByLabel("Client name"), JOB.client);
            await use.activate(button(/Add more details/));
            await use.fill(page.getByLabel("Client email"), JOB.clientEmail);
            await use.fill(page.getByLabel("Where is the job?"), JOB.site);
            await recorder.checkpoint("first-project", { scope: "main main" });
            await use.activate(button("Create project and start the brief"));
            await expect(page).toHaveURL(/\/dashboard\/projects\/brief\?projectId=/);
            projectId = new URL(page.url()).searchParams.get("projectId") ?? "";
            expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
        });

        // ── 4. Guided brief ──────────────────────────────────────────────────
        await test.step("guided brief: a suggestion stays pending until applied", async () => {
            recorder.step("brief: suggestion pending until Apply, then confirmed");
            const description = page.getByLabel("Describe the job in your own words");
            await use.fill(description, JOB.description);
            await use.activate(button("Tidy this up for me"));

            const suggestion = page.getByRole("region", { name: "From the assistant" });
            await expect(suggestion.getByText("Suggestion · not applied")).toBeVisible();
            await expect(suggestion).toContainText(AI_MARKER);
            // The contractor's own words are untouched until they choose Apply.
            await expect(description).toHaveValue(JOB.description);
            await recorder.checkpoint("brief-suggestion-pending", { scope: "main main" });

            await use.activate(button("Apply", suggestion));
            await expect(description).toHaveValue(`${JOB.description} ${AI_MARKER}`);
            await expect(main.getByRole("status").filter({ hasText: "Unsaved" })).toBeVisible();

            await use.activate(button("Next"));
            await expect(button("Bathroom Installation")).toHaveAttribute("aria-pressed", "true");
            await use.activate(button("Next"));
            await use.fill(page.getByLabel("Access, restrictions and assumptions"), JOB.siteNotes);
            await use.activate(button("Next"));
            await expect(page.getByRole("heading", { level: 2, name: "Review and confirm" })).toBeVisible();
            await recorder.checkpoint("brief-review", { scope: "main main" });
            await use.activate(button("Save and build the price"));
            await expect(page).toHaveURL(/\/dashboard\/projects\/costs\?projectId=/);
        });

        // ── 5. Estimate ──────────────────────────────────────────────────────
        await test.step("simple estimate with explicit preliminaries and a non-default risk", async () => {
            recorder.step("estimate: three lines, explicit Preliminaries, risk 7.5%");
            const lines = page.getByRole("region", { name: "Price lines" });
            const total = page.getByRole("region", { name: "Running total" });

            await use.activate(button("Add the first price line"));
            await use.fill(page.getByLabel("What is this price for?"), PRICE.onePrice.description);
            await use.fill(page.getByLabel("Price (£)"), String(PRICE.onePrice.amount));
            await use.activate(button("Save line"));
            await expect(lines.getByRole("listitem")).toHaveCount(1);

            await use.activate(button("Add a price line"));
            await use.fill(page.getByLabel("What is this price for?"), PRICE.measured.description);
            await use.activate(button("Quantity and rate"));
            await use.fill(page.getByLabel("Quantity"), String(PRICE.measured.quantity));
            await use.select(page.getByLabel("Unit"), PRICE.measured.unit);
            await use.fill(page.getByLabel("Rate (£)"), String(PRICE.measured.rate));
            await use.activate(button("Save line"));
            await expect(lines.getByRole("listitem")).toHaveCount(2);

            // Preliminaries priced as their own line, in the advanced bill of quantities.
            const advanced = page.getByRole("region", { name: "Advanced estimating" });
            await use.activate(button(/^Advanced estimating/, advanced));
            await use.activate(button("+ Preliminaries", advanced));
            const prelims = advanced.getByRole("group", { name: "Preliminaries" });
            await use.fill(prelims.getByLabel("Description"), PRICE.preliminaries.description);
            await use.fill(prelims.getByLabel("Rate (£)"), String(PRICE.preliminaries.amount));
            // The advanced workspace is checked while open. Its compact controls are reported, not enforced.
            if (!keyboardRun) await recorder.checkpoint("estimate-advanced-open", { scope: "main main" });
            await use.activate(button(/^Advanced estimating/, advanced));
            await expect(lines.getByRole("listitem")).toHaveCount(3);
            await expect(lines).toContainText("Preliminaries · 1 nr × £450.00");

            await use.activate(button(/^Price adjustments/));
            await expect(total).toContainText("You have priced preliminaries as your own lines, so this percentage is not used.");
            await use.fill(page.getByLabel("Overhead (%)"), String(PRICE.overheadPct));
            await use.fill(page.getByLabel("Risk (%)"), String(PRICE.riskPct));
            await use.fill(page.getByLabel("Profit (%)"), String(PRICE.profitPct));
            await use.activate(button("Save adjustments"));
            await expect(button("No changes to save")).toBeVisible();

            for (const figure of [money.lines, money.overhead, money.risk, money.profit, money.beforeVat, money.vat, money.includingVat]) {
                await expect(total).toContainText(figure);
            }
            await expect(total).toContainText(`Risk (${PRICE.riskPct}%)`);
            // Nothing typed on this screen was refused by the server.
            await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
            recorder.results.parity.estimate = { beforeVat: money.beforeVat, vat: money.vat, includingVat: money.includingVat };
            await recorder.checkpoint("estimate-priced", { scope: "main main", focusOn: total });
        });

        // ── 6. Readiness ─────────────────────────────────────────────────────
        await test.step("an incomplete proposal cannot be sent", async () => {
            recorder.step("review: sending blocked until programme and payment stages exist");
            await openProjectTab("Proposal");
            await expect(page.getByRole("heading", { level: 1, name: "Review and send" })).toBeVisible();
            const needed = page.getByRole("region", { name: /needed before you can send/ });
            await expect(needed).toContainText("Programme Missing");
            await expect(needed).toContainText("Payment stages Missing");
            const send = page.getByRole("region", { name: "Send to your client" });
            await expect(button(/^Send version 1/, send)).toBeDisabled();
            // What is missing, and the way to fix each thing, is beside the controls it disables.
            const blocker = send.locator('[data-send-block="not-ready"]');
            await expect(blocker).toContainText("You can't send yet. 2 things are still needed.");
            await expect(blocker.locator('[data-send-missing="programme"]')).toContainText("Add the start date and how long the job takes in Programme.");
            await expect(blocker.getByRole("link", { name: "Open Programme" })).toHaveAttribute("href", `/dashboard/projects/schedule?projectId=${projectId}`);
            await expect(blocker.locator('[data-send-missing="payment"]')).toContainText("Choose how you are paid");
            await expect(blocker.getByRole("link", { name: "Choose how you are paid" })).toHaveAttribute("href", "#review-payments");
            await expect(button("Use payment on completion", blocker)).toBeVisible();
            await expect(button("Use a deposit and balance", blocker)).toBeVisible();
            const confirm = send.getByRole("checkbox", { name: /I have read the preview/ });
            await expect(confirm).toBeDisabled();
            await expect(confirm).toHaveAttribute("aria-describedby", "send-block-reason");
            await expect(button(/^Send version 1/, send)).toHaveAttribute("aria-describedby", "send-block-reason");
            // The price the client will be sent is the price the estimate shows.
            const price = page.getByRole("region", { name: "Price", exact: true }).first();
            await expect(price).toContainText(money.beforeVat);
            await expect(price).toContainText(money.includingVat);
            await recorder.checkpoint("review-not-ready", { scope: "main main" });
            await send.scrollIntoViewIfNeeded();
            await recorder.screenshot("review-send-blocked");
        });

        // ── 7. Programme ─────────────────────────────────────────────────────
        await test.step("programme: dates, stages, a failed save and its retry", async () => {
            recorder.step("programme: start, duration, finish, stages, save failure and retry");
            // The blocker beside Send is the way in: its link opens the programme directly.
            await use.activate(page.getByRole("region", { name: "Send to your client" }).locator('[data-send-block="not-ready"]').getByRole("link", { name: "Open Programme" }));
            await expect(page).toHaveURL(new RegExp(`/dashboard/projects/schedule\\?projectId=${projectId}$`));
            await expect(page.getByRole("heading", { level: 1, name: "Programme" })).toBeVisible();
            const timeline = page.getByRole("region", { name: "How it looks on the proposal" });
            const plannerToggle = button(/^Detailed programme planner/);
            const planner = page.locator("#detailed-planner");

            // Opening the detailed planner on a job with no programme offers a
            // starting point and saves nothing. It used to save one stage named
            // after the estimate's "General" section, which then went out on the proposal.
            if (!keyboardRun) {
                await use.activate(plannerToggle);
                await expect(planner.locator("[data-planner-suggestion]")).toContainText("They are not saved");
                const suggested = await planner.locator('input[type="text"], input:not([type])').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
                expect(suggested, "the planner suggests stages for this estimate").toContain("Works on site");
                expect(suggested, "the filing label is never a stage name").not.toContain("General");
                // Longer than the planner's own save delay.
                await page.waitForTimeout(1500);
                await use.activate(plannerToggle);
                await expect(page.getByLabel("Start on site")).toHaveValue("");
                await expect(page.getByLabel("How long it takes")).toHaveValue("");
                await expect(main.getByRole("status").filter({ hasText: "Nothing to save yet" })).toBeVisible();
                recorder.results.parity.plannerSuggestionNotSaved = true;
            }

            await use.fillDate(page.getByLabel("Start on site"), programme.startIso);
            await use.fill(page.getByLabel("How long it takes"), "3");
            await expect(page.getByRole("region", { name: "When does the job run?" })).toContainText(`Finishes ${programme.simpleFinish}`);
            await expect(timeline.getByRole("list", { name: "Programme stages" }).getByRole("listitem")).toHaveCount(1);

            await use.activate(button("Break the job into stages"));
            const rows = page.getByRole("region", { name: "Stages" }).getByRole("listitem");
            // An empty stage is refused with the reason, and nothing is lost.
            await use.activate(button("Save programme"));
            await expect(rows.first().getByText("Give this stage a name.")).toBeVisible();
            if (!keyboardRun) await recorder.checkpoint("programme-validation", { scope: "main main", capture: false });

            for (const [index, stage] of STAGES.entries()) {
                const row = rows.nth(index);
                await use.fill(row.getByRole("textbox").first(), stage.name);
                await use.fill(row.getByLabel("How long"), stage.length);
                await use.select(row.getByRole("combobox"), stage.unit);
            }
            await expect(timeline).toContainText(programme.start);
            await expect(timeline).toContainText(programme.stagedFinish);
            await expect(timeline.getByRole("list", { name: "Programme stages" }).getByRole("listitem")).toHaveCount(STAGES.length);

            // The planner takes the simple editor's place on screen. It is not
            // opened over stages that have been typed and not yet saved.
            await use.activate(plannerToggle);
            await expect(page.locator("[data-planner-refused]")).toContainText("Save your programme first.");
            await expect(plannerToggle).toHaveAttribute("aria-expanded", "false");
            for (const [index, stage] of STAGES.entries()) await expect(rows.nth(index).getByRole("textbox").first()).toHaveValue(stage.name);
            await recorder.checkpoint("programme-unsaved-planner-refused", { scope: "main main", focusOn: page.locator("[data-planner-refused]") });

            if (!keyboardRun) {
                await failNextServerAction(page);
                await use.activate(button(/^(Save programme|Try again)$/).last());
                await expect(main.getByRole("status").filter({ hasText: "Failed - try again" })).toBeVisible();
                await expect(rows.nth(1).getByRole("textbox").first()).toHaveValue(STAGES[1].name);
                await recorder.checkpoint("programme-save-failed", { scope: "main main" });
                await page.unroute("**/*");
            }
            await use.activate(button(/^(Save programme|Try again)$/).last());
            await expect(main.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
            recorder.results.parity.programme = { start: programme.start, finish: programme.stagedFinish, stages: programme.stages };
            await recorder.checkpoint("programme-saved", { scope: "main main", focusOn: timeline });

            // Reloading, and opening the planner on the saved programme, loses
            // nothing: the same stages, in the same order, with the same dates.
            const expectSavedStages = async () => {
                await expect(rows).toHaveCount(STAGES.length);
                for (const [index, stage] of STAGES.entries()) {
                    await expect(rows.nth(index).getByRole("textbox").first()).toHaveValue(stage.name);
                    await expect(rows.nth(index).getByLabel("How long")).toHaveValue(stage.length);
                }
                for (const stage of programme.stages) {
                    await expect(timeline).toContainText(stage.name);
                    await expect(timeline).toContainText(stage.dates);
                }
            };
            await page.reload();
            await expectSavedStages();
            if (!keyboardRun) {
                await use.activate(plannerToggle);
                await expect(planner.getByRole("heading", { level: 1, name: "Programme" })).toBeVisible();
                await expect(planner.locator("[data-planner-suggestion]")).toHaveCount(0);
                const opened = await planner.locator('input[type="text"], input:not([type])').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
                for (const stage of STAGES) expect(opened, "the planner opens on the saved stages").toContain(stage.name);
                expect(opened).not.toContain("General");
                expect(opened).not.toContain("Works on site");
                await page.waitForTimeout(1500);
                await use.activate(plannerToggle);
                await expectSavedStages();
            }
            await use.activate(button("Next: Proposal"));
            await expect(page).toHaveURL(/\/dashboard\/projects\/proposal\?projectId=/);
        });

        // ── 8. Review and send ───────────────────────────────────────────────
        const send = page.getByRole("region", { name: "Send to your client" });
        const preview = page.getByRole("region", { name: "What your client will see" }).getByRole("article");
        let firstLink = "";
        let checkCode = "";
        let draftPdfPages = 0;
        /** What every form of the document must state: the price, the stages with their dates, and how it is paid. */
        const documentFacts = [
            money.beforeVat, money.vat, money.includingVat,
            programme.stagedFinish,
            ...programme.stages.flatMap((stage) => [stage.name, stage.dates]),
            ...PAYMENT_STAGES.map((stage) => stage.name), money.deposit, money.balance,
        ];

        const publish = async (version: number): Promise<string> => {
            await use.check(send.getByRole("checkbox", { name: /I have read the preview/ }));
            await use.activate(button(`Send version ${version}`, send));
            await expect(send.getByText(`Version ${version} is published.`)).toBeVisible();
            const link = await send.getByLabel("Private link for your client").inputValue();
            // A link that pointed anywhere but the server under test would leave the test environment.
            expect(new URL(link).origin).toBe(env.baseUrl);
            expect(new URL(link).pathname).toMatch(/^\/proposal\/[a-f0-9]{64}$/);
            return link;
        };

        await test.step("review, then publish in acknowledgement mode", async () => {
            recorder.step("review: payment preset, parity, pre-send PDF, light document, acknowledgement default, publish v1");
            await expect(page.getByRole("heading", { level: 1, name: "Review and send" })).toBeVisible();
            const price = page.getByRole("region", { name: "Price", exact: true }).first();
            const payments = page.locator("[data-review-payments]");
            const blocker = send.locator('[data-send-block="not-ready"]');
            const confirm = send.getByRole("checkbox", { name: /I have read the preview/ });

            // One thing is left, and the Send section says which and how to fix it.
            await expect(blocker).toContainText("You can't send yet. 1 thing is still needed.");
            await expect(blocker.locator("[data-send-missing]")).toHaveCount(1);
            await expect(confirm).toBeDisabled();
            if (keyboardRun) {
                // One press, from beside the disabled controls. Focus moves on to the tick box it has just enabled.
                await use.activate(button("Use a deposit and balance", blocker));
                await expect(confirm).toBeFocused();
            } else {
                await use.activate(blocker.getByRole("link", { name: "Choose how you are paid" }));
                await expect(payments).toBeInViewport();
                await use.check(payments.getByRole("radio", { name: /Deposit and balance/ }));
            }
            // No arithmetic: the preset fills both stages and the balance follows the deposit.
            await expect(payments.getByRole("radio", { name: /Deposit and balance/ })).toBeChecked();
            await expect(payments.getByLabel("Deposit (%)")).toHaveValue(PAYMENT_STAGES[0].share);
            await expect(payments).toContainText(`The balance is ${PAYMENT_STAGES[1].share}%, due on completion.`);
            const summary = payments.locator("[data-payment-summary]");
            await expect(summary).toContainText(`${PAYMENT_STAGES[0].name} · ${PAYMENT_STAGES[0].when} · ${PAYMENT_STAGES[0].share}%`);
            await expect(summary).toContainText(money.deposit);
            await expect(summary).toContainText(`${PAYMENT_STAGES[1].name} · ${PAYMENT_STAGES[1].when} · ${PAYMENT_STAGES[1].share}%`);
            await expect(summary).toContainText(money.balance);
            // Readiness is true of the draft at once, before anything is saved.
            await expect(page.getByRole("heading", { level: 2, name: "Everything needed is in place" })).toBeVisible();
            await expect(blocker).toHaveCount(0);
            await expect(confirm).toBeEnabled();
            await expect(main.getByRole("status").filter({ hasText: "Unsaved" })).toBeVisible();
            await recorder.checkpoint("review-payment-preset", { scope: "main main", focusOn: payments });

            await use.fill(page.getByRole("textbox", { name: "Closing message" }), JOB.closing);
            await use.activate(button("Save draft"));
            await expect(main.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
            await expect(page.getByRole("heading", { level: 2, name: "Everything needed is in place" })).toBeVisible();

            // The same figures, dates and response wording at the review boundary.
            for (const figure of [money.beforeVat, money.vat, money.includingVat]) {
                await expect(price).toContainText(figure);
                await expect(preview).toContainText(figure);
            }
            await expect(preview).toContainText(programme.start);
            await expect(preview).toContainText(programme.stagedFinish);
            // Every saved stage, by name, in order, with its own dates. No invented stage.
            const previewStages = preview.getByRole("list", { name: "Programme stages" }).getByRole("listitem");
            await expect(previewStages).toHaveCount(programme.stages.length);
            for (const [index, stage] of programme.stages.entries()) {
                await expect(previewStages.nth(index)).toContainText(stage.name);
                await expect(previewStages.nth(index)).toContainText(stage.dates);
            }
            await expect(preview.getByRole("list", { name: "Programme stages" })).not.toContainText("General");
            for (const stage of PAYMENT_STAGES) await expect(preview).toContainText(stage.name);
            await expect(preview).toContainText(money.deposit);
            await expect(preview).toContainText(money.balance);
            await expect(preview.getByRole("heading", { name: RESPONSE.acknowledgement.heading })).toBeVisible();
            for (const hidden of ["Overhead", "Risk (", "Profit"]) await expect(preview).not.toContainText(hidden);
            recorder.results.parity.review = { beforeVat: money.beforeVat, vat: money.vat, includingVat: money.includingVat, finish: programme.stagedFinish, stages: programme.stages };
            await recorder.checkpoint("review-ready", { scope: "main main" });

            // The exact PDF, before anything is sent. Downloading it publishes nothing.
            const presend = page.locator("[data-presend-pdf]");
            const draftDownload = page.waitForEvent("download");
            await use.activate(button("Download this draft as a PDF", presend));
            const draftFile = await draftDownload;
            const draftPdf = await pdfText(await draftFile.path());
            checkCode = (await presend.locator("[data-check-code]").innerText()).trim();
            expect(checkCode).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
            await expect(presend.locator("[data-presend-pdf-result]")).toContainText(`Check code ${checkCode}. Nothing has been sent.`);
            expect(draftPdf.text).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");
            expect(draftPdf.text).toContain(`Check code ${checkCode}.`);
            for (const fact of documentFacts) expect(draftPdf.text, `the pre-send PDF states ${fact}`).toContain(fact);
            expect(draftPdf.text).toContain(RESPONSE.acknowledgement.pdfLine);
            expect(draftPdf.text).not.toMatch(/Overhead|Profit/);
            expect(await publicationRecords(projectId), "downloading the draft PDF publishes nothing").toEqual([]);
            draftPdfPages = draftPdf.pages;
            recorder.results.parity["pdf-presend-draft"] = { pages: draftPdf.pages, checkCode, includingVat: money.includingVat, finish: programme.stagedFinish, stages: programme.stages, published: false };
            if (env.evidence && project === "desktop") await draftFile.saveAs(`${EVIDENCE_DIR}/proposal-presend-draft.pdf`);
            await recorder.checkpoint("review-presend-pdf", { scope: "main main", focusOn: presend });

            // The client's document stays a light page in either application theme.
            const tones: Record<string, { page: number | null; document: number | null }> = {};
            for (const theme of ["first", "second"]) {
                tones[theme] = {
                    page: luminance(await price.evaluate((card) => getComputedStyle(card).backgroundColor)),
                    document: luminance(await preview.evaluate((article) => getComputedStyle(article).backgroundColor)),
                };
                expect(tones[theme].document, "the proposal document has a light background").toBeGreaterThan(0.8);
                if (theme === "first") await switchTheme();
            }
            // One theme is light and the other dark, so the toggle really changed the application.
            expect(Math.abs((tones.first.page ?? 0) - (tones.second.page ?? 0)), "the application theme changed").toBeGreaterThan(0.6);
            recorder.results.parity.documentLuminanceByTheme = tones;
            await preview.scrollIntoViewIfNeeded();
            await recorder.screenshot("review-other-theme-document-stays-light");
            await switchTheme();

            // Acknowledgement is what a new send asks for unless the contractor changes it.
            const options = send.getByRole("radio");
            await expect(options).toHaveCount(2);
            await expect(send.getByRole("radio", { name: new RegExp(RESPONSE.acknowledgement.option) })).toBeChecked();
            await expect(send).toContainText("Neither option is acceptance.");
            await expect(page.getByRole("button", { name: BINDING_ACCEPTANCE_CONTROL })).toHaveCount(0);
            await recorder.checkpoint("send-acknowledgement-default", { scope: "main main", focusOn: send });

            // The email fails once. The publication stands and only the email is retried.
            if (!keyboardRun) await stubControl({ failEmails: 1 });
            await expect(send).toContainText(`Check code for what will be sent: ${checkCode}.`);
            firstLink = await publish(1);
            // What was published is what was checked: the server sends only that content.
            await expect(send.locator("[data-published-check]")).toContainText(checkCode);
            if (!keyboardRun) {
                await expect(send.locator('[data-delivery="failed"]')).toContainText("The proposal is published, but the email");
                await recorder.checkpoint("published-email-failed", { scope: "main main", focusOn: send.locator('[data-send-result="published"]') });
                await use.activate(button("Try the email again", send));
            }
            await expect(send.locator('[data-delivery="sent"]')).toContainText(JOB.clientEmail);
            await expect(send.getByLabel("Private link for your client")).toHaveValue(firstLink);
            await recorder.checkpoint("published-email-sent", { scope: "main main", focusOn: send.locator('[data-send-result="published"]') });
        });

        // ── 9. The client ────────────────────────────────────────────────────
        const clientView = async (link: string, wording: typeof RESPONSE.acknowledgement, label: string) => {
            const { clientContext, clientPage, client } = await asClient(link);
            const document = clientPage.getByRole("article");
            await expect(document.getByRole("heading", { level: 1, name: JOB.name })).toBeVisible();
            for (const figure of [money.beforeVat, money.vat, money.includingVat]) await expect(document).toContainText(figure);
            await expect(document).toContainText(programme.start);
            await expect(document).toContainText(programme.stagedFinish);
            const sentStages = document.getByRole("list", { name: "Programme stages" }).getByRole("listitem");
            await expect(sentStages).toHaveCount(programme.stages.length);
            for (const [index, stage] of programme.stages.entries()) {
                await expect(sentStages.nth(index)).toContainText(stage.name);
                await expect(sentStages.nth(index)).toContainText(stage.dates);
            }
            await expect(document.getByRole("list", { name: "Programme stages" })).not.toContainText("General");
            for (const stage of PAYMENT_STAGES) await expect(document).toContainText(stage.name);
            await expect(document).toContainText(money.deposit);
            await expect(document).toContainText(money.balance);
            for (const hidden of ["Overhead", "Risk (", "Profit"]) await expect(document).not.toContainText(hidden);
            await expect(document.getByRole("heading", { level: 2, name: wording.heading })).toBeVisible();
            await expect(document).toContainText(wording.notice);
            await expect(clientPage.getByRole("button", { name: BINDING_ACCEPTANCE_CONTROL })).toHaveCount(0);
            expect(luminance(await document.evaluate((article) => getComputedStyle(article).backgroundColor))).toBeGreaterThan(0.8);
            // Readable without zoom: body text is at least 16 px.
            expect(await document.getByText(wording.notice).first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(16);
            await recorder.checkpoint(`public-${label}`, { scope: "article" }, clientPage);

            // The PDF is drawn from the same snapshot and must say the same things.
            const download = clientPage.waitForEvent("download");
            await client.activate(clientPage.getByRole("button", { name: "Download this proposal as a PDF" }));
            const file = await (await download).path();
            const pdf = await pdfText(file);
            // The same facts the contractor read in the pre-send PDF, in a PDF not marked as a draft.
            for (const fact of documentFacts) expect(pdf.text, `the client's PDF states ${fact}`).toContain(fact);
            expect(pdf.text).toContain(wording.pdfLine);
            expect(pdf.text).not.toMatch(/Overhead|Profit/);
            expect(pdf.text).not.toContain("DRAFT");
            // Version 1 is the draft that was downloaded and checked, page for page.
            if (label === "acknowledgement") expect(pdf.pages, "the sent PDF has the pages of the draft that was checked").toBe(draftPdfPages);
            recorder.results.parity[`pdf-${label}`] = { pages: pdf.pages, includingVat: money.includingVat, finish: programme.stagedFinish, stages: programme.stages, responseLine: wording.pdfLine };
            if (env.evidence && project === "desktop") await (await download).saveAs(`${EVIDENCE_DIR}/proposal-${label}.pdf`);

            // A response without a name is refused and can be corrected.
            const name = clientPage.getByLabel("Your full name");
            await client.fill(name, "");
            await client.activate(clientPage.getByRole("button", { name: wording.action, exact: true }));
            await expect(clientPage.getByRole("alert").filter({ hasText: "Enter your full name" })).toBeVisible();
            await client.fill(name, JOB.client);
            await recorder.checkpoint(`public-${label}-response`, { scope: "article", focusOn: name, capture: false }, clientPage);
            await client.activate(clientPage.getByRole("button", { name: new RegExp(`${wording.action.replace(/[()]/g, "\\$&")}$`) }));
            const recorded = clientPage.locator('[data-response-state="recorded"]');
            await expect(recorded.getByRole("heading", { name: wording.recorded })).toBeVisible();
            await expect(recorded.getByRole("status")).toContainText(`Thank you, ${JOB.client}.`);
            await recorder.checkpoint(`public-${label}-recorded`, { scope: "article", focusOn: recorded }, clientPage);

            // The link keeps working and keeps showing the recorded response.
            await clientPage.reload();
            await expect(clientPage.locator('[data-response-state="recorded"]').getByRole("heading", { name: wording.recorded })).toBeVisible();
            await clientContext.close();
        };

        await test.step("the client opens the link and confirms receipt", async () => {
            recorder.step("public proposal: anonymous view, PDF parity, validation, acknowledgement");
            // A later edit to the draft must not change what was sent.
            if (!keyboardRun) {
                await use.fill(page.getByRole("textbox", { name: "Closing message" }), `${JOB.closing} ${JOB.laterEdit}`);
                await use.activate(button("Save draft"));
                await expect(main.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
            }
            const { clientContext, clientPage } = await asClient(firstLink);
            await expect(clientPage.getByRole("article")).toContainText(JOB.closing);
            await expect(clientPage.getByRole("article")).not.toContainText(JOB.laterEdit);
            await clientContext.close();
            await clientView(firstLink, RESPONSE.acknowledgement, "acknowledgement");
        });

        // ── 10. Contractor follow-up ─────────────────────────────────────────
        const history = page.locator("[data-publication-history]");
        await test.step("the contractor sees the response", async () => {
            recorder.step("contractor: history and pipeline show the acknowledgement");
            await page.reload();
            await use.activate(button(/^Sent versions \(1\)/, history));
            const version = history.locator('[data-publication-version="1"]');
            await expect(version).toContainText(RESPONSE.acknowledgement.history);
            await expect(version).toContainText(`Asked the client for ${RESPONSE.acknowledgement.askedFor}.`);
            await expect(version).toContainText(`by ${JOB.client}`);
            await recorder.checkpoint("contractor-history-acknowledged", { scope: "main main", focusOn: version });
        });

        // ── 11. Non-binding intention to proceed ─────────────────────────────
        if (!keyboardRun) {
            await test.step("a second version asks for a non-binding intention to proceed", async () => {
                recorder.step("non-binding intent: publish v2, public wording and response, no acceptance path");
                await use.check(send.getByRole("radio", { name: new RegExp(RESPONSE.nonBindingIntent.option) }));
                await expect(preview.getByRole("heading", { name: RESPONSE.nonBindingIntent.heading })).toBeVisible();
                await recorder.checkpoint("send-non-binding-intent", { scope: "main main", focusOn: send, capture: false });
                const secondLink = await publish(2);
                await expect(send.locator('[data-delivery="sent"]')).toContainText(JOB.clientEmail);
                expect(secondLink).not.toBe(firstLink);
                await clientView(secondLink, RESPONSE.nonBindingIntent, "non-binding-intent");

                await page.reload();
                await use.activate(button(/^Sent versions \(2\)/, history));
                await expect(history.locator('[data-publication-version="2"]')).toContainText(RESPONSE.nonBindingIntent.history);
                await expect(history.locator('[data-publication-version="2"]')).toContainText(`Asked the client for ${RESPONSE.nonBindingIntent.askedFor}.`);
                await expect(history).not.toContainText("Proposal accepted");
                await recorder.checkpoint("contractor-history-non-binding-intent", { scope: "main main", focusOn: history });
            });
        }

        await test.step("what the database recorded", async () => {
            const records = await publicationRecords(projectId);
            recorder.results.database.publications = records;
            expect(records.map((record) => record.version)).toEqual(keyboardRun ? [1] : [1, 2]);
            expect(records.at(-1)?.status).toBe("acknowledged");
            expect(records.flatMap((record) => record.events)).not.toContain("accepted");
            for (const record of records) expect(record.events.slice(0, 1)).toEqual(["published"]);
            if (!keyboardRun) expect(records[1].responseKind).toBe("non_binding_intent");
        });

        // ── 12. Pipeline and later modules ───────────────────────────────────
        await test.step("pipeline status and launch-profile gating", async () => {
            recorder.step("pipeline shows the job; later modules stay closed");
            await page.goto("/dashboard");
            // One job, in the sent column, at the price that was sent.
            await expect(main.getByRole("heading", { level: 3, name: "Proposal Sent" })).toBeVisible();
            await expect(main.getByText(JOB.name).first()).toBeVisible();
            await expect(main).toContainText(money.beforeVat.replace(/\.\d\d$/, ""));
            await recorder.checkpoint("pipeline", { scope: "main main", compactOnPointerDesktop: true });
            for (const route of ["/dashboard/projects/billing", "/dashboard/projects/contracts", "/dashboard/live", "/dashboard/home"]) {
                await page.goto(`${route}?projectId=${projectId}`);
                await expect(page, `${route} is closed in the cohort profile`).toHaveURL(/\/dashboard\?notice=module-unavailable$/);
            }
            await expect(main.getByRole("status").filter({ hasText: "That module is retained for a later Constructa release." })).toBeVisible();
            await recorder.checkpoint("later-module-unavailable", { scope: "main main", compactOnPointerDesktop: true });
        });

        // ── Isolation and provider record ────────────────────────────────────
        const log = await stubLog();
        recorder.results.provider = {
            aiRequests: log.ai.length,
            emailsAccepted: log.emails.filter((entry) => entry.delivered).length,
            emailsFailedOnPurpose: log.emails.filter((entry) => !entry.delivered).length,
            everyRecipientSynthetic: log.emails.every((entry) => entry.to.every((to) => to.endsWith(`@${SYNTHETIC_EMAIL_DOMAIN}`))),
            violations: log.violations,
        };
        expect(recorder.results.provider.everyRecipientSynthetic).toBe(true);
        expect(log.violations, "nothing was sent to a real recipient or an unknown provider route").toEqual([]);
        recorder.results.blockedThirdPartyHosts = [...blockedHosts].sort();
        expect([...blockedHosts].filter((host) => !EXPECTED_THIRD_PARTIES.includes(host)), "no unexpected host was requested").toEqual([]);

        if (keyboardRun) {
            recorder.keyboard(focusLog);
            expect(recorder.results.keyboard?.withoutVisibleFocus, "every control reached by keyboard shows where focus is").toEqual([]);
        }
        // Layout and accessibility findings are soft failures collected along the way.
        recorder.write(testInfo.errors.length === 0 ? "passed" : "failed");
    } catch (error) {
        if (keyboardRun) recorder.keyboard(focusLog);
        recorder.results.blockedThirdPartyHosts = [...blockedHosts].sort();
        recorder.results.provider = await stubLog().catch(() => ({}));
        recorder.write("failed");
        throw error;
    }
});
