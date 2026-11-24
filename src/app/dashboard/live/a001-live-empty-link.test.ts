import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("A001 live projects empty-state link", () => {
    it("routes create-first-project through sage pipeline link tokens, not brand blue", () => {
        const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
        expect(source).toContain("corePipelineTextLinkSmThemed");
        expect(source).toMatch(/Create your first project/);
        expect(source).not.toMatch(/text-blue-400 hover:underline text-sm">\+ Create your first project/);
    });
});
