import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT;
const evid = process.env.A001_D28_EVIDENCE_DIR ?? "/opt/cursor/artifacts/a001-d28-palette";
if (!output) throw new Error("Set CONSTRUCTA_LOCAL_NAVIGATION_OUTPUT");

mkdirSync(evid, { recursive: true });
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.setContent(
    '<!doctype html><html><head></head><body><div id="app"></div></body></html>',
);
if (css) await page.addStyleTag({ content: css });
await page.evaluate(() => {
    window.__navigationPaletteOptions = { theme: "dark" };
});
await page.addScriptTag({ content: bundle });
await page.waitForSelector('aside [aria-current="page"]');
await page.screenshot({
    path: path.join(evid, "navigation-palette-desktop-dark.png"),
    fullPage: true,
});
await browser.close();
console.log("wrote navigation-palette-desktop-dark.png");