import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContactPage, { metadata } from "./page";

beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONSTRUCTA_LAUNCH_PROFILE", "full");
});
afterEach(() => {
    vi.unstubAllEnvs();
});

type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function render() { return ContactPage(); }
const html = () => renderToStaticMarkup(render());

describe("actual contact form labels", () => {
    it("renders name, email, optional company, message, and consent with stable ids", () => {
        const elements = nodes(render());
        const fields = [
            { id: "contact-name", name: "name", type: "input" },
            { id: "contact-email", name: "email", type: "input" },
            { id: "contact-company", name: "company", type: "input" },
            { id: "contact-message", name: "message", type: "textarea" },
            { id: "contact-consent", name: "consent", type: "input" },
        ] as const;
        for (const field of fields) {
            const control = elements.find(e => e.props.id === field.id)!;
            expect(control.type).toBe(field.type);
            expect(control.props.name).toBe(field.name);
        }
        const markup = html();
        for (const field of fields) {
            expect(markup).toContain(`id="${field.id}"`);
        }
        expect(markup).toContain("Submission unavailable");
        expect(markup).not.toContain("formspree");
    });

    it("preserves intro copy and mailto without external POST while collection is off", () => {
        const markup = html();
        expect(markup).toContain("Got a question? Want to stay in the loop?");
        expect(markup).toContain('href="mailto:hello@constructa.co"');
        expect(markup).not.toContain("CONSTRUCTA_PUBLIC_CONTACT_FORM_DESTINATION");
        expect(markup).not.toMatch(/action="https?:\/\//i);
    });
});

describe("actual contact route metadata", () => {
    it("exports named Contact | Constructa metadata from the page module", () => {
        expect(metadata.title).toBe("Contact | Constructa");
        expect(metadata.description).toBe("Contact the Constructa team.");
        expect(metadata.alternates?.canonical).toMatch(/\/contact$/);
    });
});