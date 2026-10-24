import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { LocalProfileSectionsFixture } from "./profile-sections-entry";

// A029: insurance, accreditations and the company logo are part of Company
// basics. Reuses the A027 bundle: build with `build-brief-price.mjs <out>
// profile-sections` after A029-CANONICAL.patch. Nothing is uploaded: the file
// picker is never opened, and the hidden logo_url is what the form posts.
const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
let requests: string[] = [];
let pageErrors: string[] = [];

const scope = {
    form: "REAL_COMPONENT ProfileForm with bundled company-profile CSS module; native browser validation",
    save: "MOCK save script via the form's documented save prop; records the posted FormData",
    excluded: "Real profile/upload/AI actions, logo upload, Auth, DB, provider, hosted page",
};
const MOVED = '[name="insurance_details"], [name="accreditations"], [name="logo_url"], #company-logo-input';

const fixtureState = (page: Page): Promise<Pick<LocalProfileSectionsFixture, "saves" | "script">> =>
    page.evaluate(() => ({ saves: window.__profileSectionsLocal.saves, script: window.__profileSectionsLocal.script }));
const chooser = (page: Page, label: string) => page.getByRole("navigation", { name: "Company profile sections" }).getByRole("button", { name: label, exact: true });
const basics = (page: Page) => page.locator("#company-basics");
const status = (page: Page) => page.locator("#profile-save-status");
const saveButton = (page: Page) => page.getByRole("button", { name: /Save Company Profile|Saving\.\.\./ });
const posted = (entries: Array<[string, string]>, name: string) => entries.filter(([key]) => key === name).map(([, value]) => value);

async function open(page: Page) {
    await page.addScriptTag({ content: bundle });
    await expect(page.locator('[name="company_name"]')).toHaveCount(1);
}

test.beforeEach(async ({ page, context }) => {
    requests = []; pageErrors = [];
    page.on("request", request => requests.push(request.url()));
    page.on("pageerror", error => pageErrors.push(error.message));
    await context.setOffline(true);
    await context.route("**/*", route => route.abort());
    await page.setContent('<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;unsafe-inline&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; form-action &#39;none&#39;"><title>Local company basics - MOCK save</title></head><body><p>LOCAL FIXTURE: profile saves are MOCK acknowledgements or refusals. No account, server, database or upload.</p><div id="app"></div></body></html>');
    await page.addStyleTag({ content: css });
});

test.afterEach(async ({ page }, info) => {
    expect(requests).toEqual([]);
    expect(pageErrors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, ...await fixtureState(page), requests, pageErrors }), contentType: "application/json" });
});

test("Company basics holds insurance, accreditations and the logo, keeps them across sections and saves them with the whole profile", async ({ page }) => {
    await open(page);
    await expect(basics(page)).toBeVisible();
    const insurance = basics(page).getByLabel("Insurance Details");
    const accreditations = basics(page).getByLabel("Accreditations");
    await expect(insurance).toBeVisible();
    await expect(accreditations).toBeVisible();
    await expect(basics(page).getByRole("button", { name: "Upload Logo" })).toBeVisible();
    await expect(basics(page).locator('[name="logo_url"]')).toHaveValue("");
    await expect(basics(page).locator("#company-logo-input")).toHaveAttribute("type", "file");
    await expect(page.locator("#company-work").locator(MOVED)).toHaveCount(0);
    await expect(page.locator(MOVED)).toHaveCount(4);

    await insurance.fill("Public Liability 5M");
    await accreditations.fill("CITB, FMB Member");
    await chooser(page, "Your work & story").click();
    await expect(basics(page)).toBeHidden();
    await expect(insurance).toBeHidden();
    await expect(page.locator("#company-work").getByLabel("Capability Statement")).toBeVisible();

    await chooser(page, "Company basics").click();
    await expect(insurance).toHaveValue("Public Liability 5M");
    await expect(accreditations).toHaveValue("CITB, FMB Member");
    await expect(status(page)).toHaveText("Unsaved changes. Save before leaving this profile.");
    expect((await fixtureState(page)).saves).toEqual([]);

    await page.evaluate(() => { window.__profileSectionsLocal.script = ["ack"]; });
    await saveButton(page).click();
    await expect(status(page)).toHaveText("Profile saved.");
    await expect(basics(page)).toBeVisible();
    const { saves } = await fixtureState(page);
    expect(saves).toHaveLength(1);
    expect(posted(saves[0]!, "insurance_details")).toEqual(["Public Liability 5M"]);
    expect(posted(saves[0]!, "accreditations")).toEqual(["CITB, FMB Member"]);
    expect(posted(saves[0]!, "logo_url")).toEqual([""]);
    expect(posted(saves[0]!, "company_name")).toEqual(["TEST DATA - Example Builders Ltd"]);
    expect(saves[0]!.filter(([, value]) => value.startsWith("[file "))).toEqual([]);
});

test("a moved field edited during a held save stays a newer edit until it is saved", async ({ page }) => {
    await open(page);
    const insurance = basics(page).getByLabel("Insurance Details");
    await page.evaluate(() => { window.__profileSectionsLocal.script = ["hold", "ack"]; });
    await insurance.fill("Submitted cover");
    await saveButton(page).click();
    await expect(status(page)).toHaveText("Saving the submitted profile...");

    await insurance.fill("Newer cover");
    await page.evaluate(() => window.__profileSectionsLocal.release?.());
    await expect(status(page)).toHaveText("Submitted profile saved. Newer edits still need saving.");
    await expect(insurance).toHaveValue("Newer cover");
    await chooser(page, "Director message").click();
    await chooser(page, "Company basics").click();
    await expect(insurance).toHaveValue("Newer cover");

    await saveButton(page).click();
    await expect(status(page)).toHaveText("Profile saved.");
    const { saves } = await fixtureState(page);
    expect(saves.map(entries => posted(entries, "insurance_details"))).toEqual([["Submitted cover"], ["Newer cover"]]);
});

test("a blank company name is revealed in Company basics alongside the moved fields, and nothing is saved", async ({ page }) => {
    await open(page);
    await page.locator('[name="company_name"]').fill("");
    await chooser(page, "Your work & story").click();
    await saveButton(page).click();

    await expect(basics(page)).toBeVisible();
    await expect(page.locator('[name="company_name"]')).toBeFocused();
    await expect(page.getByText("Company basics has a field to check before the profile can be saved.")).toBeVisible();
    await expect(basics(page).getByLabel("Insurance Details")).toBeVisible();
    await expect(basics(page).getByRole("button", { name: "Upload Logo" })).toBeVisible();
    expect((await fixtureState(page)).saves).toEqual([]);
});
