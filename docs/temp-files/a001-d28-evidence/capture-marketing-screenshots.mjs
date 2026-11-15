import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT;
const evid = process.env.A001_D28_EVIDENCE_DIR ?? "/opt/cursor/artifacts/a001-d28-palette";
if (!output) throw new Error("Set CONSTRUCTA_LOCAL_PHASE1_OUTPUT");

const pages = [
    { page: "home", route: "/", file: "marketing-palette-home.png" },
    { page: "features", route: "/features", file: "marketing-palette-features.png" },
    { page: "pricing", route: "/pricing", file: "marketing-palette-pricing.png" },
    { page: "about", route: "/about", file: "marketing-palette-about.png" },
    { page: "contact", route: "/contact", file: "marketing-palette-contact.png" },
    { page: "apply", route: "/apply", file: "marketing-palette-apply.png" },
    { page: "guides", route: "/guides", file: "marketing-palette-guides.png" },
    { page: "guide-article", route: "/guides/review-brief-and-price", file: "marketing-palette-guide-article.png" },
    { page: "customers", route: "/customers", file: "marketing-palette-customers-exception.png" },
];

mkdirSync(evid, { recursive: true });
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
const browser = await chromium.launch({ headless: true });
const capture = async ({ page, file }) => {
    const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await tab.setContent(
        '<!doctype html><html><head></head><body><div id="app"></div></body></html>',
    );
    if (css) await tab.addStyleTag({ content: css });
    await tab.evaluate(p => {
        window.__marketingPaletteOptions = { page: p };
    }, page);
    await tab.addScriptTag({ content: bundle });
    await tab.waitForSelector("[data-marketing-palette-page]");
    await tab.screenshot({ path: path.join(evid, file), fullPage: true });
    await tab.close();
    console.log("wrote", file);
};

for (const row of pages) await capture(row);
await browser.close();