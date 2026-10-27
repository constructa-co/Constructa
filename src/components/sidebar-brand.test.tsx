import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SidebarBrand } from "./sidebar-brand";

describe("sidebar brand wordmark (A002)", () => {
    it("uses lowercase constructa, aria-hidden C mark, and approved Avenir stack in scoped CSS", () => {
        const css = readFileSync(new URL("./sidebar-brand.module.css", import.meta.url), "utf8");
        expect(css).toContain('"Avenir Next", "Gill Sans", "Trebuchet MS", sans-serif');

        const full = renderToStaticMarkup(<SidebarBrand />);
        expect(full).toContain("constructa");
        expect(full).not.toMatch(/>\s*Constructa\s*</);
        expect(full).toContain('aria-hidden="true"');

        const markOnly = renderToStaticMarkup(<SidebarBrand markOnly />);
        expect(markOnly).toContain('aria-hidden="true"');
        expect(markOnly).not.toContain("constructa");
    });
});
