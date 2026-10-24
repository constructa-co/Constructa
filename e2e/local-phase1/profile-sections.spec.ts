import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalProfileSectionsFixture } from "./profile-sections-entry";

// A027: the company profile shows one section at a time from a persistent
// chooser, while every field stays mounted and is saved together. Build with
// `build-brief-price.mjs <out> profile-sections` (A027-PROFILE-SECTIONS-2110 hunk).
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const SECTIONS = [
    ["company-basics", "Company basics"],
    ["company-work", "Your work & story"],
    ["company-contacts", "Your people"],
    ["company-style", "Proposal style"],
    ["company-director", "Director message"],
    ["company-consent", "Data consent"],
] as const;
const scope = {
    form: "REAL_COMPONENT ProfileForm with bundled company-profile CSS module; native browser validation",
    save: "MOCK save script via the form's documented save prop; records the posted FormData",
    excluded: "Real profile/upload/AI actions, Auth, DB, provider, hosted page",
};

const fixtureState = (page: Page): Promise<Pick<LocalProfileSectionsFixture, "saves" | "script">> =>
    page.evaluate(() => ({ saves: window.__profileSectionsLocal.saves, script: window.__profileSectionsLocal.script }));
const settle = (page: Page) => page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
const chooser = (page: Page, label: string) => page.getByRole("navigation", { name: "Company profile sections" }).getByRole("button", { name: label, exact: true });
const field = (page: Page, name: string) => page.locator(`[name="${name}"]`);
const status = (page: Page) => page.locator("#profile-save-status");
const saveButton = (page: Page) => page.getByRole("button", { name: /Save Company Profile|Saving\.\.\./ });

async function expectOnlyShown(page: Page, id: string) {
    for (const [section, label] of SECTIONS) {
        if (section === id) {
            await expect(page.locator(`#${section}`)).toBeVisible();
            await expect(chooser(page, label)).toHaveAttribute("aria-current", "true");
        } else {
            await expect(page.locator(`#${section}`)).toBeHidden();
            await expect(chooser(page, label)).not.toHaveAttribute("aria-current", /.*/);
        }
    }
    // Not a switched section: the case-study notice and the whole-profile save stay in view.
    await expect(page.locator("[data-profile-case-studies]")).toBeVisible();
    await expect(saveButton(page)).toBeVisible();
}

async function open(page: Page, hash?: string) {
    if (hash) await page.evaluate(value => { window.location.hash = value; }, hash);
    await page.addScriptTag({ content: bundle });
    await expect(field(page, "company_name")).toHaveCount(1);
}

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local company profile sections - MOCK save</title></head><body><p>LOCAL FIXTURE: profile saves are MOCK acknowledgements or refusals. No account, server or database.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await fixtureState(page), requests, pageErrors }), contentType: "application/json" });
});

test("switching sections shows one at a time, keeps every value and saves the whole profile only on Save", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("navigation", { name: "Company profile sections" }).getByRole("button")).toHaveCount(6);
    await expectOnlyShown(page, "company-basics");
    const companyName = field(page, "company_name");
    const original = await companyName.elementHandle();
    await companyName.fill("TEST DATA - Edited Builders Ltd");

    await chooser(page, "Your work & story").click();
    await expectOnlyShown(page, "company-work");
    const roofing = page.locator("#company-work").getByRole("button", { name: "Roofing", exact: true });
    await roofing.click();
    await expect(roofing).toHaveAttribute("aria-pressed", "true");
    await field(page, "capability_statement").fill("We build carefully.");

    await chooser(page, "Your people").click();
    await expectOnlyShown(page, "company-contacts");
    await field(page, "phone").fill("0113 496 0101");
    await field(page, "sales_email").fill("sales@example.invalid");

    await chooser(page, "Proposal style").click();
    await expectOnlyShown(page, "company-style");
    await page.locator("#company-style").getByRole("button", { name: /^Navy/ }).click();

    await chooser(page, "Director message").click();
    await expectOnlyShown(page, "company-director");
    await field(page, "md_name").fill("Sam Example");
    await field(page, "md_message").fill("Thank you for considering us.");

    await chooser(page, "Data consent").click();
    await expectOnlyShown(page, "company-consent");
    await field(page, "data_consent").check();

    // Back again: the same mounted inputs still hold what was typed and chosen.
    await chooser(page, "Company basics").click();
    await expectOnlyShown(page, "company-basics");
    await expect(companyName).toHaveValue("TEST DATA - Edited Builders Ltd");
    expect(await page.evaluate(element => element === document.querySelector('[name="company_name"]'), original)).toBe(true);
    await chooser(page, "Your work & story").click();
    await expect(roofing).toHaveAttribute("aria-pressed", "true");
    await expect(field(page, "capability_statement")).toHaveValue("We build carefully.");

    // Choosing sections saved nothing; the unsaved state is shown for the whole profile.
    await settle(page);
    expect((await fixtureState(page)).saves).toEqual([]);
    await expect(status(page)).toHaveText("Unsaved changes. Save before leaving this profile.");

    await page.evaluate(() => { window.__profileSectionsLocal.script = ["ack"]; });
    await saveButton(page).click();
    await expect(status(page)).toHaveText("Profile saved.");
    await expectOnlyShown(page, "company-work");
    const { saves } = await fixtureState(page);
    expect(saves).toHaveLength(1);
    const posted = Object.fromEntries(saves[0]!);
    expect(posted).toMatchObject({
        company_name: "TEST DATA - Edited Builders Ltd",
        business_type: "Kitchen fitting",
        phone: "0113 496 0101",
        sales_email: "sales@example.invalid",
        capability_statement: "We build carefully.",
        md_name: "Sam Example",
        md_message: "Thank you for considering us.",
        data_consent: "true",
        pdf_theme: "navy",
        preferred_trades: JSON.stringify(["Roofing"]),
        financial_year_start_month: "4",
        logo_url: "",
    });
});

