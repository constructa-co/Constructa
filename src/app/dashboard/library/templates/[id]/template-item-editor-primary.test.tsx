import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { corePrimaryButton } from "@/lib/core-editing-palette";

const hook = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    seed: new Map<number, unknown>(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = hook.cursor++;
        if (!(i in hook.slots)) {
            hook.slots[i] = hook.seed.has(i)
                ? hook.seed.get(i)
                : typeof initial === "function"
                  ? (initial as () => unknown)()
                  : initial;
        }
        return [
            hook.slots[i],
            (next: unknown) => {
                hook.slots[i] =
                    typeof next === "function" ? (next as (v: unknown) => unknown)(hook.slots[i]) : next;
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
vi.mock("@/components/ui/input", () => ({
    Input: (props: Record<string, unknown>) => createElement("input", props),
}));
vi.mock("@/components/ui/label", () => ({
    Label: ({ children }: { children: ReactNode }) => createElement("label", null, children),
}));
vi.mock("@/components/ui/select", () => ({
    Select: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    SelectTrigger: ({ children }: { children: ReactNode }) => createElement("button", { type: "button" }, children),
    SelectValue: ({ placeholder }: { placeholder: string }) => createElement("span", null, placeholder),
    SelectContent: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    SelectItem: ({ children }: { children: ReactNode }) => createElement("div", { role: "option" }, children),
    SelectGroup: ({ children }: { children: ReactNode }) => createElement("div", null, children),
    SelectLabel: ({ children }: { children: ReactNode }) => createElement("div", null, children),
}));
vi.mock("lucide-react", () => ({ Plus: () => null, Search: () => null }));
vi.mock("../../templates-actions", () => ({
    addItemsToTemplateAction: vi.fn(async () => {}),
}));

import TemplateItemEditor from "./template-item-editor";

const libraryItems = [
    { id: "item-b", category: "Electrical", description: "Cable run", unit: "m", unit_cost: 4 },
];

function renderMarkup(seed: Map<number, unknown> = new Map()) {
    hook.slots = [];
    hook.cursor = 0;
    hook.seed = seed;
    return renderToStaticMarkup(
        createElement(TemplateItemEditor, { templateId: "tpl-1", libraryItems }),
    );
}

function addToKitButtonOpenTag(html: string) {
    const buttonBlockRegex = /<button[^>]*>[\s\S]*?<\/button>/g;
    let addToKitBlock: string | undefined;
    for (const match of html.matchAll(buttonBlockRegex)) {
        if (match[0].includes("Add to Kit")) {
            addToKitBlock = match[0];
            break;
        }
    }
    expect(addToKitBlock, "Add to Kit button").toBeTruthy();
    return addToKitBlock!.match(/^<button[^>]*>/)![0];
}

beforeEach(() => {
    hook.slots = [];
    hook.cursor = 0;
    hook.seed = new Map();
});

describe("TemplateItemEditor Add to Kit primary palette (A001 kit)", () => {
    it("uses approved sage/charcoal primary on Add to Kit via real Button class merge", () => {
        const html = renderMarkup();
        const open = addToKitButtonOpenTag(html);

        expect(open).toMatch(/\sdisabled(?:=|\s|>)/);
        expect(open).toContain("w-full");
        expect(open).toContain("mt-4");
        expect(open).toContain("font-bold");
        expect(open).toContain("h-11");
        expect(open).toContain("bg-[#c9efcf]");
        expect(open).toContain("hover:bg-[#e0f9e3]");
        expect(open).toContain("text-[#182c1b]");
        expect(open).not.toMatch(/bg-blue-600|hover:bg-blue-700|text-white/);
        expect(corePrimaryButton).toContain("#c9efcf");
        expect(corePrimaryButton).toContain("#182c1b");
    });

    it("keeps the same primary classes when Add to Kit is enabled", () => {
        const seed = new Map<number, unknown>([[0, "item-b"], [1, 1], [2, false], [3, ""], [4, null]]);
        const open = addToKitButtonOpenTag(renderMarkup(seed));

        expect(open).not.toMatch(/\sdisabled(?:=|\s|>)/);
        expect(open).toContain("w-full");
        expect(open).toContain("font-bold");
        expect(open).toContain("h-11");
        expect(open).toContain("bg-[#c9efcf]");
        expect(open).toContain("text-[#182c1b]");
    });
});

