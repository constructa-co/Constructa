import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import FirstProjectStart from "@/components/first-project-start";

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("A001 dashboard home primary palette", () => {
    it("dashboard-client: no brand-blue primary remains; primary CTAs use the core palette", () => {
        const source = read("src/app/dashboard/dashboard-client.tsx");
        expect(source).toContain("core-editing-palette");
        expect(source).not.toMatch(/bg-blue-600/);
        expect(source).not.toMatch(/hover:bg-blue-[57]00/);
        // Both header CTAs stay links to the New Project route with their copy.
        expect(source).toContain('href="/dashboard/projects/new"');
        expect(source).toContain("+ New Project");
        expect(source).toContain("+ Create Your First Project");
        // The brand tile behind the C letter is charcoal/green, not blue.
        expect(source).not.toMatch(/rounded-2xl bg-blue-/);
        // Non-primary blues are untouched: the launch-notice banner and any
        // informational styling are not part of this palette fix.
        expect(source).toMatch(/bg-blue-500\/10/);
    });

    it("first-project-start: sole primary action uses the core palette; geometry and journey kept", () => {
        const source = read("src/components/first-project-start.tsx");
        expect(source).toContain("core-editing-palette");
        expect(source).not.toMatch(/bg-blue-600/);
        expect(source).not.toMatch(/hover:bg-blue-500/);
        // Copy, sizing and icon are unchanged.
        expect(source).toContain("Add your first job");
        expect(source).toContain("min-h-12");
        expect(source).toContain("ArrowRight");
        // The decorative step-number chips are not primary controls: left as-is.
        expect(source).toContain("bg-blue-100 text-blue-700");
        expect(source).toContain("bg-blue-500/20 text-blue-300");
    });

    it.each([true, false])("renders the first-project primary in brand sage in both themes (dark=%s)", (dark) => {
        const html = renderToStaticMarkup(createElement(FirstProjectStart, {
            companyName: "Smith Brickwork",
            forceDark: dark,
        }));
        const anchor = html.match(/<a[^>]*>[\s\S]*?Add your first job[\s\S]*?<\/a>/)?.[0] ?? "";
        expect(anchor).toContain("bg-[#c9efcf]");
        expect(anchor).toContain("text-[#182c1b]");
        expect(anchor).not.toMatch(/blue-/);
        expect(anchor).toContain("Add your first job");
        // Geometry preserved.
        expect(html).toContain("min-h-12");
        expect(html.match(/data-step-number/g)).toHaveLength(4);
    });
});
