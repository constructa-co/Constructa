import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { buildPricingReviewContext } from "@/lib/pricing-review";
import { MAX_SCOPE_LENGTH } from "@/lib/guided-brief";
import { workspaceStyles } from "@/lib/workspace-styles";

const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, open: vi.fn(), work: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = replay.cursor++;
        if (!(index in replay.slots)) replay.slots[index] = initial;
        return [replay.slots[index], (value: unknown) => { replay.slots[index] = value; }];
    },
    useRef: (initial: unknown) => {
        const index = replay.cursor++;
        if (!(index in replay.slots)) replay.slots[index] = { current: initial };
        return replay.slots[index];
    },
}));
import PriceWorkList, { reviewWorkDescriptionList } from "./price-work-list";
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function view(blocked = false) {
    replay.cursor = 0;
    const context = buildPricingReviewContext({ id: "job", brief_scope: "Saved work" }, null);
    if (!context.ok) throw Error(context.error);
    return PriceWorkList({ context: { ...context.value, existingWork: [{ description: "Paint walls", section: "General" }] }, blocked,
        blockedHelp: "Finish or cancel the open work.", styles: workspaceStyles(false), onOpen: replay.open, onWorkChange: replay.work });
}
function click(name: string, blocked = false) {
    const button = nodes(view(blocked)).find(n => n.type === "button" && n.props.children === name)!;
    (button.props.onClick as () => void)();
}
function type(value: string) {
    (nodes(view()).find(n => n.type === "textarea")!.props.onChange as (event: unknown) => void)({ currentTarget: { value } });
}
beforeEach(() => { replay.slots = []; replay.cursor = 0; replay.open.mockReset().mockReturnValue({ ok: true }); replay.work.mockReset(); });

describe("plain work-description review", () => {
    it("keeps CRLF, CR and LF offsets exact, preserves duplicates and ignores blank rows", () => {
        const source = "\r\n Paint walls \rFit doors\n\nPaint walls";
        const result = reviewWorkDescriptionList(source);
        expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
        expect(result.items.map(range => source.slice(range.start, range.end))).toEqual([" Paint walls ", "Fit doors", "Paint walls"]);
    });
    it.each(["", "\n \n", "Paint\t10\t20", "Bad\u0000work", "x".repeat(501), "x".repeat(MAX_SCOPE_LENGTH + 1)])("refuses invalid input without truncation: %s", source => {
        expect(reviewWorkDescriptionList(source).ok).toBe(false);
    });
    it("allows 500 characters and does not infer rates, numbered headings, negatives or activities", () => {
        const result = reviewWorkDescriptionList("x".repeat(500) + "\n1. Exclude beams £200 10m2\nNot a section");
        expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
        expect(result.items).toHaveLength(3);
    });
    it("starts closed and labelled, with no calls; typing and review do not open or save", () => {
        expect(view().props.open).toBeUndefined();
        const tree = nodes(view());
        expect(tree.find(n => n.type === "label")!.props.htmlFor).toBe(tree.find(n => n.type === "textarea")!.props.id);
        type("Paint walls\nFit doors, excluding frames"); click("Review descriptions");
        expect(nodes(view()).filter(n => n.type === "li")).toHaveLength(2);
        expect(replay.open).not.toHaveBeenCalled(); expect(replay.work).toHaveBeenLastCalledWith(true);
        expect(nodes(view()).filter(n => n.type === "button").every(n => n.props.type === "button")).toBe(true);
    });
    it("opens only the explicitly chosen source and warns about identical saved wording", () => {
        type("Paint walls\nFit doors, excluding frames"); click("Review descriptions");
        const html = renderToStaticMarkup(view()); expect(html).toContain("Identical wording is already");
        const button = nodes(view()).find(n => n.props["aria-label"] === "Open description 2 as an unpriced draft")!;
        (button.props.onClick as () => void)();
        expect(replay.open).toHaveBeenCalledExactlyOnceWith("Paint walls\nFit doors, excluding frames", { start: 12, end: 39 }, expect.any(String));
        expect(renderToStaticMarkup(view())).toContain("not saved");
    });
    it("retains the list through blocked work and parent refusal without false save confirmation", () => {
        type("Fit doors"); click("Review descriptions");
        const blocked = nodes(view(true)).find(n => n.props["aria-label"] === "Open description 1 as an unpriced draft")!;
        expect(blocked.props.disabled).toBe(true); (blocked.props.onClick as () => void)(); expect(replay.open).not.toHaveBeenCalled();
        replay.open.mockReturnValueOnce({ ok: false, error: "Estimate changed; review again" });
        click("Open unpriced draft"); expect(renderToStaticMarkup(view())).toContain("Estimate changed; review again");
        expect(nodes(view()).find(n => n.type === "textarea")!.props.value).toBe("Fit doors");
    });
    it("editing or clearing invalidates even an old click handler without discarding a price draft", () => {
        type("Fit doors"); click("Review descriptions");
        const old = nodes(view()).find(n => n.props["aria-label"] === "Open description 1 as an unpriced draft")!;
        type("New work"); (old.props.onClick as () => void)(); expect(replay.open).not.toHaveBeenCalled();
        click("Review descriptions"); click("Clear list"); (old.props.onClick as () => void)();
        expect(replay.work).toHaveBeenLastCalledWith(false); expect(replay.open).not.toHaveBeenCalled();
        expect(nodes(view()).some(n => n.type === "li")).toBe(false);
    });
    it("escapes markup, preserves qualifiers and previews existing description whitespace normalization", () => {
        type("<script>bad()</script>\nPaint  walls, excluding  beams"); click("Review descriptions");
        const html = renderToStaticMarkup(view()); expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;"); expect(html).toContain("Paint walls, excluding beams");
        expect(replay.open).not.toHaveBeenCalled();
    });
});
