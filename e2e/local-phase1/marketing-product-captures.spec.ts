import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const evidence = path.resolve(process.cwd(), "docs/evidence/marketing-product-screenshots-2026-11-15");
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");

const WORK_TYPE = "Roof repairs and small extensions";
const COMPANY = "Example Local Builder";
const OPERATOR = "Test Operator";
const JOB = "Offline first job: rear roof slope";
const CLIENT = "Synthetic first client";
const SITE = "Synthetic site, rear of the terrace";
const TYPE = "Roof repair";
const START = "2026-11-16";
const WORK = "Strip and renew the rear roof slope, renew the gutters and repoint the chimney stack.";
const ACTIVITIES = ["Strip existing coverings and battens", "Re-felt, batten and re-tile the slope"];
const CREATE = "Create project and start the brief";
const MONDAY = "2026-11-02";

const sizeTag = () => (test.info().project.name === "phone" ? "390x844" : "1440x900");

test.beforeEach(async ({ page, context }) => {
  await context.setOffline(true);
  await context.route("**/*", route => route.abort());
  await page.setContent(
    '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'; form-action \'none\'"><title>Marketing journey capture fixture</title></head><body><p>SYNTHETIC LOCAL FIXTURE — not hosted availability proof.</p><div id="app"></div></body></html>',
  );
  await page.exposeFunction("__localJourneySha256", async (algorithm: string, bytes: number[]) => {
    if (algorithm !== "SHA-256") throw new Error("Unexpected fixture digest algorithm");
    return Array.from(new Uint8Array(await webcrypto.subtle.digest(algorithm, new Uint8Array(bytes))));
  });
  await page.evaluate(() => {
    if (crypto.subtle) return;
    const bridge = (window as unknown as { __localJourneySha256: (algorithm: string, bytes: number[]) => Promise<number[]> }).__localJourneySha256;
    Object.defineProperty(crypto, "subtle", {
      value: {
        digest: async (algorithm: string, data: BufferSource) => {
          const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          return new Uint8Array(await bridge(algorithm, Array.from(bytes))).buffer;
        },
      },
    });
  });
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
});

async function runToPricing(page: import("@playwright/test").Page) {
  await page.getByLabel("What kind of work do you do?", { exact: true }).fill(WORK_TYPE);
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await page.getByLabel("Business or trading name").fill(COMPANY);
  await page.getByLabel("Your name", { exact: false }).fill(OPERATOR);
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await page.locator('[data-welcome-step="proposal"]').click();
  await page.getByLabel("Job name", { exact: true }).fill(JOB);
  await page.getByLabel("Client name", { exact: true }).fill(CLIENT);
  const more = page.getByRole("button", { name: /^Add more details/ });
  if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
  await page.getByLabel("Where is the job?", { exact: true }).fill(SITE);
  await page.getByLabel("Type of job", { exact: true }).fill(TYPE);
  await page.getByLabel("Likely start date", { exact: true }).fill(START);
  await page.getByRole("button", { name: CREATE, exact: true }).click();
  await page.getByLabel("Describe the job in your own words").fill(WORK);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const entry = page.getByLabel("Activity to add");
  for (const activity of ACTIVITIES) {
    await entry.fill(activity);
    await page.getByRole("button", { name: "Add activity", exact: true }).click();
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Save and build the price", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Build the price", exact: true })).toBeVisible();
}

test("captures estimate adjustments and saved programme for marketing", async ({ page }) => {
  const tag = sizeTag();
  await runToPricing(page);
  await page.getByRole("button", { name: /Price adjustments/ }).click();
  await expect(page.locator("#price-adjustments")).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, `01-estimate-price-adjustments-${tag}.jpg`),
    type: "jpeg",
    quality: 92,
    fullPage: true,
  });

  await page.getByRole("link", { name: /Next: Programme/ }).click();
  await page.getByLabel("Start on site", { exact: true }).fill(MONDAY);
  await page.getByRole("button", { name: "Break the job into stages", exact: true }).click();
  const stage1 = page.locator("[data-programme-stage]").nth(0);
  await stage1.getByLabel("How long", { exact: true }).fill("3");
  await stage1.getByLabel("Days or weeks for stage 1", { exact: true }).selectOption("days");
  await stage1.getByLabel("Stage 1", { exact: true }).fill("Strip out");
  await page.getByRole("button", { name: "Add a stage", exact: true }).click();
  const stage2 = page.locator("[data-programme-stage]").nth(1);
  await stage2.getByLabel("How long", { exact: true }).fill("4");
  await stage2.getByLabel("Days or weeks for stage 2", { exact: true }).selectOption("days");
  await stage2.getByLabel("Stage 2", { exact: true }).fill("First fix");
  await page.locator("[data-programme-preview]").getByRole("button", { name: "Save programme", exact: true }).click();
  await expect(page.locator("[data-save-status='saved']")).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, `02-programme-saved-stages-${tag}.jpg`),
    type: "jpeg",
    quality: 92,
    fullPage: true,
  });
});