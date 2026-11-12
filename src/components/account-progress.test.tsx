import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FirstSessionPanel } from "./first-session-frame";

describe("account/setup progress and overview alignment", () => {
    it("defaults the shared panel to no setup progress", () => {
        const html = renderToStaticMarkup(<FirstSessionPanel><p>Existing form</p></FirstSessionPanel>);
        expect(html).not.toContain('aria-label="Getting started"');
        expect(html).toContain("Existing form"); expect(html).toContain("Your work deserves");
    });
    it.each([0, 1] as const)("preserves the explicit %s setup step", step => {
        const html = renderToStaticMarkup(<FirstSessionPanel step={step}><p>Existing form</p></FirstSessionPanel>);
        expect(html).toContain('aria-label="Getting started"');
        expect(html.match(/aria-current="step"/g)).toHaveLength(1);
        expect(html).toContain(`<li aria-current="step"><span aria-hidden="true">${step + 1}</span>${step === 0 ? "Account" : "The essentials"}</li>`);
    });
    it.each([undefined, 0, 1] as const)("places each decorative number beside its heading, before the detail for %s", step => {
        const html = renderToStaticMarkup(<FirstSessionPanel step={step}><p>Existing form</p></FirstSessionPanel>);
        const aside = html.slice(html.indexOf("<aside"));
        const rows = [...aside.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1]);
        expect(rows).toHaveLength(4);
        rows.forEach((row, index) => expect(row).toMatch(new RegExp(`^<strong>[^<]+</strong><span aria-hidden="true">0${index + 1}</span><p>[^<]+</p>$`)));
    });
    it("uses an explicit baseline-aligned grid, with detail on its own row", () => {
        const css = readFileSync(new URL("./first-session.module.css", import.meta.url), "utf8");
        expect(css).toMatch(/\.overview li\s*\{[^}]*display:\s*grid/);
        expect(css).toMatch(/\.overview li\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/);
        expect(css).toMatch(/\.overview li\s*\{[^}]*align-items:\s*baseline/);
        expect(css).toMatch(/\.overview p\s*\{[^}]*grid-column:\s*1/);
        expect(css).toMatch(/\.overview p\s*\{[^}]*margin:\s*0/);
        expect(css).toMatch(/\.overview li::before\s*\{[^}]*top:\s*22px/);
    });
});
