import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, X } from "lucide-react";
import { corePrimaryButton } from "@/lib/core-editing-palette";

const current = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    seed: new Map<number, unknown>(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = current.cursor++;
        if (!(i in current.slots)) {
            current.slots[i] = current.seed.has(i)
                ? current.seed.get(i)
                : typeof initial === "function"
                  ? (initial as () => unknown)()
                  : initial;
        }
        return [
            current.slots[i],
            (next: unknown) => {
                current.slots[i] =
                    typeof next === "function" ? (next as (v: unknown) => unknown)(current.slots[i]) : next;
            },
        ];
    },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("./actions", () => ({
    upsertRateOverrideAction: vi.fn(),
    deleteRateOverrideAction: vi.fn(),
}));

import RateOverrideItem from "./rate-override-client";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...nodes(el.props.children)];
}

function treeHasIcon(value: unknown, Icon: typeof Check | typeof X | typeof RotateCcw): boolean {
    if (Array.isArray(value)) return value.some(v => treeHasIcon(v, Icon));
    if (!value || typeof value !== "object" || !("props" in value)) return false;
    const el = value as Element;
    if (el.type === Icon) return true;
    return treeHasIcon(el.props.children, Icon);
}

// useState slots: 0 editing, 1 rateInput, 2 saving.
const item = {
    id: "item-7",
    code: "GW-01",
    description: "Excavate trench",
    unit: "m3",
    base_rate: 30,
    is_featured: false,
    override: { custom_rate: 35 },
};

function splitButtons(html: string): string[] {
    const blocks: string[] = [];
    let i = 0;
    while (i < html.length) {
        const start = html.indexOf("<button", i);
        if (start === -1) break;
        const end = html.indexOf("</button>", start);
        if (end === -1) break;
        blocks.push(html.slice(start, end + "</button>".length));
        i = end + "</button>".length;
    }
    return blocks;
}

function buttonOpenTag(buttonHtml: string): string {
    const end = buttonHtml.indexOf(">");
    return end === -1 ? buttonHtml : buttonHtml.slice(0, end + 1);
}

function buttonClassName(buttonHtml: string): string {
    const m = buttonOpenTag(buttonHtml).match(/\bclass="([^"]*)"/);
    return m?.[1] ?? "";
}

function buttonHasDisabled(buttonHtml: string): boolean {
    const open = buttonOpenTag(buttonHtml);
    return /\bdisabled(?:="")?(?=\s|>)/.test(open);
}

function seedRender(seed: Array<[number, unknown]> = []) {
    current.slots = [];
    current.cursor = 0;
    current.seed = new Map(seed);
}

function renderRaw(seed: Array<[number, unknown]> = []) {
    seedRender(seed);
    return nodes((RateOverrideItem as (p: { item: typeof item }) => unknown)({ item }));
}

function renderSsr(seed: Array<[number, unknown]> = []) {
    seedRender(seed);
    return renderToStaticMarkup(createElement(RateOverrideItem, { item }));
}

/** SSR Save: unique lucide-check control, explicit type=button. */
function saveCheckButtonSsr(html: string): string {
    const save = splitButtons(html).filter(block => block.includes("lucide-check"));
    expect(save).toHaveLength(1);
    expect(buttonOpenTag(save[0]!)).toMatch(/\btype="button"/);
    return save[0]!;
}

/** Raw Save: actual Button + Check, explicit disabled={saving}, not cancel/reset. */
function saveCheckButtonRaw(els: Element[]): Element {
    const save = els.filter(
        el =>
            el.type === Button &&
            el.props.type === "button" &&
            el.props.size === "sm" &&
            el.props.disabled !== undefined &&
            typeof el.props.onClick === "function" &&
            treeHasIcon(el, Check),
    );
    expect(save).toHaveLength(1);
    return save[0]!;
}

beforeEach(() => {
    current.slots = [];
    current.cursor = 0;
    current.seed = new Map();
});

