import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
    slots: [] as unknown[],
    refs: [] as Array<{ current: unknown }>,
    cursor: 0,
    refCursor: 0,
    seed: new Map<number, unknown>(),
    selectValue: "",
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = hook.cursor++;
        if (!(i in hook.slots)) {
            hook.slots[i] = hook.seed.has(i) ? hook.seed.get(i) : typeof initial === "function" ? (initial as () => unknown)() : initial;
        }
        return [
            hook.slots[i],
            (next: unknown) => {
                hook.slots[i] = typeof next === "function" ? (next as (v: unknown) => unknown)(hook.slots[i]) : next;
            },
        ];
    },
    useRef: (initial: unknown) => {
        const i = hook.refCursor++;
        if (!(i in hook.refs)) hook.refs[i] = { current: initial };
        return hook.refs[i];
    },
    useEffect: () => {},
}));

vi.mock("@/components/ui/card", () => ({
    Card: ({ children }: { children: ReactNode }) => createElement("div", { "data-card": true }, children),
    CardHeader: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    CardTitle: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    CardDescription: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    CardContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("@/components/ui/button", () => ({
    Button: ({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) =>
        createElement("button", { type: "button", onClick, disabled }, children),
}));
vi.mock("@/components/ui/input", () => ({
    Input: (props: Record<string, unknown>) => createElement("input", props),
}));
vi.mock("@/components/ui/label", () => ({
    Label: ({ children }: { children: ReactNode }) => createElement("label", null, children),
}));
vi.mock("@/components/ui/select", () => ({
    Select: ({ children, value }: { children: ReactNode; value: string }) => {
        hook.selectValue = value;
        return createElement("div", { className: "mock-select-root" }, children);
    },
    SelectTrigger: ({ children }: { children: ReactNode }) => createElement("button", { type: "button" }, children),
    SelectValue: ({ placeholder, children }: { placeholder?: string; children?: ReactNode }) =>
        createElement("span", { "data-select-trigger-label": true }, children ?? placeholder),
    SelectContent: ({ children }: { children: ReactNode }) => createElement("div", { "data-select-content": true }, children),
    SelectItem: ({ children, value }: { children: ReactNode; value: string }) =>
        createElement("div", { role: "option", "data-item-value": value }, children),
    SelectGroup: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    SelectLabel: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("lucide-react", () => ({ Plus: () => null, Search: () => null }));
vi.mock("../../templates-actions", () => ({
    addItemsToTemplateAction: vi.fn(async () => {}),
}));

import TemplateItemEditor from "./template-item-editor";
import { addItemsToTemplateAction } from "../../templates-actions";
import { SelectItem } from "@/components/ui/select";

type Element = ReactElement<Record<string, unknown>>;

const libraryItems = [
    { id: "item-a", category: "Masonry", description: "Brick wall panel", unit: "m2", unit_cost: 12 },
    { id: "item-b", category: "Electrical", description: "Cable run", unit: "m", unit_cost: 4 },
    { id: "item-c", category: "MASONRY", description: "Block infill course", unit: "nr", unit_cost: 6 },
];

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element;
    return [e, ...nodes(e.props.children)];
}

function renderEditor(seed: Map<number, unknown> = new Map()) {
    hook.slots = [];
    hook.cursor = 0;
    hook.refCursor = 0;
    hook.seed = seed;
    const props = { templateId: "tpl-1", libraryItems };
    const rendered = TemplateItemEditor(props);
    return { markup: renderToStaticMarkup(rendered), tree: nodes(rendered) };
}

const DESCRIPTIONS = ["Brick wall panel", "Cable run", "Block infill course"] as const;

function optionDescriptionNodes(tree: Element[]) {
    return tree.filter(e => e.type === SelectItem);
}

function descriptionFromOptionRow(option: Element) {
    const descSpan = nodes(option).find(
        e => e.type === "span" && e.props.className === "font-medium",
    );
    return descSpan?.props.children as string | undefined;
}

function visibleDescriptions(tree: Element[]) {
    const listed = optionDescriptionNodes(tree)
        .map(descriptionFromOptionRow)
        .filter((description): description is string => typeof description === "string");
    const listedSet = new Set(listed);
    return DESCRIPTIONS.filter(description => listedSet.has(description));
}

function addButton(tree: Element[]) {
    const clickable = tree.filter(e => typeof e.props.onClick === "function");
    return clickable[clickable.length - 1]!;
}

function selectedId() {
    return hook.selectValue;
}

function selectedTriggerDescription(tree: Element[]) {
    const selectValue = tree.find(e => e.props.placeholder === "Search library...");
    if (!selectValue) return undefined;
    const descSpan = nodes(selectValue).find(
        e => e.type === "span" && e.props.className === "font-medium",
    );
    return descSpan?.props.children as string | undefined;
}

function filterInput(tree: Element[]) {
    return tree.find(e => e.type === "input" && e.props.name === "library-kit-filter")!;
}

function dispatchFilterKey(input: Element, key: string, extra: Record<string, unknown> = {}) {
    const stop = vi.fn();
    (input.props.onKeyDown as (ev: Record<string, unknown>) => void)({
        key,
        stopPropagation: stop,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        nativeEvent: { isComposing: false },
        ...extra,
    });
    return stop;
}

function setFilter(tree: Element[], value: string) {
    const input = filterInput(tree);
    (input.props.onChange as (ev: { target: { value: string } }) => void)({ target: { value } });
}

beforeEach(() => {
    hook.slots = [];
    hook.refs = [];
    hook.cursor = 0;
    hook.refCursor = 0;
    hook.seed = new Map();
    hook.selectValue = "";
    vi.mocked(addItemsToTemplateAction).mockClear();
});

describe("TemplateItemEditor kit library filter (ROB1142)", () => {
    it("lists all library rows before any filter query", () => {
        const { tree } = renderEditor();
        expect(visibleDescriptions(tree)).toEqual([...DESCRIPTIONS]);
    });

    it("narrows visible rows by description or category case-insensitively", () => {
        const { tree: initial } = renderEditor();
        setFilter(initial, "brick");
        hook.cursor = 0;
        const { tree: narrowed } = renderEditor(new Map(hook.slots.map((v, i) => [i, v])));
        expect(visibleDescriptions(narrowed)).toEqual(["Brick wall panel"]);

        hook.slots = [];
        hook.cursor = 0;
        const { tree: cat } = renderEditor();
        setFilter(cat, "mason");
        const seeded = new Map(hook.slots.map((v, i) => [i, v]));
        hook.cursor = 0;
        const { tree: masonry } = renderEditor(seeded);
        expect(visibleDescriptions(masonry)).toEqual(["Brick wall panel", "Block infill course"]);
    });

    it("shows a no-match state and restores full order when the query is cleared", () => {
        const { tree } = renderEditor();
        setFilter(tree, "   ");
        hook.cursor = 0;
        expect(visibleDescriptions(renderEditor(new Map(hook.slots.map((v, i) => [i, v]))).tree)).toEqual([...DESCRIPTIONS]);

        hook.slots = [];
        hook.cursor = 0;
        const { tree: t2 } = renderEditor();
        setFilter(t2, "not-found-xyz");
        hook.cursor = 0;
        const none = renderEditor(new Map(hook.slots.map((v, i) => [i, v])));
        expect(visibleDescriptions(none.tree)).toEqual([]);
        expect(none.markup).toMatch(/No matching library items/i);

        const heldSelection = renderEditor(new Map<number, unknown>([[0, "item-b"], [1, 1], [2, false], [3, "brick"]]));
        expect(visibleDescriptions(heldSelection.tree)).toEqual(["Brick wall panel"]);
        expect(selectedId()).toBe("item-b");
        expect(selectedTriggerDescription(heldSelection.tree)).toBe("Cable run");
        expect(heldSelection.markup.includes("Cable run")).toBe(true);

        const heldNoMatch = renderEditor(new Map<number, unknown>([[0, "item-b"], [1, 1], [2, false], [3, "not-found-xyz"]]));
        expect(visibleDescriptions(heldNoMatch.tree)).toEqual([]);
        expect(selectedId()).toBe("item-b");
        expect(selectedTriggerDescription(heldNoMatch.tree)).toBe("Cable run");

        const cleared = renderEditor(new Map<number, unknown>([[0, "item-b"], [1, 1], [2, false], [3, ""]]));
        expect(visibleDescriptions(cleared.tree)).toEqual([...DESCRIPTIONS]);
        expect(selectedId()).toBe("item-b");
        expect(selectedTriggerDescription(cleared.tree)).toBe("Cable run");
    });

    it("Add uses the canonical library item payload even when the list was filtered", async () => {
        const { tree } = renderEditor(new Map<number, unknown>([[0, "item-b"], [1, 2.5], [2, false], [3, "cable"]]));
        const add = addButton(tree);
        await (add.props.onClick as () => Promise<void>)();
        expect(addItemsToTemplateAction).toHaveBeenCalledWith("tpl-1", [{
            category: "Electrical",
            description: "Cable run",
            unit: "m",
            unit_cost: 4,
            quantity: 2.5,
        }]);
    });

    it("keeps keyboard events on the filter input from bubbling to the select", () => {
        const { tree } = renderEditor();
        const input = filterInput(tree);
        expect(dispatchFilterKey(input, " ")).toHaveBeenCalled();
        expect(dispatchFilterKey(input, "b")).toHaveBeenCalled();
        expect(dispatchFilterKey(input, "Backspace")).toHaveBeenCalled();
    });

    it("lets select navigation and control keys bubble from the filter input", () => {
        const { tree } = renderEditor();
        const input = filterInput(tree);
        for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Escape", "Tab", "Enter"] as const) {
            expect(dispatchFilterKey(input, key)).not.toHaveBeenCalled();
        }
    });

    it("stops propagation for IME composition and modified navigation on the filter input", () => {
        const { tree } = renderEditor();
        const input = filterInput(tree);
        expect(dispatchFilterKey(input, "b", { nativeEvent: { isComposing: true } })).toHaveBeenCalled();
        expect(dispatchFilterKey(input, "Home", { ctrlKey: true })).toHaveBeenCalled();
        expect(dispatchFilterKey(input, "ArrowDown")).not.toHaveBeenCalled();
    });
});
