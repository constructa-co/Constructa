import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CompanyImportFrame from "./company-import-frame";

const cssPath = path.join(import.meta.dirname, "company-import.module.css");

describe("CompanyImportFrame presentation (A021)", () => {
    it("uses the canonical heading and retains URL-entry / review-before-save semantics in copy", () => {
        const html = renderToStaticMarkup(
            <CompanyImportFrame dark={false} draftId={null}><p>editor</p></CompanyImportFrame>,
        );
        expect(html).toContain("Your company, brought into focus.");
        expect(html).not.toContain("Your website. Your choices.");
        expect(html).toContain('id="import-heading"');
        expect(html).toContain('aria-label="How website import works"');
        expect(html).toContain("Review before you save");
        expect(html).toContain("Nothing is ticked for you");
        expect(html).toContain("A preview is not your profile");
    });

    it("declares a symmetric editor and guide column layout in component-owned CSS", () => {
        const css = readFileSync(cssPath, "utf8");
        expect(css).toMatch(/\.layout\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
        expect(css).toMatch(/\.guide\s*\{[^}]*border-radius:\s*18px/);
        expect(css).toContain(".editor");
    });
});
