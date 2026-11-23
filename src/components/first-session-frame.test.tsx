import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FirstSessionFrame, FirstSessionPanel } from "./first-session-frame";

const render = (step: 0 | 1) => renderToStaticMarkup(
    <FirstSessionPanel step={step}><p>Existing form</p></FirstSessionPanel>
);

describe("first-session frame header", () => {
    it("uses the approved trust wording in the site chrome", () => {
        const html = renderToStaticMarkup(
            <FirstSessionFrame><p>Form</p></FirstSessionFrame>,
        );
        expect(html).toContain("A better way to build your business.");
        expect(html).not.toContain("build business.");
    });
});

describe("first-session supporting panel", () => {
    it("preserves the approved account introduction", () => {
        const html = render(0);
        expect(html).toContain("Your work deserves<br/>a better introduction.");
        expect(html).toContain("Less admin. A clearer price. A proposal that feels like your business.");
        for (const title of ["Your company", "Your work", "Your price", "Your proposal"]) {
            expect(html).toContain(`<strong>${title}</strong>`);
        }
        expect(html).not.toContain("Built around<br/>the work you do.");
    });

    it("gives setup its own message in the same four-row layout", () => {
        const html = render(1);
        expect(html).toContain("Built around<br/>the work you do.");
        expect(html).toContain("Start with the essentials. Add the detail when you&#x27;re ready.");
        for (const title of ["Your business", "Your identity", "Your pace", "Your first job"]) {
            expect(html).toContain(`<strong>${title}</strong>`);
        }
        const aside = html.slice(html.indexOf("<aside"));
        expect(aside.match(/<li\b/g)).toHaveLength(4);
        expect(aside).not.toContain("Your work deserves");
        expect(aside).not.toMatch(/<input|<button|<a /);
        expect(html).toContain("Existing form");
    });
});