test("a hidden invalid field opens its section before the browser reports it, and nothing is saved", async ({ page }) => {
    await open(page);
    const companyName = field(page, "company_name");
    await companyName.fill("");
    await chooser(page, "Data consent").click();
    await saveButton(page).click();

    await expectOnlyShown(page, "company-basics");
    await expect(companyName).toBeFocused();
    expect(await companyName.evaluate(element => element.matches(":invalid"))).toBe(true);
    await expect(page.getByText("Company basics has a field to check before the profile can be saved.")).toBeVisible();
    expect((await fixtureState(page)).saves).toEqual([]);

    // A type error in another hidden section is revealed the same way.
    await companyName.fill("TEST DATA - Example Builders Ltd");
    await chooser(page, "Your people").click();
    const salesEmail = field(page, "sales_email");
    await salesEmail.fill("not-an-email");
    await chooser(page, "Director message").click();
    await saveButton(page).click();
    await expectOnlyShown(page, "company-contacts");
    await expect(salesEmail).toBeFocused();
    await expect(page.getByText("Your people has a field to check before the profile can be saved.")).toBeVisible();
    expect((await fixtureState(page)).saves).toEqual([]);

    // Once valid, Save posts once, and the notice clears.
    await salesEmail.fill("sales@example.invalid");
    await page.evaluate(() => { window.__profileSectionsLocal.script = ["ack"]; });
    await saveButton(page).click();
    await expect(status(page)).toHaveText("Profile saved.");
    await expect(page.getByText(/has a field to check before the profile can be saved/)).toHaveCount(0);
    expect((await fixtureState(page)).saves).toHaveLength(1);
});

test("newer edits made in another section during a save, and a refused save, keep every value without a retry", async ({ page }) => {
    await open(page);
    await page.evaluate(() => { window.__profileSectionsLocal.script = ["hold", "refuse"]; });
    await chooser(page, "Your people").click();
    await field(page, "phone").fill("0113 496 0202");
    await saveButton(page).click();
    await expect(status(page)).toHaveText("Saving the submitted profile...");

    // While the save is held, the contractor moves on and keeps typing.
    await chooser(page, "Director message").click();
    await field(page, "md_name").fill("Newer Name");
    await page.evaluate(() => window.__profileSectionsLocal.release?.());
    await expect(status(page)).toHaveText("Submitted profile saved. Newer edits still need saving.");
    await expect(field(page, "md_name")).toHaveValue("Newer Name");
    expect((await fixtureState(page)).saves).toHaveLength(1);
    expect(Object.fromEntries((await fixtureState(page)).saves[0]!)).toMatchObject({ phone: "0113 496 0202", md_name: "" });

    await saveButton(page).click();
    await expect(page.getByRole("alert").filter({ hasText: "Local fixture: profile save not acknowledged." })).toBeVisible();
    await chooser(page, "Your people").click();
    await expect(field(page, "phone")).toHaveValue("0113 496 0202");
    await chooser(page, "Director message").click();
    await expect(field(page, "md_name")).toHaveValue("Newer Name");
    await expect(page.getByRole("alert").filter({ hasText: "Local fixture: profile save not acknowledged." })).toBeVisible();
    await settle(page);
    const { saves } = await fixtureState(page);
    expect(saves).toHaveLength(2);
    expect(Object.fromEntries(saves[1]!)).toMatchObject({ phone: "0113 496 0202", md_name: "Newer Name" });
});

test("a linked section opens on arrival and when the link changes", async ({ page }) => {
    await open(page, "company-director");
    await expectOnlyShown(page, "company-director");
    await expect(page.locator("#company-director")).toBeFocused();
    await page.evaluate(() => { window.location.hash = "company-style"; });
    await expectOnlyShown(page, "company-style");
    await expect(page.locator("#company-style")).toBeFocused();
    expect((await fixtureState(page)).saves).toEqual([]);
});
