import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(process.cwd(), "src/app/dashboard/settings");

const TARGETS = [
    "case-studies/case-studies-client.tsx",
    "case-studies/library/case-study-editor.tsx",
    "api-keys/api-keys-client.tsx",
    "integrations/integrations-client.tsx",
] as const;

function forbiddenBrandBlue(source: string): string[] {
    const hits: string[] = [];
    const patterns = [
        /focus:ring-blue-\d+/g,
        /bg-blue-[67]00/g,
        /hover:bg-blue-[78]00/g,
        /accent-blue-/g,
        /border-blue-[47]00/g,
    ];
    for (const pattern of patterns) {
        const match = source.match(pattern);
        if (match) hits.push(...match);
    }
    return hits;
}

describe("A001 four settings controls brand actions", () => {
    it.each(TARGETS)("%s uses core-editing-palette for primary/focus, not brand blue actions", (rel) => {
        const source = readFileSync(path.join(ROOT, rel), "utf8");
        expect(source).toContain("core-editing-palette");
        const forbidden = forbiddenBrandBlue(source);
        expect(forbidden, `brand blue remnants: ${forbidden.join(", ")}`).toEqual([]);
    });

    it("api-keys preserves syntax-example blue (semantic, not brand action)", () => {
        const source = readFileSync(path.join(ROOT, "api-keys/api-keys-client.tsx"), "utf8");
        expect(source).toMatch(/text-blue-400/);
        expect(source).not.toMatch(/bg-blue-600/);
    });

    it("integrations preserves direction glyph blue, not sync primary blue", () => {
        const source = readFileSync(path.join(ROOT, "integrations/integrations-client.tsx"), "utf8");
        expect(source).toMatch(/text-blue-400 font-mono/);
        expect(source).not.toMatch(/bg-blue-600/);
    });

    it("case-studies Add another example keeps original flex geometry, not link helper sizing", () => {
        const source = readFileSync(path.join(ROOT, "case-studies/case-studies-client.tsx"), "utf8");
        const match = source.match(/data-add-example\s*\n\s*className=\{`([^`]+)`\}/);
        expect(match, "data-add-example button className").toBeTruthy();
        const cls = match![1];
        expect(cls).toContain("flex items-center gap-2");
        expect(cls).toContain("px-4 py-2.5");
        expect(cls).toContain("transition-colors");
        expect(cls).not.toContain("inline-flex");
        expect(cls).not.toContain("min-h-11");
        expect(cls).not.toContain("coreProfileSecondaryLink");
        expect(cls).toMatch(/emerald/);
        expect(cls).not.toMatch(/blue-[47]/);
    });
});
