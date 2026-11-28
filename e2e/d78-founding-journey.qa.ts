import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { publicationRecords, savedProjectBrief, syntheticUserExists } from "./support/backend";
import { pointerDriver } from "./support/driver";
import { EPHEMERAL_REPLAY_PROJECT_REF, readEphemeralReplayEnv } from "./support/ephemeral-replay-env";
import { SYNTHETIC_EMAIL_DOMAIN } from "./support/env";
import {
    COMPANY,
    JOB,
    JOURNEY_MARKUP_NOTE,
    PAYMENT_STAGES,
    PRICE,
    expectedPrice,
    expectedProgramme,
} from "./support/journey-data";
import { Recorder } from "./support/recorder";

/**
 * D78 founding-user journey on the disposable local stack (the D38 replay harness):
 * sign up with a synthetic identity, company setup, brief, estimate, programme, and
 * the pre-send proposal PDF. Nothing is published or emailed, and no hosted service is reached.
 */
const env = readEphemeralReplayEnv();
const money = expectedPrice();
// A Monday in February: 17 working days end well before any UK bank holiday.
const START_ISO = "2027-02-01";
const programme = expectedProgramme(new Date(), START_ISO);
const BRIEF_ACTIVITIES = ["Bathroom works", "Tiling"];

async function pdfText(file: string): Promise<{ pages: number; text: string }> {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    return { pages: totalPages, text: text.replace(/\s+/g, " ") };
}

