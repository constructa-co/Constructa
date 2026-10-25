import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * C17 / A007 — compact optional work-suggestion chrome only.
 * C41 / A008 - 320px keeps two columns; single-column fallback only below 320.
 */
describe("compact setup work suggestion chrome (A007)", () => {
    it("scopes tighter grid gap and touch targets to workSuggestions/workSuggestion only", () => {
        const css = readFileSync(new URL("../../components/first-session.module.css", import.meta.url), "utf8");
        expect(css).toMatch(/\.workSuggestions\s*\{[^}]*gap:\s*6px/);
        expect(css).toMatch(/\.workSuggestion\s*\{[^}]*min-height:\s*44px/);
        expect(css).toMatch(/\.workSuggestion\s*\{[^}]*padding:\s*8px 10px/);
        expect(css).toMatch(/\.workSuggestion\s*\{[^}]*font-size:\s*14px/);
        expect(css).toMatch(/\.workSuggestion\s*\{[^}]*border-radius:\s*8px/);
        expect(css).toMatch(/\.workSuggestion\[aria-pressed="true"\]\s*\{[^}]*var\(--session-accent\)/);
        expect(css).toMatch(/@media\s*\(max-width:\s*319px\)\s*\{\s*\.workSuggestions\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
        expect(css).not.toMatch(/@media\s*\(max-width:\s*359px\)\s*\{\s*\.workSuggestions/);
        expect(css).not.toMatch(/@media\s*\(max-width:\s*420px\)\s*\{\s*\.workSuggestions/);
        expect(css).not.toMatch(/\.workSuggestion\s*\{[^}]*min-height:\s*64px/);
        expect(css).not.toMatch(/\.workSuggestions\s*\{[^}]*gap:\s*10px/);
        expect(css).not.toMatch(/\.input\s*\{[^}]*font-size:\s*14px/);
    });
});
