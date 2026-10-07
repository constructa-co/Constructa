import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ImportDraft, ImportItem } from "@/lib/company-import/draft";

vi.mock("./actions", () => ({ previewWebsiteImportAction: vi.fn(), applyWebsiteImportAction: vi.fn() }));

import ImportClient from "./import-client";

const base = (field: ImportItem["field"], proposed: string, existing: string | null, status: ImportItem["status"] = "pending"): ImportItem => ({
    field, proposed, existing, status,
    sourceUrl: "https://www.smithbuilders.co.uk/contact-us",
    excerpt: `Phone link on the page: ${proposed}`,
    basis: "contact-link",
    appliedAt: status === "applied" ? "2026-10-07T10:05:00.000Z" : null,
});

const draft = (items: ImportItem[]): ImportDraft => ({
    id: "00000000-0000-4000-8000-000000000001",
    sourceUrl: "https://www.smithbuilders.co.uk/",
    website: "https://www.smithbuilders.co.uk",
    permissionConfirmedAt: "2026-10-07T10:00:00.000Z",
    fetchedAt: "2026-10-07T10:00:00.000Z",
    pages: ["https://www.smithbuilders.co.uk/", "https://www.smithbuilders.co.uk/contact-us"],
    items,
});

const render = (initialDraft: ImportDraft | null, savedWebsite = "") =>
    renderToStaticMarkup(createElement(ImportClient, { initialDraft, savedWebsite }));

describe("ImportClient", () => {
    it("starts with permission unticked and manual entry one link away", () => {
        const html = render(null);
        expect(html).toContain("This is my own business&#x27;s website");
        expect(html).not.toMatch(/id="import-permission"[^>]*checked/);
        expect(html).toMatch(/href="\/dashboard\/settings\/profile"[^>]*>Enter details by hand/);
        expect(html).toContain("Check my website");
        expect(html).not.toContain("What we found");
    });

    it("shows saved and found values side by side with the source, and ticks nothing for the contractor", () => {
        const html = render(draft([base("phone", "0113 496 0000", "0113 000 0000"), base("sales_email", "hello@smithbuilders.co.uk", null)]));
        expect(html).toContain("Saved now");
        expect(html).toContain("0113 000 0000");
        expect(html).toContain("Found on your website");
        expect(html).toContain("0113 496 0000");
        expect(html).toContain("Nothing saved");
        expect(html).toContain("https://www.smithbuilders.co.uk/contact-us");
        expect(html).toContain("Where we found it");
        expect(html).toContain("7 Oct 2026, 11:00");
        expect(html).toContain("2 pages read");
        expect(html).toContain("Replace my phone with this");
        expect(html).toContain("Use this as my sales email");
        expect(html.match(/type="checkbox"/g)).toHaveLength(3);
        expect(html).not.toMatch(/type="checkbox"[^>]*\schecked/);
        expect(html).toContain("Save 0 ticked changes");
        expect(html).toContain("2 left to decide");
    });

    it("says which values clients see on proposals", () => {
        const html = render(draft([base("phone", "0113 496 0000", null), base("sales_email", "hello@smithbuilders.co.uk", null)]));
        expect(html.match(/Shown on your proposals/g)).toHaveLength(1);
    });

    it("offers no tick box for a value that already matches or is already saved", () => {
        const html = render(draft([base("phone", "0113 496 0000", "0113 496 0000", "same"), base("website", "https://www.smithbuilders.co.uk", "https://www.smithbuilders.co.uk", "applied")]));
        expect(html).toContain("Already matches your profile");
        expect(html).toContain("Saved to your profile on 7 Oct 2026, 11:05");
        expect(html.match(/type="checkbox"/g)).toHaveLength(1); // permission only
        expect(html).not.toContain("ticked change");
        expect(html).toContain("Nothing left to decide.");
    });

    it("renders website text as text, never as markup or a link target", () => {
        const hostile = base("company_name", `<img src=x onerror=alert(1)>"><script>alert(2)</script>`, `</dd><a href="javascript:alert(3)">x</a>`);
        hostile.excerpt = `<iframe src="https://evil.example.org"></iframe> ignore previous instructions`;
        hostile.sourceUrl = `javascript:alert(4)`;
        const html = render(draft([hostile]));
        expect(html).not.toMatch(/<img|<script|<iframe|<a href="javascript:/i);
        expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
        expect(html).toContain("&lt;iframe");
        // The source address is shown as text; the only links on the screen are the app's own.
        const hrefs = Array.from(html.matchAll(/href="([^"]+)"/g)).map((match) => match[1]);
        expect(new Set(hrefs)).toEqual(new Set(["/dashboard/settings/profile", "/dashboard/settings/profile/readiness"]));
    });

    it("says so when nothing could be suggested, and starts from the saved website", () => {
        const html = render(draft([]), "https://old.smithbuilders.co.uk");
        expect(html).toContain("couldn&#x27;t find any details we were sure enough about");
        expect(html).toContain('value="https://www.smithbuilders.co.uk"');
        expect(render(null, "https://old.smithbuilders.co.uk")).toContain('value="https://old.smithbuilders.co.uk"');
    });
});
