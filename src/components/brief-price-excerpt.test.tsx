import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { buildPricingReviewContext, type PricingReviewContext } from "@/lib/pricing-review";
import { workspaceStyles } from "@/lib/workspace-styles";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, open: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => {
    const index = replay.cursor++;
    if (!(index in replay.slots)) replay.slots[index] = initial;
    return [replay.slots[index], (value: unknown) => { replay.slots[index] = value; }];
} }));
import BriefPriceExcerpt from "./brief-price-excerpt";

type Element = ReactElement<Record<string, unknown>>;
const work = "Prepare walls.\n\nPaint the ceiling, excluding the beams.\n\n" + "Keep existing fittings. ".repeat(30);
function context(text = work) {
    const result = buildPricingReviewContext({ id: "job", brief_scope: text }, null);
    if (!result.ok) throw Error(result.error); return result.value;
}
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Element;
    return [node, ...nodes(node.props.children)];
}
function view(current = context(), blocked = false) {
    replay.cursor = 0;
    return BriefPriceExcerpt({ context: current, blocked, styles: workspaceStyles(false), onOpen: replay.open });
}
function source(current = context()) { return nodes(view(current)).find(n => n.type === "textarea")!.props; }
function button(current = context(), blocked = false) { return nodes(view(current, blocked)).find(n => n.type === "button")!.props; }
function select(start: number, end: number, current = context(), value = current.work) {
    (source(current).onSelect as (event: unknown) => void)({ currentTarget: { value, selectionStart: start, selectionEnd: end } });
}
beforeEach(() => { replay.slots = []; replay.cursor = 0; replay.open.mockReset().mockReturnValue({ ok: true }); });

describe("manual saved-brief excerpt review", () => {
    it("starts closed with a labelled read-only source and no automatic draft or form submission", () => {
        const tree = view(); expect(tree.type).toBe("details"); expect(tree.props.open).toBeUndefined();
        expect(nodes(tree).find(n => n.type === "label")!.props.htmlFor).toBe(source().id);
        expect(source().readOnly).toBe(true); expect(source().value).toBe(work); expect(source().onChange).toBeUndefined();
        expect(button().type).toBe("button"); expect(button().disabled).toBe(true);
        expect(replay.open).not.toHaveBeenCalled();
    });
    it("previews the exact chosen work with qualifiers, but opens only after explicit choice", () => {
        const quote = "Paint the ceiling, excluding the beams.", start = work.indexOf(quote);
        select(start, start + quote.length);
        expect(renderToStaticMarkup(view())).toContain(quote); expect(replay.open).not.toHaveBeenCalled();
        expect(button().disabled).toBe(false); (button().onClick as () => void)();
        expect(replay.open).toHaveBeenCalledOnce();
        expect(replay.open.mock.calls[0][0].suggestions).toEqual([{ source: "briefWork", start, end: start + quote.length, description: quote }]);
        expect(replay.open.mock.calls[0][0]).not.toHaveProperty("unit_rate");
    });
    it("normalizes only selected whitespace without adding or dropping words", () => {
        select(0, work.indexOf("\n\nKeep"));
        expect(nodes(view()).find(n => n.type === "blockquote")!.props.children).toBe("Prepare walls. Paint the ceiling, excluding the beams.");
        expect(replay.open).not.toHaveBeenCalled();
    });
    it.each([501, 700])("refuses %s characters without truncation", count => {
        const current = context("x".repeat(count)); select(0, count, current);
        expect(button(current).disabled).toBe(true);
        expect(renderToStaticMarkup(view(current))).toContain("nothing has been truncated");
        expect(replay.open).not.toHaveBeenCalled();
    });
    it("allows exactly the existing 500-character limit", () => {
        const current = context("x".repeat(500)); select(0, 500, current);
        expect(button(current).disabled).toBe(false);
        expect(nodes(view(current)).find(n => n.type === "blockquote")!.props.children).toBe("x".repeat(500));
    });
    it.each([[-1, 10], [0, 99999]])("refuses a selection outside the saved work: %j", (start, end) => {
        select(start, end); expect(button().disabled).toBe(true); expect(replay.open).not.toHaveBeenCalled();
    });
    it("clears the pending quote when selection collapses", () => {
        select(0, 14); select(2, 2); expect(button().disabled).toBe(true);
        expect(nodes(view()).some(n => n.type === "blockquote")).toBe(false);
    });
    it("refuses a changed DOM source instead of treating it as saved work", () => {
        select(0, 10, context(), "Altered text");
        expect(button().disabled).toBe(true); expect(renderToStaticMarkup(view())).toContain("changed after this was prepared");
    });
    it("requires a fresh selection when the saved source or estimate revision changes", () => {
        select(0, 14); const next: PricingReviewContext = { ...context(), revision: "new-estimate-revision" };
        expect(button(next).disabled).toBe(true); expect(renderToStaticMarkup(view(next))).toContain("changed after this was prepared");
        (button(next).onClick as () => void)(); expect(replay.open).not.toHaveBeenCalled();
    });
    it("retains the selected quote while existing open work blocks draft creation", () => {
        select(0, 14); expect(button(context(), true).disabled).toBe(true);
        (button(context(), true).onClick as () => void)(); expect(replay.open).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(view(context(), true))).toContain("Finish or cancel");
        expect(nodes(view()).find(n => n.type === "blockquote")).toBeDefined();
    });
    it("shows a fresh-state parent rejection instead of claiming that a draft opened", () => {
        select(0, 14); replay.open.mockReturnValueOnce({ ok: false, error: "Existing work needs finishing" });
        (button().onClick as () => void)(); expect(renderToStaticMarkup(view())).toContain("Existing work needs finishing");
    });
    it("escapes saved wording rather than rendering it as markup", () => {
        const current = context("<script>alert(1)</script>"); select(0, current.work.length, current);
        const html = renderToStaticMarkup(view(current));
        expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
        expect(replay.open).not.toHaveBeenCalled();
    });
});
