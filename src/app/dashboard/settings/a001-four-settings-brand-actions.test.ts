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

/** Brand-action blues removed at e2e1e36; syntax/docs/status blues intentionally kept. */
const ALLOWED_BLUE = [
    /text-blue-400/, // API param names, sync direction glyphs, rate-limit labels
    /text-blue-200/, // case-study editor navigation underlines (not primary buttons)
];

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
});