test("D78: a founding user signs up, briefs, prices, plans and downloads the proposal PDF", async ({ page, context }, testInfo) => {
    const use = pointerDriver(false);
    const recorder = new Recorder(page, testInfo, "pointer", env.evidence);
    const main = page.locator("main main");
    const button = (name: string | RegExp, scope: Page | Locator = page) =>
        scope.getByRole("button", { name, exact: typeof name === "string" });
    const email = `d78-${env.runId}-${randomBytes(3).toString("hex")}@${SYNTHETIC_EMAIL_DOMAIN}`;
    const password = `D78-${randomBytes(12).toString("base64url")}`;
    let projectId = "";

    // Only the app and the local Supabase API may be reached.
    const allowed = new Set([new URL(env.baseUrl).host, new URL(env.supabaseUrl).host]);
    await context.route((url) => /^https?:$/.test(url.protocol) && !allowed.has(url.host), (route) => route.abort());

    try {
        await test.step("sign up and sign in with a synthetic identity", async () => {
            recorder.step("sign up on the ephemeral stack, then sign in");
            await page.goto("/login");
            await use.activate(button("Get started", page.getByRole("group", { name: "Account mode" })));
            await use.fill(page.getByLabel("Email address"), email);
            await use.fill(page.getByLabel("Password", { exact: true }), password);
            await use.fill(page.getByLabel("Confirm password"), password);
            // The real signup seam is a server action; auth/v1/signup is server-side,
            // so do not wait for a browser request that cannot occur.
            await page.getByRole("checkbox", { name: "I accept Constructa's platform terms of service." }).check();
            await use.activate(button("Create account"));
            await expect(page.getByRole("heading", { name: "Account created.", exact: true })).toBeVisible();
            await context.clearCookies();
            await page.goto("/login");
            await use.fill(page.getByLabel("Email address"), email);
            await use.fill(page.getByLabel("Password", { exact: true }), password);
            const login = page.waitForResponse((response) => response.url().startsWith(`${env.supabaseUrl}/auth/v1/token`));
            await use.activate(button("Sign in", page.locator("form")));
            const signedIn = await login;
            expect(signedIn.status()).toBe(200);
            const session = await signedIn.json();
            expect(await syntheticUserExists(String(session.user?.id ?? ""), email, env)).toBe(true);
            await expect(page).toHaveURL(/\/onboarding$/);
        });

        await test.step("short company setup", async () => {
            recorder.step("company setup: the work, then the business name");
            await use.fill(page.getByLabel("What kind of work do you do?", { exact: true }), COMPANY.trade);
            await use.activate(button(/Save and continue|Try again/));
            await expect(page.getByText("Step 2 of 2")).toBeVisible();
            await use.fill(page.getByLabel("Business or trading name"), COMPANY.name);
            await use.fill(page.getByLabel(/Your name/), COMPANY.owner);
            await use.activate(button(/Save and continue|Try again/));
            await expect(page).toHaveURL(/\/dashboard\/settings\/profile\/readiness$/);
            await use.activate(main.getByRole("link", { name: /Build your first proposal/ }));
            await expect(page).toHaveURL(/\/dashboard\/projects\/new$/);
        });

        await test.step("first project reaches the brief", async () => {
            recorder.step("create the first blank project");
            await use.fill(page.getByLabel("Job name"), JOB.name);
            await use.fill(page.getByLabel("Client name"), JOB.client);
            await use.activate(button(/Add more details/));
            await use.fill(page.getByLabel("Client email"), JOB.clientEmail);
            await use.fill(page.getByLabel("Where is the job?"), JOB.site);
            await use.activate(button("Create project and start the brief"));
            await expect(page).toHaveURL(/\/dashboard\/projects\/brief\?projectId=/);
            projectId = new URL(page.url()).searchParams.get("projectId") ?? "";
            expect(projectId).toMatch(/^[0-9a-f-]{36}$/);
            recorder.results.database = { backend: "ephemeral-replay", projectId };
        });

        await test.step("brief written by hand and saved", async () => {
            recorder.step("brief: description, activities, site notes, start date");
            await use.fill(page.getByLabel("Describe the job in your own words"), JOB.description);
            await use.activate(button("Next", main));
            for (const activity of BRIEF_ACTIVITIES) {
                await page.getByLabel("Activity to add").fill(activity);
                await use.activate(button("Add activity", main));
            }
            await use.activate(button("Next", main));
            await use.fill(page.getByLabel("Access, restrictions and assumptions"), JOB.siteNotes);
            const startInput = page.locator("#brief-start-date");
            if (await startInput.isVisible()) await use.fill(startInput, START_ISO);
            await use.activate(button("Save and build the price", main));
            await expect(page).toHaveURL(new RegExp(`/dashboard/projects/costs\\?projectId=${projectId}`));
            const row = await savedProjectBrief(projectId, email, env);
            expect(row?.briefCompleted).toBe(true);
            for (const activity of BRIEF_ACTIVITIES) expect(row?.briefTradeSections).toContain(activity);
        });

        await test.step("estimate: three lines, explicit preliminaries, adjusted percentages", async () => {
            recorder.step("estimate: priced lines and adjustments");
            const lines = page.locator("#price-line-table");
            const lineDraft = page.locator("[data-new-price-line]");
            const total = page.locator("[data-price-total]");

            await use.activate(button("Add the first price line"));
            await use.fill(lineDraft.getByLabel("New work description"), PRICE.onePrice.description);
            await use.fill(lineDraft.getByLabel("New line price in pounds"), String(PRICE.onePrice.amount));
            await use.activate(button("Save line"));
            await expect(lines.locator("[data-price-line]")).toHaveCount(1);

            await use.activate(button("Add a price line"));
            await use.fill(lineDraft.getByLabel("New work description"), PRICE.measured.description);
            await use.activate(button("Quantity and rate"));
            await use.fill(lineDraft.getByLabel("New priced quantity"), String(PRICE.measured.quantity));
            await lineDraft.getByLabel("New priced unit").selectOption(PRICE.measured.unit);
            await use.fill(lineDraft.getByLabel("New unit rate in pounds"), String(PRICE.measured.rate));
            await use.activate(button("Save line"));
            await expect(lines.locator("[data-price-line]")).toHaveCount(2);

            const advanced = page.getByRole("region", { name: "Advanced estimating" });
            await use.activate(button(/^Advanced estimating/, advanced));
            await use.fill(advanced.getByLabel("Add a work activity"), "Preliminaries");
            await use.activate(button("Add activity", advanced));
            const prelims = advanced.getByRole("group", { name: "Preliminaries" });
            await use.fill(prelims.getByLabel("Description"), PRICE.preliminaries.description);
            // Special-line free text saves on blur. Wait for each acknowledgement
            // before the next edit, then verify the confirmed line amount.
            const priceSave = () => page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === "/dashboard/projects/costs");
            await Promise.all([priceSave(), prelims.getByLabel("Description").press("Tab")]);
            await use.fill(prelims.getByLabel("Rate (£)"), String(PRICE.preliminaries.amount));
            await Promise.all([priceSave(), prelims.getByLabel("Rate (£)").press("Tab")]);
            await expect(prelims).toContainText("£450.00");
            await use.activate(button(/^Advanced estimating/, advanced));
            await expect(lines.locator("[data-price-line]")).toHaveCount(3);

            await use.activate(button(/^Price adjustments/));
            await use.fill(page.getByLabel("Overhead (%)"), String(PRICE.overheadPct));
            await use.fill(page.getByLabel("Risk (%)"), String(PRICE.riskPct));
            await use.fill(page.getByLabel("Profit (%)"), String(PRICE.profitPct));
            await use.activate(button("Save adjustments"));
            await expect(button("No changes to save")).toBeVisible();
            for (const figure of [money.lines, money.beforeVat, money.vat, money.includingVat]) {
                await expect(total).toContainText(figure);
            }
            await expect(page.locator("[data-markup-method-printed]")).toContainText(JOURNEY_MARKUP_NOTE.on_net);
            await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
        });

        await test.step("programme: start date and duration saved", async () => {
            recorder.step("programme: start on site and three weeks");
            await page.goto(`/dashboard/projects/schedule?projectId=${encodeURIComponent(projectId)}`);
            await expect(page.getByRole("heading", { level: 1, name: "Programme" })).toBeVisible();
            await page.getByLabel("Programme timing").selectOption("dated");
            await use.fillDate(page.getByLabel("Start on site"), programme.startIso);
            await use.fill(page.getByLabel("How long it takes"), "3");
            await expect(page.getByRole("region", { name: "When does the job run?" })).toContainText(`Finishes ${programme.simpleFinish}`);
            await use.activate(button(/^(Save programme|Try again)$/).last());
            await expect(main.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible();
            await page.reload();
            await expect(page.getByLabel("Start on site")).toHaveValue(programme.startIso);
            await use.activate(page.getByRole("button", { name: /^Next: Proposal/ }).or(page.getByRole("link", { name: /^Next: Proposal/ })).first());
            await expect(page).toHaveURL(/\/dashboard\/projects\/proposal\?projectId=/);
        });

        await test.step("proposal review and the pre-send PDF", async () => {
            recorder.step("proposal: payment preset, draft saved, draft PDF downloaded, nothing published");
            await expect(page.getByRole("heading", { level: 1, name: "Your proposal" })).toBeVisible();
            const preparation = page.locator("#proposal-preparation");
            const payments = preparation.locator("[data-review-payments]");
            await payments.getByRole("radio", { name: /Deposit and balance/ }).check();
            await expect(payments.getByRole("radio", { name: /Deposit and balance/ })).toBeChecked();
            await expect(page.getByRole("heading", { level: 2, name: "Everything needed is in place" })).toBeVisible();
            await use.fill(page.getByRole("textbox", { name: "Closing message" }), JOB.closing);
            await use.activate(button("Save draft"));
            await expect(page.locator("[data-save-draft]")).toHaveText("Saved");
            await use.activate(button("2. Review document"));
            await expect(page.locator("#proposal-final-review")).toBeVisible();

            const presend = page.locator("[data-presend-pdf]");
            const download = page.waitForEvent("download");
            await use.activate(button("Download this draft as a PDF", presend));
            const file = await download;
            const pdf = await pdfText(await file.path());
            const checkCode = (await presend.locator("[data-check-code]").innerText()).trim();
            expect(checkCode).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
            expect(pdf.text).toContain("DRAFT PREVIEW - NOT SENT TO THE CLIENT");
            for (const fact of [money.beforeVat, money.vat, money.includingVat, programme.simpleFinish, money.deposit, money.balance, ...PAYMENT_STAGES.map((stage) => stage.name)]) {
                expect(pdf.text, `the draft PDF states ${fact}`).toContain(fact);
            }
            expect(pdf.text, "draft PDF states the on_net calculation method").toContain(JOURNEY_MARKUP_NOTE.on_net);
            expect(pdf.text).not.toMatch(/Overhead|Profit/);
            expect(await publicationRecords(projectId, env), "downloading the draft PDF publishes nothing").toEqual([]);
            recorder.results.parity.pdf = { pages: pdf.pages, includingVat: money.includingVat, finish: programme.simpleFinish, published: false, project_ref: EPHEMERAL_REPLAY_PROJECT_REF };
        });
    } finally {
        recorder.results.blockedThirdPartyHosts = [];
        recorder.write(testInfo.errors.length === 0 ? "passed" : "failed");
    }
});
