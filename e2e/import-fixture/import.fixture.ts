import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { keyboardDriver, pointerDriver, type FocusRecord } from "../support/driver";
import { Recorder } from "../support/recorder";

const FOLDERS = { evidence: "docs/evidence/stage2-tranche-2g2", smoke: "test-results/import-fixture" };
const HARNESS = "/admin-e2e-import-fixture";
const START_PROFILE = { company_name: "Smith Builders", phone: "0113 000 0000", website: null };

async function setUp(page: Page, context: BrowserContext, hasTouch: boolean | undefined, testInfo: TestInfo, scenario: string) {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    const focusLog: FocusRecord[] = [];
    const use = keyboardRun ? keyboardDriver(page, focusLog) : pointerDriver(Boolean(hasTouch));
    const recorder = new Recorder(page, testInfo, keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", process.env.E2E_EVIDENCE === "1", FOLDERS);

    // Nothing but this machine may be contacted. Anything else is stopped and recorded.
    const outside: string[] = [];
    await context.route((url) => url.hostname !== "127.0.0.1", async (route) => {
        outside.push(new URL(route.request().url()).host);
        await route.abort();
    });

    const run = `${scenario}-${project}-${Date.now()}`;
    return {
        project, keyboardRun, focusLog, use, recorder, outside, run,
        state: async () => (await page.request.get(`${HARNESS}/state?run=${run}`)).json(),
        button: (name: string | RegExp, scope: Page | Locator = page) => scope.getByRole("button", { name, exact: typeof name === "string" }),
        alert: page.getByRole("alert").filter({ hasText: /\S/ }),
        urlField: page.getByLabel("Your website address"),
        permission: page.getByLabel(/This is my own business's website/),
        row: (field: string): Locator => page.locator(`[data-import-field="${field}"]`),
        finish: () => {
            // The marketing analytics tags are the only outside hosts the page asks for, and they are blocked.
            expect(outside.filter((host) => !["plausible.io", "www.clarity.ms"].includes(host)), "no outside host was contacted").toEqual([]);
            if (keyboardRun) {
                recorder.keyboard(focusLog);
                expect(recorder.results.keyboard?.withoutVisibleFocus, "every control reached by keyboard shows where focus is").toEqual([]);
            }
        },
    };
}

test("Website import: permission, failure and retry, selective approval, stale value, failed save", async ({ page, context, hasTouch }, testInfo) => {
    const t = await setUp(page, context, hasTouch, testInfo, "main");
    const { use, recorder, button, alert, urlField, permission, row, state } = t;

    try {
        await page.goto(`${HARNESS}?run=${t.run}`);
        await expect(page.getByRole("heading", { level: 1, name: "Bring in details from your website" })).toBeVisible();
        await recorder.checkpoint("import-start", { scope: "main main" });

        // Permission is required and is not ticked for the contractor.
        await expect(permission).not.toBeChecked();
        await use.fill(urlField, "www.smithbuilders.co.uk");
        await use.activate(button("Check my website"));
        await expect(alert).toContainText("Tick the box to confirm this is your own website");
        expect(await state(), "nothing is read, and no budget is used, without permission").toMatchObject({ previews: 0, attempts: [] });

        // The website is down: plain message, address and tick kept, manual entry offered. The attempt still counts.
        await use.check(permission);
        await use.activate(button(/Check my website|Try again/));
        await expect(alert).toContainText("by hand");
        await expect(urlField).toHaveValue("www.smithbuilders.co.uk");
        await expect(permission).toBeChecked();
        await expect(page.getByRole("link", { name: "Enter details by hand" })).toHaveAttribute("href", "/dashboard/settings/profile");
        expect(await state()).toMatchObject({ previews: 1, drafts: 0, attempts: ["failed:unavailable"], profile: START_PROFILE });
        await recorder.checkpoint("import-website-unavailable", { scope: "main main" });

        // Retry: suggestions shown, nothing ticked, nothing saved.
        await use.activate(button("Try again"));
        await expect(page.getByRole("heading", { level: 2, name: "What we found" })).toBeVisible();
        await expect(row("phone")).toContainText("0113 000 0000");
        await expect(row("phone")).toContainText("0113 496 0000");
        await expect(row("phone")).toContainText("https://www.smithbuilders.co.uk/");
        await expect(row("company_number")).toContainText("Company No. 01234567");
        await expect(page.getByText(/This preview can be used until/)).toBeVisible();
        await expect(page.locator('[data-import-field] input[type="checkbox"]:checked')).toHaveCount(0);
        await expect(page.locator("[data-import-field]")).toHaveCount(8);
        // Instructions planted in the fixture website are not shown and changed nothing.
        await expect(page.locator("main main")).not.toContainText(/Evil Corp|ignore previous instructions/i);
        expect(await state(), "a preview changes nothing on the profile").toMatchObject({
            previews: 2, drafts: 1, applies: 0, attempts: ["failed:unavailable", "drafted"], profile: START_PROFILE,
        });
        await recorder.checkpoint("import-preview", { scope: "main main" });
        await recorder.checkpoint("import-preview-item", { scope: "main main", focusOn: row("phone") });

        // Saving with nothing ticked saves nothing.
        await use.activate(button("Save 0 ticked changes"));
        await expect(alert).toContainText("Tick at least one change");
        expect((await state()).applies).toBe(0);

        // Two of eight ticked. Meanwhile the phone was changed by hand elsewhere.
        await use.check(row("phone").getByRole("checkbox"));
        await use.check(row("website").getByRole("checkbox"));
        await use.activate(button("Save 2 ticked changes"));
        await expect(row("website")).toContainText("Saved to your profile");
        await expect(row("phone").getByRole("alert")).toContainText("Your profile changed after this preview was made");
        await expect(row("phone")).toContainText("0113 222 2222");
        await expect(row("phone").getByRole("checkbox")).not.toBeChecked();
        expect((await state()).profile, "the newer phone is kept; only the website was saved; the rest untouched").toMatchObject({
            phone: "0113 222 2222", website: "https://www.smithbuilders.co.uk", company_name: "Smith Builders", sales_email: null, address: null, company_number: null,
        });
        await recorder.checkpoint("import-stale-value-not-overwritten", { scope: "main main", focusOn: row("phone") });

        // Approved again knowingly. The approval cannot be recorded, so the profile is not changed and the tick is kept.
        await use.check(row("phone").getByRole("checkbox"));
        await use.activate(button("Save 1 ticked change"));
        await expect(alert.filter({ hasText: "Nothing was changed" })).toBeVisible();
        await expect(row("phone").getByRole("checkbox")).toBeChecked();
        expect((await state()).profile.phone, "a save that cannot be recorded changes nothing").toBe("0113 222 2222");
        await recorder.checkpoint("import-save-failed", { scope: "main main", focusOn: row("phone") });

        await use.activate(button("Try again"));
        await expect(row("phone")).toContainText("Saved to your profile");
        expect(await state()).toMatchObject({
            applies: 3,
            profile: { phone: "0113 496 0000", website: "https://www.smithbuilders.co.uk", company_name: "Smith Builders", sales_email: null, address: null, company_number: null, vat_number: null, specialisms: "" },
        });
        await expect(page.getByText("6 left to decide")).toBeVisible();
        await recorder.checkpoint("import-selected-saved", { scope: "main main" });

        // Leaving and coming back shows the same draft in the same state.
        await page.reload();
        await expect(row("phone")).toContainText("Saved to your profile");
        await expect(row("website")).toContainText("Saved to your profile");
        await expect(page.locator('[data-import-field] input[type="checkbox"]')).toHaveCount(6);

        t.finish();
        recorder.write(testInfo.errors.length === 0 ? "passed" : "failed");
    } catch (error) {
        recorder.write("failed");
        throw error;
    }
});

test("Website import: a preview more than a day old can only be rechecked", async ({ page, context, hasTouch }, testInfo) => {
    const t = await setUp(page, context, hasTouch, testInfo, "expired");
    const { use, recorder, button, alert, urlField, permission, row, state } = t;

    await page.goto(`${HARNESS}?run=${t.run}`);
    const notice = page.getByRole("status").filter({ hasText: "This preview is more than a day old" });
    await expect(notice).toBeVisible();
    // What was found is still shown, but there is nothing to tick and nothing to save.
    await expect(row("phone")).toContainText("0113 496 0000");
    await expect(page.locator('[data-import-field] input[type="checkbox"]')).toHaveCount(0);
    await expect(button(/Save \d+ ticked/)).toHaveCount(0);
    await expect(page.getByText("Nothing can be saved from this preview.")).toBeVisible();
    await recorder.checkpoint("import-expired-preview", { scope: "main main", focusOn: notice });

    // Rechecking needs the confirmation again, like any read of the website.
    await use.activate(button("Check my website again", notice));
    await expect(alert).toContainText("Tick the box to confirm this is your own website");
    expect((await state()).previews).toBe(0);

    await expect(urlField).toHaveValue("https://www.smithbuilders.co.uk");
    await use.check(permission);
    await use.activate(button(/Check my website again|Try again/).first());
    await expect(notice).toHaveCount(0);
    await expect(page.locator('[data-import-field] input[type="checkbox"]')).toHaveCount(8);
    expect(await state()).toMatchObject({ previews: 1, drafts: 2, profile: START_PROFILE });

    // The fresh preview can be approved from.
    await use.check(row("phone").getByRole("checkbox"));
    await use.activate(button("Save 1 ticked change"));
    await expect(row("phone").getByRole("alert")).toContainText("Your profile changed after this preview was made");
    t.finish();
});
