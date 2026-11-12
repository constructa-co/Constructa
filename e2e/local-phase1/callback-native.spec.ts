import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const output = process.env.CONSTRUCTA_LOCAL_PHASE1_OUTPUT!;
const bundle = readFileSync(path.join(output, "components.js"), "utf8");
const css = readFileSync(path.join(output, "components.css"), "utf8");
const NOTICE =
    "We couldn't confirm that sign-in link. Try signing in, or request a new link.";
const scope = {
    component: "Canonical LoginPage + AuthCallbackNotice (constructa f422538)",
    address: "Real browser document URL via real internal about:blank? URL navigation then setContent; no window.location stub in bundle",
    context: "Strict CSP offline; auth/signup/router refused; after-hydration read of location.search",
    vitestSeams: "NOT_RUN; does not duplicate auth-callback-notice.test.tsx stubbed window cases",
};

let requests: string[] = [];
let errors: string[] = [];

const shell = `<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'"><title>Native callback notice - offline canonical login</title></head><body><p>LOCAL FIXTURE: canonical LoginPage; real document search string only.</p><div id="app"></div></body></html>`;

test.beforeEach(async ({ context }) => {
    requests = [];
    errors = [];
    await context.setOffline(true);
    await context.route("**/*", r => r.abort());
});

test.afterEach(async ({ page }, info) => {
    expect(await page.evaluate(() => window.__callbackNativeLocal?.calls ?? [])).toEqual([]);
    expect(requests).toEqual([]);
    expect(errors).toEqual([]);
    await info.attach("scope", { body: JSON.stringify({ ...scope, requests, errors }), contentType: "application/json" });
});

async function mountWithSearch(page: import("@playwright/test").Page, search: string) {
    page.on("request", r => requests.push(r.url()));
    page.on("pageerror", e => errors.push(e.message));
    const documentUrl = search ? `about:blank${search.startsWith("?") ? search : `?${search}`}` : "about:blank";
    await page.goto(documentUrl);
    await page.setContent(shell);
    expect(await page.evaluate(() => window.location.search)).toBe(
        search ? (search.startsWith("?") ? search : `?${search}`) : "",
    );
    await expect(page.locator("[data-auth-callback-notice]")).toHaveCount(0);
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle });
}

test("after hydration, exact auth-code-error search shows fixed callback notice on actual LoginPage", async ({ page }) => {
    await mountWithSearch(page, "?error=auth-code-error");
    const notice = page.locator("[data-auth-callback-notice]");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute("role", "alert");
    await expect(notice).toHaveText(NOTICE);
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByText("auth-code-error", { exact: true })).toHaveCount(0);
    await expect(page.getByText("?error=", { exact: false })).toHaveCount(0);
});

test("hostile error query shows no notice and never echoes raw query text", async ({ page }) => {
    await mountWithSearch(page, "?error=%3Cb%3Eprovider%20detail%3C%2Fb%3E");
    await expect(page.locator("[data-auth-callback-notice]")).toHaveCount(0);
    await expect(page.getByText("provider detail")).toHaveCount(0);
    await expect(page.getByText("<b>", { exact: false })).toHaveCount(0);
});

test("duplicate error params show no notice and never echo auth-code-error", async ({ page }) => {
    await mountWithSearch(page, "?error=auth-code-error&error=x");
    await expect(page.locator("[data-auth-callback-notice]")).toHaveCount(0);
    await expect(page.getByText("auth-code-error", { exact: true })).toHaveCount(0);
});
