import { randomBytes } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { savedSetup, syntheticUserExists } from "./support/backend";
import { keyboardDriver, pointerDriver, type FocusRecord } from "./support/driver";
import { APPROVED_DISPOSABLE_PROJECT, SYNTHETIC_EMAIL_DOMAIN, readE2EEnv } from "./support/env";
import { failNextServerAction, guardNetwork, stubControl, stubLog } from "./support/harness";
import { Recorder } from "./support/recorder";

const env = readE2EEnv();

const WORK = "Kitchen and bathroom fitting, tiling and small extensions";
const WORK_EDITED = "Kitchen and bathroom fitting, tiling, small extensions and loft conversions";
const COMPANY = { name: "Example Kitchens & Bathrooms", owner: "Sam Example" };
const READINESS_URL = /\/dashboard\/settings\/profile\/readiness$/;
const FOLDERS = { evidence: "docs/evidence/stage2-tranche-2g", smoke: "test-results/activation" };

/**
 * Guided activation: a new contractor describes their work in their own
 * words, names the business and lands on proposal readiness, from where they
 * can start a project or carry on with the company profile. Then the same
 * contractor comes back and changes an answer.
 */
test("Activation: setup in the contractor's words, then proposal readiness", async ({ page, context, hasTouch }, testInfo) => {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    // The owner's laptop size. The phone and tablet projects keep their own.
    if (project === "desktop") await page.setViewportSize({ width: 1280, height: 800 });

    const focusLog: FocusRecord[] = [];
    const use = keyboardRun ? keyboardDriver(page, focusLog) : pointerDriver(Boolean(hasTouch));
    const recorder = new Recorder(page, testInfo, keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", env.evidence, FOLDERS);
    const blockedHosts = new Set<string>();
    await guardNetwork(context, blockedHosts);
    await stubControl({ reset: true });

    const email = `e2e-${env.runId}-activation-${project}-${randomBytes(3).toString("hex")}@${SYNTHETIC_EMAIL_DOMAIN}`;
    const password = process.env.E2E_SYNTHETIC_PASSWORD?.trim() || `E2e-${randomBytes(12).toString("base64url")}`;
    const main = page.locator("main main");
    const button = (name: string | RegExp, scope: Page | Locator = page) => scope.getByRole("button", { name, exact: typeof name === "string" });
    const workAnswer = page.getByRole("textbox", { name: "What kind of work does your business do?" });
    const alert = page.getByRole("alert").filter({ hasText: /\S/ });
    const welcomeEmails = async () => (await stubLog()).emails.filter((entry) => entry.subject.startsWith("Welcome to Constructa"));
    const readinessStatus = (key: string) => main.locator(`[data-readiness="${key}"]`);
    let userId = "";

    try {
        await test.step("sign up and sign in", async () => {
            recorder.step("sign up, then sign in");
            await page.goto("/login");
            await use.activate(button("Sign up"));
            await use.fill(page.getByLabel("Email address"), email);
            await use.fill(page.getByLabel("Password", { exact: true }), password);
            await use.fill(page.getByLabel("Confirm password"), password);
            const signup = page.waitForResponse((response) => response.url().includes("/auth/v1/signup"));
            await use.activate(button("Create account"));
            const signupResponse = await signup;
            expect(new URL(signupResponse.url()).host).toBe(`${APPROVED_DISPOSABLE_PROJECT.ref}.supabase.co`);
            const created = await signupResponse.json();
            userId = String(created.user?.id ?? created.id ?? "");
            expect(await syntheticUserExists(userId, email), "the new account exists in the disposable project").toBe(true);

            await context.clearCookies();
            await page.goto("/login");
            await use.fill(page.getByLabel("Email address"), email);
            await use.fill(page.getByLabel("Password", { exact: true }), password);
            await use.activate(button("Sign in"));
            await expect(page).toHaveURL(/\/onboarding$/);
        });

        await test.step("the work, in the contractor's own words", async () => {
            recorder.step("step 1: free text, optional suggestions, failed save and retry");
            await expect(page.getByText("Step 1 of 2")).toBeVisible();
            await recorder.checkpoint("setup-work-blank", { scope: "form" });

            // Nothing typed: a plain message and no request.
            await use.activate(button("Save and continue"));
            await expect(alert).toHaveText("Tell us what kind of work your business does.");

            // A suggestion is only a shortcut into the same answer.
            const roofing = button("Roofing");
            await use.activate(roofing);
            await expect(workAnswer).toHaveValue("Roofing");
            await expect(roofing).toHaveAttribute("aria-pressed", "true");
            await expect(alert).toHaveCount(0);
            await use.activate(roofing);
            await expect(workAnswer).toHaveValue("");

            await use.fill(workAnswer, WORK);
            await recorder.checkpoint("setup-work-answered", { scope: "form" });

            // The connection drops: the answer stays and the save can be retried.
            await failNextServerAction(page);
            await use.activate(button("Save and continue"));
            await expect(alert).toBeVisible();
            await expect(workAnswer).toHaveValue(WORK);
            expect((await savedSetup(userId, email)).businessType, "a failed save writes nothing").toBeNull();
            await recorder.checkpoint("setup-work-save-failed", { scope: "form" });

            await use.activate(button("Try again"));
            await expect(page.getByText("Step 2 of 2")).toBeVisible();
            expect(await savedSetup(userId, email)).toMatchObject({ businessType: WORK, companyName: null });
        });

        await test.step("back and forward without losing the answer", async () => {
            recorder.step("Back returns to step 1 with the answer kept");
            await use.activate(button("Back"));
            await expect(workAnswer).toHaveValue(WORK);
            await use.activate(button("Save and continue"));
            await expect(page.getByText("Step 2 of 2")).toBeVisible();
            await expect(page.getByText(`Saved: ${WORK}`)).toBeVisible();
        });

        await test.step("the business name, with a failed save and one welcome", async () => {
            recorder.step("step 2: business name required, user name optional, retry sends one welcome email");
            await use.activate(button("Save and continue"));
            await expect(alert).toHaveText("Enter your business or trading name.");
            await expect(page).toHaveURL(/\/onboarding$/);

            await use.fill(page.getByLabel("Business or trading name"), COMPANY.name);
            await use.fill(page.getByLabel(/Your name/), COMPANY.owner);
            await recorder.checkpoint("setup-business", { scope: "form" });

            await failNextServerAction(page);
            await use.activate(button(/Save and continue|Try again/));
            await expect(alert).toBeVisible();
            await expect(page.getByLabel("Business or trading name")).toHaveValue(COMPANY.name);
            expect((await savedSetup(userId, email)).companyName, "a failed save writes nothing").toBeNull();
            expect(await welcomeEmails(), "no welcome before the name is saved").toHaveLength(0);

            await use.activate(button("Try again"));
            await expect(page).toHaveURL(READINESS_URL);
            expect(await savedSetup(userId, email)).toEqual({ businessType: WORK, companyName: COMPANY.name, fullName: COMPANY.owner });
            await expect.poll(async () => (await welcomeEmails()).length, { message: "one welcome email" }).toBe(1);
            expect((await welcomeEmails())[0]).toMatchObject({ to: [email], subject: `Welcome to Constructa, ${COMPANY.name}`, delivered: true });
        });

        await test.step("proposal readiness", async () => {
            recorder.step("readiness: saved answers, honest status, nothing blocking a project");
            await expect(main.getByRole("heading", { level: 1, name: COMPANY.name })).toBeVisible();
            await expect(main).toContainText(WORK);
            for (const [key, status] of Object.entries({ basics: "started", brand: "todo", story: "todo", "case-studies": "todo", terms: "included" })) {
                await expect(readinessStatus(key), key).toHaveAttribute("data-status", status);
            }
            await expect(main).toContainText("1 of 5 in place");
            await expect(main.getByRole("link", { name: "Create first project" })).toBeVisible();
            await expect(main.getByRole("link", { name: "Build company profile" })).toBeVisible();

            // Only Phase 1 routes are offered from here.
            const hrefs = await main.getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
            expect(new Set(hrefs)).toEqual(new Set(["/dashboard/projects/new", "/dashboard/settings/profile", "/dashboard/settings/case-studies"]));
            await recorder.checkpoint("readiness-after-setup", { scope: "main main" });
        });

        await test.step("build company profile, and come back", async () => {
            recorder.step("secondary action opens Profile; readiness can be resumed from Profile and Case Studies");
            await use.activate(main.getByRole("link", { name: "Build company profile" }));
            await expect(page).toHaveURL(/\/dashboard\/settings\/profile$/);
            await expect(main.getByRole("heading", { level: 1, name: "Company Profile" })).toBeVisible();
            // The profile form shows the answer as written, so saving the form cannot blank it.
            await expect(main.getByLabel("What kind of work your business does")).toHaveValue(WORK);
            await use.activate(main.getByRole("link", { name: "See what your proposals can use so far" }));
            await expect(page).toHaveURL(READINESS_URL);

            await use.activate(main.getByRole("link", { name: "Add case study: Case studies" }));
            await expect(page).toHaveURL(/\/dashboard\/settings\/case-studies$/);
            await use.activate(main.getByRole("link", { name: "See what your proposals can use so far" }));
            await expect(page).toHaveURL(READINESS_URL);

            await page.reload();
            await expect(main.getByRole("heading", { level: 1, name: COMPANY.name })).toBeVisible();
            await expect(readinessStatus("basics")).toHaveAttribute("data-status", "started");
        });

        await test.step("a contractor who is set up is not sent through setup again", async () => {
            recorder.step("returning: /onboarding leaves setup; the edit route changes an answer with no second welcome");
            await page.goto("/onboarding");
            await expect(page).toHaveURL(/\/dashboard$/);

            await page.goto("/onboarding?force=true");
            await expect(page.getByText("Step 1 of 2")).toBeVisible();
            await expect(workAnswer).toHaveValue(WORK);
            await expect(page.getByRole("link", { name: "Back to your dashboard" })).toBeVisible();
            await use.fill(workAnswer, WORK_EDITED);
            await use.activate(button("Save and continue"));
            await expect(page.getByText("Step 2 of 2")).toBeVisible();
            await expect(page.getByLabel("Business or trading name")).toHaveValue(COMPANY.name);
            await recorder.checkpoint("setup-edit-business", { scope: "form", capture: false });
            await use.activate(button("Save"));

            await expect(page).toHaveURL(READINESS_URL);
            await expect(main).toContainText(WORK_EDITED);
            expect(await savedSetup(userId, email)).toEqual({ businessType: WORK_EDITED, companyName: COMPANY.name, fullName: COMPANY.owner });
        });

        await test.step("create first project", async () => {
            recorder.step("primary action opens the blank first project");
            await use.activate(main.getByRole("link", { name: "Create first project" }));
            await expect(page).toHaveURL(/\/dashboard\/projects\/new$/);
            await expect(page.getByRole("heading", { level: 1, name: "Add your first job" })).toBeVisible();
        });

        const log = await stubLog();
        expect(await welcomeEmails(), "saving setup again sent no second welcome").toHaveLength(1);
        expect(log.ai, "setup and readiness make no AI request").toEqual([]);
        expect(log.violations).toEqual([]);
        recorder.results.provider = { aiRequests: log.ai.length, welcomeEmails: 1, violations: log.violations };
        recorder.results.database = { accountCreatedIn: APPROVED_DISPOSABLE_PROJECT.name, savedSetup: await savedSetup(userId, email) };
        recorder.results.blockedThirdPartyHosts = [...blockedHosts].sort();
        if (keyboardRun) {
            recorder.keyboard(focusLog);
            expect(recorder.results.keyboard?.withoutVisibleFocus, "every control reached by keyboard shows where focus is").toEqual([]);
        }
        recorder.write(testInfo.errors.length === 0 ? "passed" : "failed");
    } catch (error) {
        if (keyboardRun) recorder.keyboard(focusLog);
        recorder.write("failed");
        throw error;
    }
});
