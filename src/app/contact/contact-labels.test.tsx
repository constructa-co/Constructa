import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ContactPage from "./page";

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
    it("renders visible Name, Email, and Message labels associated by unique ids", () => {
        const elements = nodes(render());
        const fields = [
            { text: "Name", id: "contact-name", name: "name", type: "input" },
            { text: "Email", id: "contact-email", name: "email", type: "input" },
            { text: "Message", id: "contact-message", name: "message", type: "textarea" },
        ] as const;
        const ids = fields.map(field => {
            const label = elements.find(e => e.type === "label" && e.props.htmlFor === field.id)!;
            expect(label.props.children).toBe(field.text);
            expect(label.props.className).toBe("block text-sm font-medium text-gray-300 mb-2");
            expect(renderToStaticMarkup(label)).toContain(field.text);
            const control = elements.find(e => e.props.id === field.id)!;
            expect(control.type).toBe(field.type);
            expect(control.props.name).toBe(field.name);
            return field.id;
        });
        expect(new Set(ids).size).toBe(fields.length);
        expect(elements.filter(e => e.type === "label")).toHaveLength(fields.length);
        const markup = html();
        for (const field of fields) {
            expect(markup).toContain(`for="${field.id}"`);
            expect(markup).toContain(`id="${field.id}"`);
        }
    });

    it("preserves the existing form contract, copy, and mailto without posting", () => {
        const elements = nodes(render());
        const form = elements.find(e => e.type === "form")!;
        expect(form.props.action).toBe("https://formspree.io/f/xnnprlod");
        expect(form.props.method).toBe("POST");
        expect(form.props.className).toBe("space-y-6");
        expect(form.props.onSubmit).toBeUndefined();
        const name = elements.find(e => e.type === "input" && e.props.name === "name")!;
        expect(name.props.type).toBe("text");
        expect(name.props.required).toBe(true);
        expect(name.props.placeholder).toBe("Your Name");
        expect(name.props.className).toBe("w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent");
        const email = elements.find(e => e.type === "input" && e.props.name === "email")!;
        expect(email.props.type).toBe("email");
        expect(email.props.required).toBe(true);
        expect(email.props.placeholder).toBe("Your Email");
        expect(email.props.className).toBe("w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent");
        const message = elements.find(e => e.type === "textarea" && e.props.name === "message")!;
        expect(message.props.rows).toBe(5);
        expect(message.props.required).toBe(true);
        expect(message.props.placeholder).toBe("Your Message");
        expect(message.props.className).toBe("w-full p-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-700 focus:border-transparent");
        const submit = elements.find(e => e.type === "button" && e.props.type === "submit")!;
        expect(submit.props.children).toBe("Send Message");
        expect(submit.props.className).toBe("px-6 py-3 bg-white text-black text-sm font-medium rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200");
        const mail = elements.find(e => e.type === "a" && e.props.href === "mailto:hello@constructa.co")!;
        expect(mail.props.children).toBe("hello@constructa.co");
        const markup = html();
        expect(markup).toContain("Got a question? Want to stay in the loop?");
        expect(markup).toContain("We&#x27;re building Constructa to help construction professionals quote, plan, and win more work without the admin headache.");
        expect(markup).toContain("If you&#x27;ve got a question, suggestion, or want early access—we&#x27;d love to hear from you.");
        expect(markup).toContain("Or email us directly:");
        expect(markup).toContain("Your Name");
        expect(markup).toContain("Your Email");
        expect(markup).toContain("Your Message");
    });
});
