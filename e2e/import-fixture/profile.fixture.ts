import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { keyboardDriver, pointerDriver, type FocusRecord } from "../support/driver";

/**
 * The Company Profile form, on the real screen, over the fixture harness: it
 * no longer edits case studies, it says where they are edited, and saving it
 * leaves them alone. Only the case-study notice is measured for size and
 * accessibility: the rest of this form is older, was not otherwise changed
 * here, and is not claimed to meet those checks.
 */
const EVIDENCE = process.env.E2E_EVIDENCE === "1";
const DIR = path.resolve(EVIDENCE ? "docs/evidence/profile-case-study-loss-fix" : "test-results/import-fixture/profile");
const HARNESS = "/admin-e2e-import-fixture/profile";
const STORED = ["Kitchen at Example Road", "Loft at Sample Street"];

test("Company Profile: no case-study editor, a link to the real one, and saving leaves case studies alone", async ({ page, context, hasTouch }, testInfo) => {
    const project = testInfo.project.name;
    const keyboardRun = project === "desktop-keyboard";
    const focusLog: FocusRecord[] = [];
    const use = keyboardRun ? keyboardDriver(page, focusLog) : pointerDriver(Boolean(hasTouch));
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const results: Record<string, unknown> = { project, viewport, input: keyboardRun ? "keyboard" : hasTouch ? "touch" : "pointer", outcome: "failed" };

    const outside: string[] = [];
    await context.route((url) => url.hostname !== "127.0.0.1", async (route) => {
        outside.push(new URL(route.request().url()).host);
        await route.abort();
    });

    const run = `profile-${project}-${Date.now()}`;
    const control = async (op: Record<string, unknown> = {}) => (await page.request.post(`${HARNESS}/state?run=${run}`, { data: op })).json();
    const notice = page.locator("[data-profile-case-studies]");
    const link = notice.getByRole("link", { name: "Go to case studies" });
    const phone = page.locator('input[name="phone"]');
    const save = page.getByRole("button", { name: /^Save/ });

    try {
        await page.goto(`${HARNESS}?run=${run}`);
        await expect(page.locator('input[name="company_name"]')).toHaveValue("Example Builders Ltd");

        // 1. There is no second case-study editor on this form.
        await expect(page.getByText("Add Case Study")).toHaveCount(0);
        await expect(page.getByText("What We Delivered")).toHaveCount(0);
        for (const title of STORED) await expect(page.getByText(title)).toHaveCount(0);
        await expect(notice).toContainText("Case studies are added and changed on their own page. Saving this profile does not change them.");
        await expect(link).toHaveAttribute("href", "/dashboard/settings/case-studies");

        // The notice and its link: big enough to press, inside the screen, and accessible.
        const box = await link.boundingBox();
        expect(box && box.height >= 44 && box.width >= 44, "the link is at least 44 by 44 px").toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "the page does not scroll sideways").toBeLessThanOrEqual(1);
        const axe = await new AxeBuilder({ page }).include("[data-profile-case-studies]").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const blocking = axe.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")).map((violation) => `${violation.id}: ${violation.help}`);
        expect(blocking, "no critical or serious accessibility violation in the notice").toEqual([]);
        if (EVIDENCE && ["desktop", "phone"].includes(project)) {
            mkdirSync(DIR, { recursive: true });
            await notice.scrollIntoViewIfNeeded();
            await page.screenshot({ path: path.join(DIR, `01-profile-case-studies-notice-${viewport.width}x${viewport.height}.jpg`), type: "jpeg", quality: 55, scale: "css", animations: "disabled" });
        }

        // 2. A case study is added on its own page after this form was loaded. Then the profile is saved.
        expect((await control({ addCaseStudyElsewhere: "Bathroom at Test Lane" })).caseStudies).toEqual([...STORED, "Bathroom at Test Lane"]);
        await use.fill(phone, "0113 496 0101");
        await use.activate(save);
        await expect(page.getByText("Profile saved")).toBeVisible();
        let state = await control();
        expect(state.phone, "the profile itself saved").toBe("0113 496 0101");
        expect(state.caseStudies, "the case study added elsewhere is still there").toEqual([...STORED, "Bathroom at Test Lane"]);
        expect(state.postedFields, "the form posts nothing about case studies").not.toContain("case_studies");
        expect(state.postedFields).toContain("company_name");

        // 3. A failed save says so, and still touches no case study.
        await control({ failNext: true });
        await use.fill(phone, "0113 496 0202");
        await use.activate(save);
        await expect(page.getByText(/Save failed/)).toBeVisible();
        state = await control();
        expect(state.phone).toBe("0113 496 0101");
        expect(state.caseStudies).toEqual([...STORED, "Bathroom at Test Lane"]);

        // 4. The link can be reached and followed. (Where it leads needs a signed-in session, which this harness does not have.)
        if (keyboardRun) {
            await page.keyboard.press("Tab");
            for (let presses = 0; presses < 200 && !(await link.evaluate((element) => element === document.activeElement)); presses += 1) await page.keyboard.press("Shift+Tab");
            expect(await link.evaluate((element) => element === document.activeElement), "the link is reachable by keyboard").toBe(true);
            expect(await link.evaluate((element) => { const style = getComputedStyle(element); return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0; }), "and shows where focus is").toBe(true);
            results.keyboard = { linkReached: true, linkShowsFocus: true, controlsReached: focusLog.length };
        }

        expect(outside.filter((host) => !["plausible.io", "www.clarity.ms"].includes(host)), "no outside host was contacted").toEqual([]);
        results.saves = state.saves;
        results.caseStudiesAfter = state.caseStudies;
        results.postedFields = state.postedFields;
        results.blockedThirdPartyHosts = Array.from(new Set(outside));
        results.outcome = testInfo.errors.length === 0 ? "passed" : "failed";
    } finally {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(path.join(DIR, `results-profile-${project}.json`), `${JSON.stringify(results, null, 2)}\n`);
    }
});
