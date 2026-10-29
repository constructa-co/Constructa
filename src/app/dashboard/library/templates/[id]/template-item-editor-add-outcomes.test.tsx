import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
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
    useEffect: () => {},
}));

vi.mock("@/components/ui/card", () => ({
    Card: ({ children }: { children: ReactNode }) => createElement("div", null, children),
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
        return createElement("div", null, children);
    },
    SelectTrigger: ({ children }: { children: ReactNode }) => createElement("button", { type: "button" }, children),
    SelectValue: ({ placeholder }: { placeholder: string }) => createElement("span", null, placeholder),
    SelectContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    SelectItem: ({ children }: { children: ReactNode; value: string }) =>
        createElement("div", { role: "option" }, children),
    SelectGroup: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    SelectLabel: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("lucide-react", () => ({ Plus: () => null, Search: () => null }));
vi.mock("../../templates-actions", () => ({
    addItemsToTemplateAction: vi.fn(async () => {}),
}));

import TemplateItemEditor from "./template-item-editor";
import { addItemsToTemplateAction } from "../../templates-actions";

type Element = ReactElement<Record<string, unknown>>;

const libraryItems = [
    { id: "item-b", category: "Electrical", description: "Cable run", unit: "m", unit_cost: 4 },
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
    hook.seed = seed;
    const rendered = TemplateItemEditor({ templateId: "tpl-1", libraryItems });
    return { markup: renderToStaticMarkup(rendered), tree: nodes(rendered), rendered };
}

function addButton(tree: Element[]) {
    const clickable = tree.filter(e => typeof e.props.onClick === "function");
    return clickable[clickable.length - 1]!;
}

function slot(i: number) {
    return hook.slots[i];
}

async function clickAdd(tree: Element[]) {
    await (addButton(tree).props.onClick as () => Promise<void>)();
}

beforeEach(() => {
    hook.slots = [];
    hook.cursor = 0;
    hook.seed = new Map();
    hook.selectValue = "";
    vi.mocked(addItemsToTemplateAction).mockClear();
    vi.mocked(addItemsToTemplateAction).mockResolvedValue(undefined);
});

describe("TemplateItemEditor Add to Kit outcomes (ROB1217)", () => {
    it("shows an accessible failure outcome when the add action throws", async () => {
        vi.mocked(addItemsToTemplateAction).mockRejectedValueOnce(new Error("revalidate failed"));
        const seed = new Map<number, unknown>([[0, "item-b"], [1, 2.5], [2, false], [3, "cable"], [4, null]]);
        const { tree } = renderEditor(seed);
        await clickAdd(tree);
        hook.cursor = 0;
        const after = renderEditor(new Map(hook.slots.map((v, i) => [i, v])));
        expect(after.markup).toMatch(/role="alert"/);
        expect(after.markup).toMatch(/check the kit list/i);
        expect(after.markup).toMatch(/revalidate failed/);
    });

    it("retains choice and quantity, clears pending, and does not auto-retry when add fails", async () => {
        vi.mocked(addItemsToTemplateAction).mockRejectedValueOnce(new Error("db down"));
        const { tree } = renderEditor(new Map<number, unknown>([[0, "item-b"], [1, 3], [2, false], [3, ""], [4, null]]));
        await clickAdd(tree);
        expect(addItemsToTemplateAction).toHaveBeenCalledTimes(1);
        expect(slot(0)).toBe("item-b");
        expect(slot(1)).toBe(3);
        expect(slot(2)).toBe(false);
        expect(slot(4)).toBeTruthy();
    });

    it("clears selection and resets quantity only after confirmed successful add", async () => {
        const { tree } = renderEditor(new Map<number, unknown>([[0, "item-b"], [1, 2.5], [2, false], [3, ""], [4, null]]));
        await clickAdd(tree);
        expect(addItemsToTemplateAction).toHaveBeenCalledWith("tpl-1", [{
            category: "Electrical", description: "Cable run", unit: "m", unit_cost: 4, quantity: 2.5,
        }]);
        expect(slot(0)).toBe("");
        expect(slot(1)).toBe(1);
        expect(slot(4)).toBeNull();
    });

    it("does not call the action without a selected item or when the selected id is unknown", async () => {
        const { tree: empty } = renderEditor(new Map<number, unknown>([[0, ""], [1, 1], [2, false], [3, ""], [4, null]]));
        await clickAdd(empty);
        expect(addItemsToTemplateAction).not.toHaveBeenCalled();

        hook.slots = [];
        hook.cursor = 0;
        const { tree: ghost } = renderEditor(new Map<number, unknown>([[0, "missing-id"], [1, 1], [2, false], [3, ""], [4, null]]));
        await clickAdd(ghost);
        expect(addItemsToTemplateAction).not.toHaveBeenCalled();
        expect(slot(2)).toBe(false);
        expect(String(slot(4))).toMatch(/no longer available/i);
    });

    it("clears a stale error at the start of a new add attempt", async () => {
        vi.mocked(addItemsToTemplateAction)
            .mockRejectedValueOnce(new Error("first fail"))
            .mockResolvedValueOnce(undefined);
        const { tree: first } = renderEditor(new Map<number, unknown>([[0, "item-b"], [1, 1], [2, false], [3, ""], [4, null]]));
        await clickAdd(first);
        expect(slot(4)).toBeTruthy();
        hook.cursor = 0;
        const { tree: second } = renderEditor(new Map(hook.slots.map((v, i) => [i, v])));
        await clickAdd(second);
        hook.cursor = 0;
        const done = renderEditor(new Map(hook.slots.map((v, i) => [i, v])));
        expect(done.markup).not.toMatch(/role="alert"/);
        expect(slot(0)).toBe("");
    });
});