describe("RateOverrideItem editing Save primary palette", () => {
    it.each([false, true] as const)(
        "merged Save (Check) classes use core sage palette; h-7 px-2 and disabled=%s preserved",
        saving => {
            const els = renderRaw([
                [0, true],
                [1, "42.5"],
                [2, saving],
            ]);
            const saveRaw = saveCheckButtonRaw(els);
            expect(saveRaw.props.disabled).toBe(saving);
            expect(typeof saveRaw.props.onClick).toBe("function");

            const html = renderSsr([
                [0, true],
                [1, "42.5"],
                [2, saving],
            ]);
            const save = saveCheckButtonSsr(html);
            const merged = buttonClassName(save);

            expect(merged).toContain("h-7");
            expect(merged).toContain("px-2");
            expect(merged).toContain("bg-[#c9efcf]");
            expect(merged).toContain("hover:bg-[#e0f9e3]");
            expect(merged).toContain("text-[#182c1b]");
            expect(merged).not.toMatch(/bg-blue-600|hover:bg-blue-700|text-white/);
            expect(buttonHasDisabled(save)).toBe(saving);
        },
    );

    it("cancel and reset controls keep existing neutral classes (not primary Save)", () => {
        const editingEls = renderRaw([
            [0, true],
            [1, "42.5"],
            [2, false],
        ]);
        const cancelRaw = editingEls.filter(
            el =>
                el.type === Button &&
                el.props.variant === "ghost" &&
                el.props.size === "sm" &&
                treeHasIcon(el, X) &&
                typeof el.props.onClick === "function",
        );
        expect(cancelRaw).toHaveLength(1);
        expect(cancelRaw[0]!.props.className).toBe("h-7 px-2 text-slate-400 hover:text-white");

        const idleEls = renderRaw([[0, false], [1, "35"], [2, false]]);
        const resetRaw = idleEls.filter(
            el =>
                el.type === Button &&
                el.props.variant === "ghost" &&
                el.props.size === "sm" &&
                treeHasIcon(el, RotateCcw) &&
                typeof el.props.onClick === "function",
        );
        expect(resetRaw).toHaveLength(1);
        expect(resetRaw[0]!.props.className).toBe(
            "h-7 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700",
        );

        const editingHtml = renderSsr([
            [0, true],
            [1, "42.5"],
            [2, false],
        ]);
        const cancel = splitButtons(editingHtml).filter(
            block => block.includes("lucide-x") && block.includes("text-slate-400"),
        );
        expect(cancel).toHaveLength(1);
        const cancelClass = buttonClassName(cancel[0]!);
        expect(cancelClass).toContain("h-7");
        expect(cancelClass).toContain("px-2");
        expect(cancelClass).toContain("text-slate-400");
        expect(cancelClass).toContain("hover:text-white");
        expect(cancelClass).not.toContain("bg-[#c9efcf]");

        const idleHtml = renderSsr([[0, false], [1, "35"], [2, false]]);
        const reset = splitButtons(idleHtml).filter(
            block => block.includes("lucide-rotate-ccw") && block.includes("text-slate-500"),
        );
        expect(reset).toHaveLength(1);
        const resetClass = buttonClassName(reset[0]!);
        expect(resetClass).toContain("h-7");
        expect(resetClass).toContain("px-2");
        expect(resetClass).toContain("text-slate-500");
        expect(resetClass).toContain("hover:text-slate-300");
        expect(resetClass).toContain("hover:bg-slate-700");
        expect(resetClass).not.toContain("bg-[#c9efcf]");
    });

    it("Save className template uses corePrimaryButton verbatim", () => {
        expect(corePrimaryButton).toBe("bg-[#c9efcf] hover:bg-[#e0f9e3] text-[#182c1b]");
        const saveRaw = saveCheckButtonRaw(renderRaw([[0, true], [1, "35"], [2, false]]));
        expect(saveRaw.props.className).toBe(`h-7 px-2 ${corePrimaryButton}`);

        const save = saveCheckButtonSsr(renderSsr([[0, true], [1, "35"], [2, false]]));
        const merged = buttonClassName(save);
        expect(merged).toContain("h-7");
        expect(merged).toContain("px-2");
        for (const token of corePrimaryButton.split(/\s+/)) {
            expect(merged).toContain(token);
        }
    });
});

