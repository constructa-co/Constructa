import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhaseOneContact } from "@/components/marketing/cohort-contact";
import ContactPage, { metadata } from "./page";

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function render() { return ContactPage(); }
function renderCohort() { return PhaseOneContact(); }
const html = () => renderToStaticMarkup(render());

const BANNED_COPY = [
    "early access",
    "free trial",
    "trial",
    "sign up",
    "signup",
    "guarantee",
    "same day",
    "within 24",
    "certified",
    "registered office",
    "formspree",
] as const;

describe("contact route under the default cohort profile", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "cohort");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("renders a mailto contact with no form and no external POST", () => {
        const elements = nodes(renderCohort());
        const mail = elements.find(e => e.type === "a" && e.props.href === "mailto:hello@constructa.co")!;
        expect(mail).toBeDefined();
        expect(renderToStaticMarkup(mail)).toContain("hello@constructa.co");
        expect(elements.filter(e => e.type === "form")).toHaveLength(0);
        expect(elements.filter(e => e.type === "input" || e.type === "textarea" || e.type === "button")).toHaveLength(0);
        const markup = html();
        expect(markup).toContain('href="mailto:hello@constructa.co"');
        expect(markup).toContain("hello@constructa.co");
        expect(markup).not.toContain("<form");
        expect(markup).not.toContain("formspree");
        expect(markup).not.toContain("action=");
        expect(markup).not.toContain("method=");
    });

    it("has a single accessible h1 heading and no fields asking for private data", () => {
        const elements = nodes(renderCohort());
        const headings = elements.filter(e => e.type === "h1");
        expect(headings).toHaveLength(1);
        const headingText = renderToStaticMarkup(headings[0]).replace(/<[^>]+>/g, "").trim();
        expect(headingText.length).toBeGreaterThan(0);
        const labels = elements.filter(e => e.type === "label");
        expect(labels).toHaveLength(0);
        expect(html()).toContain('id="contact-what-to-expect"');
    });

    it("keeps copy truthful: no access promises, SLAs, prices, addresses or certifications", () => {
        const markup = html();
        const text = markup.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").toLowerCase();
        for (const banned of BANNED_COPY) {
            expect(text).not.toContain(banned);
        }
        expect(text).not.toMatch(/£|\$|€/);
    });

    it("links only to internal pages plus the mailto, including product and access pages", () => {
        const elements = nodes(renderCohort());
        const anchors = elements.filter(e => typeof e.props.href === "string");
        expect(anchors.length).toBeGreaterThan(0);
        const hrefs = anchors.map(e => e.props.href as string);
        for (const href of hrefs) {
            expect(href.startsWith("/") || href.startsWith("mailto:")).toBe(true);
        }
        expect(hrefs).toContain("/features");
        expect(hrefs).toContain("/pricing");
        expect(hrefs).toContain("/");
        expect(hrefs).toContain("mailto:hello@constructa.co");
    });

    it("exports neutral metadata that promises nothing", () => {
        expect(metadata).toEqual({
            title: "Contact | Constructa",
            description: "Contact the Constructa team.",
        });
        const description = (metadata.description ?? "").toLowerCase();
        expect(description).not.toContain("early access");
    });
});

describe("contact route under the full profile", () => {
    beforeEach(() => {
        vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
    });
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("retains the legacy form with its existing processor and destination", () => {
        const elements = nodes(render());
        const form = elements.find(e => e.type === "form")!;
        expect(form.props.action).toBe("https://formspree.io/f/xnnprlod");
        expect(form.props.method).toBe("POST");
        expect(elements.some(e => e.type === "input" && e.props.name === "name")).toBe(true);
        expect(elements.some(e => e.type === "input" && e.props.name === "email")).toBe(true);
        expect(elements.some(e => e.type === "textarea" && e.props.name === "message")).toBe(true);
        const submit = elements.find(e => e.type === "button" && e.props.type === "submit")!;
        expect(submit.props.children).toBe("Send Message");
        const markup = html();
        expect(markup).toContain("Got a question? Want to stay in the loop?");
        expect(markup).toContain('href="mailto:hello@constructa.co"');
    });
});
