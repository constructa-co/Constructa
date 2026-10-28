import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const mockServer = {
    create: vi.fn(),
    save: vi.fn(),
    addDiscipline: vi.fn(),
};

vi.mock("./library-actions", () => ({
    createCaseStudyAction: vi.fn(),
    saveCaseStudyAction: vi.fn(),
    saveDisciplineAction: vi.fn(),
    archiveCaseStudyAction: vi.fn(),
    archiveDisciplineAction: vi.fn(),
    startFromOlderCaseStudyAction: vi.fn(),
}));

import GuidedCapture from "./library/guided-capture";
import LibraryPanel from "./library-panel";

const GUIDED = path.join(process.cwd(), "src/app/dashboard/settings/case-studies/library/guided-capture.tsx");
const PANEL = path.join(process.cwd(), "src/app/dashboard/settings/case-studies/library-panel.tsx");

const BRAND_PRIMARY_BLUE = /bg-blue-700|hover:bg-blue-800/;

function forbiddenPrimaryBlue(source: string): string[] {
    const hits: string[] = [];
    for (const line of source.split("\n")) {
        if (line.includes("const primary") || line.includes("const chip")) {
            const match = line.match(BRAND_PRIMARY_BLUE);
            if (match) hits.push(...match);
        }
    }
    return hits;
}

const kinds = [
    { id: "k1", label: "Kitchen Installation", position: 0, revision: 1, archived: false },
];

describe("A001 guided capture + library panel brand primary (ROB2103)", () => {
    it("guided-capture source: sage primary/chip via core palette, plain nav link blue preserved", () => {
        const source = readFileSync(GUIDED, "utf8");
        expect(source).toContain("core-editing-palette");
        expect(source).toContain("corePrimaryButton");
        expect(forbiddenPrimaryBlue(source)).toEqual([]);
        expect(source).toMatch(/const plain = `[^`]*text-blue-200/);
    });

    it("library-panel source: sage primary via core palette", () => {
        const source = readFileSync(PANEL, "utf8");
        expect(source).toContain("corePrimaryButton");
        expect(forbiddenPrimaryBlue(source)).toEqual([]);
    });

    it("SSR library panel Add a past job uses sage primary classes, not brand blue", () => {
        const html = renderToStaticMarkup(
            createElement(LibraryPanel, {
                available: true,
                studies: [],
                disciplines: kinds,
                older: [],
                basePath: "/dashboard/settings/case-studies/library",
            } as never),
        );
        expect(html).toContain("Add a past job");
        expect(html).not.toMatch(BRAND_PRIMARY_BLUE);
        expect(html).toMatch(/bg-\[#c9efcf\]/);
    });

    it("SSR guided capture question submit primary avoids brand blue", () => {
        const html = renderToStaticMarkup(
            createElement(GuidedCapture, {
                initial: null,
                disciplines: kinds,
                server: mockServer,
                basePath: "/dashboard/settings/case-studies/library",
                listHref: "/dashboard/settings/case-studies",
            } as never),
        );
        expect(html).toContain('id="guided-answer"');
        expect(html).toContain('type="submit"');
        expect(html).not.toMatch(BRAND_PRIMARY_BLUE);
        expect(html).toMatch(/bg-\[#c9efcf\]/);
    });
});
