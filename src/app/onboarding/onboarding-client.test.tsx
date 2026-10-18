import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SETUP_WORK_SUGGESTIONS } from "@/lib/first-session";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("./actions", () => ({ saveSetupStepAction: vi.fn() }));

import OnboardingClient from "./onboarding-client";

const props = {
    initialStep: "trade" as const,
    initialBusinessType: "Kitchen fitting and small extensions",
    initialCompanyName: "Example Local Builders",
    initialFullName: "Local Builder",
    completionPath: "/dashboard",
    exitPath: "/dashboard",
};

describe("setup work choices", () => {
    it("offers the broader disciplines as optional pressed-state buttons, preserving free text", () => {
        const html = renderToStaticMarkup(createElement(OnboardingClient, props));
        for (const label of ["Refurbishment &amp; fit-out", "Demolition &amp; site preparation",
            "Ventilation &amp; air conditioning", "Glazing &amp; window installation"]) {
            expect(html).toContain(label);
        }
        expect(SETUP_WORK_SUGGESTIONS).toHaveLength(16);
        expect(html.match(/aria-pressed="false"/g)).toHaveLength(16);
        expect(html).toContain(props.initialBusinessType);
        expect(html).toMatch(/<textarea[^>]*id="setup-work"[^>]*maxlength="200"/i);
        expect(html).toContain("(optional)");
        expect(html).not.toContain("<select");
        expect(html).toContain("Save and continue");
    });

    it("recognises an existing suggestion without selecting other disciplines", () => {
        const html = renderToStaticMarkup(createElement(OnboardingClient, {
            ...props, initialBusinessType: "Roofing",
        }));
        expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
        expect(html.match(/aria-pressed="false"/g)).toHaveLength(SETUP_WORK_SUGGESTIONS.length - 1);
    });

    it("uses an aligned responsive grid with restrained corners and green selected states", () => {
        const css = readFileSync(new URL("../../components/first-session.module.css", import.meta.url), "utf8");
        expect(css).toMatch(/\.workSuggestions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
        expect(css).toMatch(/\.workSuggestion\s*\{[^}]*min-height:\s*64px/);
        expect(css).toMatch(/\.workSuggestion\s*\{[^}]*border-radius:\s*8px/);
        expect(css).toMatch(/\.workSuggestion\[aria-pressed="true"\]\s*\{[^}]*var\(--session-accent\)/);
        expect(css).toMatch(/@media\s*\(max-width:\s*420px\)\s*\{\s*\.workSuggestions\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    });
});
