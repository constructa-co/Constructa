import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useId: () => "assistant-test", useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => read() }));
import PricingAssistantPanel from "./pricing-assistant-panel";
import { createPricingAssistantSession, type PricingAssistantSession } from "@/lib/pricing-assistant-session";
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function setup(available = true) {
    const read = vi.fn(() => ({ project: { id: "job", brief_scope: "<script>alert(1)</script>" }, estimate: null, hasOpenWork: false }));
    const generate = vi.fn().mockResolvedValue({ message: "<img src=x onerror=alert(1)>", suggestions: [{ source: "briefWork", start: 0, end: 25 }] });
    return { read, generate, session: createPricingAssistantSession(read, vi.fn().mockReturnValue({ ok: true }), available ? generate : undefined) };
}
function view(session: PricingAssistantSession, blocked = false) { return PricingAssistantPanel({ session, blocked }); }
describe("pricing guidance UI boundary", () => {
    it("is a closed native disclosure and honestly off with no composer, request or fabricated reply", () => {
        const f = setup(false), tree = view(f.session), html = renderToStaticMarkup(tree);
        expect(tree.type).toBe("details"); expect(tree.props.open).not.toBe(true);
        expect(html).toContain("Not enabled"); expect(html).toContain("isn&#x27;t switched on");
        expect(html).not.toContain("<form"); expect(html).not.toContain("<textarea");
        expect(f.read).not.toHaveBeenCalled(); expect(f.generate).not.toHaveBeenCalled();
        expect(tree.props.onToggle).toBeUndefined();
    });
    it("labels free-text conversation and requires explicit Send, not a questionnaire or automatic request", () => {
        const f = setup(), tree = view(f.session), elements = nodes(tree);
        const field = elements.find(e => e.type === "textarea")!, label = elements.find(e => e.type === "label")!;
        expect(label.props.htmlFor).toBe(field.props.id); expect(field.props["aria-describedby"]).toBe("assistant-test-help");
        expect(renderToStaticMarkup(tree)).toContain("confidential client details");
        expect(f.generate).not.toHaveBeenCalled();
        (field.props.onChange as (e: unknown) => void)({ target: { value: "My question" } }); expect(f.session.getSnapshot().message).toBe("My question");
        expect(f.generate).not.toHaveBeenCalled();
        const send = vi.spyOn(f.session, "send").mockResolvedValue("off");
        const preventDefault = vi.fn();
        (elements.find(e => e.type === "form")!.props.onSubmit as (e: unknown) => void)({ preventDefault });
        expect(preventDefault).toHaveBeenCalledOnce(); expect(send).toHaveBeenCalledOnce();
    });
    it("disables sending while open work blocks the parent and explains why", () => {
        const f = setup(); f.session.setMessage("Question");
        const tree = view(f.session, true), elements = nodes(tree);
        expect(elements.find(e => e.type === "textarea")!.props.disabled).toBe(true);
        expect(elements.find(e => e.type === "button" && e.props.type === "submit")!.props.disabled).toBe(true);
        expect(renderToStaticMarkup(tree)).toContain("Finish or cancel");
    });
    it("escapes untrusted reply/source text and offers only explicit unpriced drafts", async () => {
        const f = setup(); f.session.setMessage("<b>Question</b>"); await f.session.send();
        const tree = view(f.session), html = renderToStaticMarkup(tree);
        expect(html).toContain("&lt;img"); expect(html).toContain("&lt;script&gt;"); expect(html).not.toContain("<script>"); expect(html).not.toContain("<img");
        expect(html).toContain("not verified scope"); expect(html).toContain("No quantities or rates are filled");
        expect(html).toContain("Assistant: review needed"); expect(html).toContain("From saved work");
        const choose = vi.spyOn(f.session, "choose").mockReturnValue({ ok: true });
        const button = nodes(tree).find(e => e.type === "button" && e.props.children === "Open unpriced draft")!;
        expect(button.props.type).toBe("button"); (button.props.onClick as () => void)(); expect(choose).toHaveBeenCalledExactlyOnceWith(0);
    });
    it("hides choice controls when parent work opens after review", async () => {
        const f = setup(); f.session.setMessage("Question"); await f.session.send();
        expect(renderToStaticMarkup(view(f.session, true))).not.toContain("Open unpriced draft");
    });
    it("provides cancel/reset status without turning either into form submission", async () => {
        let release!: (value: unknown) => void;
        const s = createPricingAssistantSession(() => ({ project: { id: "job", brief_scope: "Prepare walls." }, estimate: null, hasOpenWork: false }), vi.fn(), () => new Promise(resolve => { release = resolve; }));
        s.setMessage("Question"); const request = s.send(); await Promise.resolve();
        const tree = view(s), stop = nodes(tree).find(e => e.props.children === "Stop waiting")!;
        expect(stop.props.type).toBe("button"); (stop.props.onClick as () => void)(); await request;
        expect(renderToStaticMarkup(view(s))).toContain("Stopped waiting");
        const reset = nodes(view(s)).find(e => e.props.children === "Clear conversation")!;
        expect(reset.props.type).toBe("button"); (reset.props.onClick as () => void)();
        expect(s.getSnapshot().conversation.messages).toEqual([]); release(null);
    });
});
