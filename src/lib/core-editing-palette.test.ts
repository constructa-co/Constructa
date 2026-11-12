import { describe, expect, it } from "vitest";
import {
    coreFocusRing,
    coreFocusVisibleRing,
    coreFormAccent,
    corePipelineLinkColor,
    corePipelineTextLinkSmThemed,
    corePrimaryButton,
    coreProfileField,
    coreSelectedChoiceBorder,
} from "./core-editing-palette";

describe("core editing palette tokens", () => {
    it("uses emerald/sage focus rings, not blue", () => {
        for (const cls of [coreFocusRing, coreFocusVisibleRing]) {
            expect(cls).toContain("emerald-600");
            expect(cls).not.toMatch(/blue/);
        }
    });

    it("uses the established sage primary pair for actions", () => {
        expect(corePrimaryButton).toContain("#c9efcf");
        expect(corePrimaryButton).toContain("#182c1b");
        expect(corePrimaryButton).not.toMatch(/blue/);
    });

    it("profile field and checkbox accent tokens avoid brand blue", () => {
        expect(coreProfileField).toContain("emerald-600");
        expect(coreProfileField).not.toMatch(/blue/);
        expect(coreFormAccent).toBe("accent-emerald-600");
    });

    it.each([
        [true, "text-emerald-400", "text-emerald-300"],
        [false, "text-emerald-700", "text-emerald-800"],
    ])("pipeline link colour dark=%s uses readable emerald pair", (isDark, text, hover) => {
        const colour = corePipelineLinkColor(isDark);
        expect(colour).toContain(text);
        expect(colour).toContain(hover);
        expect(colour).toContain("focus-visible:ring-emerald-600");
        expect(colour).not.toMatch(/text-emerald-500/);
        expect(corePipelineTextLinkSmThemed(isDark)).toContain(text);
    });

    it.each([
        [true, true],
        [true, false],
        [false, true],
        [false, false],
    ])("selected choice border in dark=%s chosen=%s avoids accidental blue", (isDark, chosen) => {
        const border = coreSelectedChoiceBorder(isDark, chosen);
        expect(border).not.toMatch(/blue/);
        if (chosen) {
            expect(border).toContain("emerald-600");
        }
    });
});
