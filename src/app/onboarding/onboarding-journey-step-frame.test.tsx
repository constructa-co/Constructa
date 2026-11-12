import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
/**
 * C41 / A008 — whole-journey phone step-frame composition (not chip-width tweaks).
 * Bounded source scans only; no viewport-height whole-step gates.
 */
const cssPath = new URL("../../components/first-session.module.css", import.meta.url);
const loginPath = new URL("../login/page.tsx", import.meta.url);
const onboardingPath = new URL("./onboarding-client.tsx", import.meta.url);

function phoneBlock(source: string) {
    const start = source.indexOf("@media (max-width: 650px)");
    const end = source.indexOf("/* Welcome-only layout");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
}

describe("whole-journey phone step frame (A008)", () => {
    const css = readFileSync(cssPath, "utf8");
    const phone = phoneBlock(css);

    it("marks account signup and setup with the same journey step form class", () => {
        const login = readFileSync(loginPath, "utf8");
        const onboarding = readFileSync(onboardingPath, "utf8");
        expect(login).toMatch(/className=\{isSignUp \? ui\.journeyStepForm : undefined\}/);
        expect(onboarding).toMatch(/className=\{`\$\{ui\.journeyStepForm\} \$\{ui\.setupForm\}`\}/);
        expect(onboarding).not.toContain("mt-8");
    });

    it("scopes shared phone padding to journeyStepForm, not setup-only :has(.setupForm) padding", () => {
        expect(phone).toMatch(/\.formSide:has\(\.journeyStepForm\)\s*\{\s*padding-top:\s*22px;\s*padding-bottom:\s*22px;\s*\}/);
        expect(phone).not.toMatch(/\.formSide:has\(\.setupForm\)\s*\{[^}]*padding-top/);
    });

    it("bounds optional choices inside the setup form with scroll, without shrinking 44px chips", () => {
        expect(phone).toMatch(/\.setupForm \.workSuggestions\s*\{[^}]*max-height:\s*15\.5rem/);
        expect(phone).toMatch(/\.setupForm \.workSuggestions\s*\{[^}]*overflow-y:\s*auto/);
        expect(css).toMatch(/\.workSuggestion\s*\{[^}]*min-height:\s*44px/);
        expect(phone).not.toMatch(/\.setupForm \.workSuggestion\s*\{/);
        expect(phone).not.toMatch(/844px|100dvh|100vh/);
    });

    it("shortens the setup story panel on phone without hiding the step heading", () => {
        expect(phone).toMatch(/\.panel:has\(\.setupForm\)\s*>\s*\.storySide \.lede,\s*\.panel:has\(\.setupForm\)\s*>\s*\.storySide \.footnote\s*\{\s*display:\s*none;/);
        expect(phone).toMatch(/\.panel:has\(\.setupForm\)\s*>\s*\.storySide\s*\{[^}]*gap:\s*8px/);
        expect(css).toMatch(/\.storyHeading\s*\{/);
    });

    it("does not introduce a whole-step viewport fit gate or new harness selectors", () => {
        expect(css).not.toMatch(/max-height:\s*844px/);
        expect(css).not.toMatch(/height:\s*844px/);
        expect(readFileSync(onboardingPath, "utf8")).not.toMatch(/data-a008|data-step-frame-harness/);
    });
});
