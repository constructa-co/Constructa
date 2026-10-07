import { describe, expect, it } from "vitest";
import { discoverLinks, extractSuggestions, plainText } from "./extract";
import { CONTACT, HOME, SERVICES } from "./__fixtures__/site";

const page = (path: string, html: string) => ({ url: `https://www.smithbuilders.co.uk${path}`, html, fetchedAt: "2026-10-07T10:00:00.000Z" });
const SITE_PAGES = [page("/", HOME), page("/contact-us", CONTACT), page("/services", SERVICES)];
const WEBSITE = "https://www.smithbuilders.co.uk";
const byField = (pages = SITE_PAGES) => Object.fromEntries(extractSuggestions(pages, WEBSITE).map((entry) => [entry.field, entry]));

describe("extractSuggestions", () => {
    it("finds identity, services and contact facts, each with its source page and excerpt", () => {
        const found = byField();
        expect(Object.fromEntries(Object.entries(found).map(([field, entry]) => [field, entry.value]))).toEqual({
            company_name: "Smith Builders Ltd",
            website: "https://www.smithbuilders.co.uk",
            company_number: "01234567",
            vat_number: "GB123456789",
            specialisms: "House extensions, Loft conversions, Kitchen fitting, Garden rooms",
            phone: "0113 496 0000",
            sales_email: "hello@smithbuilders.co.uk",
            address: "1 Example Yard, Leeds, LS1 1AA",
        });
        expect(found.company_number).toMatchObject({ sourceUrl: "https://www.smithbuilders.co.uk/", basis: "page-text" });
        expect(found.company_number.excerpt).toContain("Company No. 01234567");
        expect(found.specialisms).toMatchObject({ sourceUrl: "https://www.smithbuilders.co.uk/services", basis: "page-heading" });
        expect(found.phone.basis).toBe("structured-data");
        expect(found.website.excerpt).toBe("The website address you entered and confirmed.");
    });

    it("gives the same answer every time", () => {
        expect(extractSuggestions(SITE_PAGES, WEBSITE)).toEqual(extractSuggestions(SITE_PAGES, WEBSITE));
    });

    it("treats instructions written into the page as text and nothing more", () => {
        const found = byField();
        // The hidden comment and the visible "ignore previous instructions" paragraph change nothing.
        expect(found.company_name.value).toBe("Smith Builders Ltd");
        const everything = JSON.stringify(extractSuggestions(SITE_PAGES, WEBSITE));
        expect(everything).not.toContain("Evil Corp");
        expect(everything).not.toMatch(/ignore (all )?previous instructions/i);
        expect(everything).not.toContain("+440000000000"); // only ever inside a <script>
    });

    it("returns plain text only: no tags, handlers or control characters survive", () => {
        const hostile = page("/services", `<html><body>
            <script type="application/ld+json">{"@type":"LocalBusiness","name":"<img src=x onerror=alert(1)>Acme <b>Roofing</b>\\u0000\\u202e","telephone":"&lt;b&gt;call now&lt;/b&gt;","email":"<i>boss@acme.co.uk</i> onerror=x"}</script>
            <h2><a href="javascript:alert(1)">Flat roofs</a></h2><h2>Slate &amp; tile <svg onload=alert(1)></svg></h2>
            <a href="mailto:boss@acme.co.uk<script>">mail</a>
        </body></html>`);
        const all = extractSuggestions([hostile], WEBSITE);
        for (const entry of all) {
            expect(`${entry.value} ${entry.excerpt}`, entry.field).not.toMatch(/[<>]|onerror|onload|javascript:/i);
            expect(entry.value, entry.field).not.toMatch(/[\u0000-\u001f‮]/);
        }
        const found = Object.fromEntries(all.map((entry) => [entry.field, entry.value]));
        expect(found.company_name).toBe("Acme Roofing");
        expect(found.specialisms).toBe("Flat roofs, Slate & tile");
        expect(found.phone).toBeUndefined();
        expect(found.sales_email).toBeUndefined();
    });

    it("suggests nothing it is not sure of", () => {
        const vague = page("/", `<html><head><title>Best Builders in Town | Home</title></head><body>
            <p>Call us today on 0113 496 0000 or pop in. We have 01234567 happy customers. VAT included.</p>
            <h2>Extensions</h2><h2>Lofts</h2>
            <a href="tel:12">short</a><a href="mailto:not-an-email">x</a>
            <address>Call 0113 496 0000 or email hello@smithbuilders.co.uk</address>
        </body></html>`);
        // Only the address the contractor typed. No name from the title, no phone from prose,
        // no services from a page that is not a services page, no company or VAT number.
        expect(extractSuggestions([vague], WEBSITE).map((entry) => entry.field)).toEqual(["website"]);
        expect(extractSuggestions([], WEBSITE)).toEqual([]);
    });

    it("ignores broken, oversized or irrelevant structured data", () => {
        const pages = [page("/", `<html><head>
            <script type="application/ld+json">{ not json </script>
            <script type="application/ld+json">{"@type":"WebSite","name":"Search box"}</script>
            <script type="application/ld+json">{"@type":"Person","name":"Sam Smith","telephone":"0113 496 0001"}</script>
            <script type="application/ld+json">{"@type":"LocalBusiness","name":"${"x".repeat(70_000)}"}</script>
            <script type="application/ld+json">{"@graph":[{"@type":["Organization","Plumber"],"name":"Real Plumbing Co","telephone":"+44 113 496 0002","makesOffer":[{"itemOffered":{"name":"Boiler installs"}},{"itemOffered":{"name":"Bathrooms"}}]}]}</script>
        </head><body></body></html>`)];
        const found = Object.fromEntries(extractSuggestions(pages, WEBSITE).map((entry) => [entry.field, entry.value]));
        expect(found).toEqual({
            company_name: "Real Plumbing Co",
            website: WEBSITE,
            specialisms: "Boiler installs, Bathrooms",
            phone: "+44 113 496 0002",
        });
    });

    it("keeps every value within its field's limit", () => {
        const headings = Array.from({ length: 40 }, (_, index) => `<h2>Service number ${index}</h2>`).join("");
        const found = byField([page("/services", `<html><body>${headings}<h2>${"y".repeat(500)}</h2></body></html>`)]);
        expect(found.specialisms.value.split(", ")).toHaveLength(12);
        expect(found.specialisms.excerpt.length).toBeLessThanOrEqual(240);
    });

    it("copes with a very large page quickly", () => {
        const big = `<html><body>${"<a href=".repeat(40_000)}${"<h2>".repeat(40_000)}${"&".repeat(40_000)}</body></html>`;
        const started = Date.now();
        extractSuggestions([page("/services", big)], WEBSITE);
        discoverLinks(big);
        expect(Date.now() - started).toBeLessThan(2000);
    });
});

describe("discoverLinks", () => {
    it("lists contact, about and services links in that order and nothing else", () => {
        expect(discoverLinks(HOME)).toEqual(["/contact-us", "/about", "/services"]);
        expect(discoverLinks(`<a href="mailto:contact@x.co.uk">c</a><a href="javascript:about()">a</a><a href="#contact">c</a><a href="/gallery">g</a>`)).toEqual([]);
        expect(discoverLinks(`<!-- <a href="/contact-hidden">x</a> --><script>'<a href="/about-script">'</script><a href='/about'>a</a>`)).toEqual(["/about"]);
    });
});

describe("plainText", () => {
    it("decodes entities once and strips markup", () => {
        expect(plainText("Tom &amp; Sons &lt;b&gt; &#38; &#x26; &pound;5 &bogus;")).toBe("Tom & Sons <b> & & £5 &bogus;");
        expect(plainText("<p>a</p>\n\t<p>b</p>")).toBe("a b");
    });
});
