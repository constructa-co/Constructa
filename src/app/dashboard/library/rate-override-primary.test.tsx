import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { corePrimaryButton } from "@/lib/core-editing-palette";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function iconLabel(value: unknown): string | null {
    if (!value || typeof value !== "object" || !("type" in value)) return null;
    const t = (value as Element).type;
    if (typeof t === "function") return (t as { displayName?: string; name: string }).displayName ?? t.name ?? null;
    return null;
}

function treeHasIcon(value: unknown, label: string): boolean {
    if (Array.isArray(value)) return value.some(v => treeHasIcon(v, label));
    if (!value || typeof value !== "object" || !("props" in value)) return false;
    const el = value as Element;
    if (iconLabel(el) === label) return true;
    return treeHasIcon(el.props.children, label);
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

function render(seed: Array<[number, unknown]> = []) {
    current.slots = [];
    current.cursor = 0;
    current.seed = new Map(seed);
    return nodes((RateOverrideItem as (p: { item: typeof item }) => unknown)({ item }));
}

function mergedButtonClasses(el: Element): string {
    return cn(
        buttonVariants({
            variant: el.props.variant as "default" | "ghost" | undefined,
            size: el.props.size as "sm" | undefined,
            className: el.props.className as string,
        }),
    );
}

/** Save in editing mode: Check icon, explicit disabled={saving}, not cancel/reset. */
function saveCheckButton(els: Element[]): Element {
    const save = els.filter(
        el =>
            el.props.type === "button" &&
            el.props.size === "sm" &&
            el.props.disabled !== undefined &&
            typeof el.props.onClick === "function" &&
            treeHasIcon(el, "Check"),
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
            const els = render([
                [0, true],
                [1, "42.5"],
                [2, saving],
            ]);
            const save = saveCheckButton(els);
            const merged = mergedButtonClasses(save);

            expect(merged).toContain("h-7");
            expect(merged).toContain("px-2");
            expect(merged).toContain("bg-[#c9efcf]");
            expect(merged).toContain("hover:bg-[#e0f9e3]");
            expect(merged).toContain("text-[#182c1b]");
            expect(merged).not.toMatch(/bg-blue-600|hover:bg-blue-700|text-white/);
            expect(save.props.disabled).toBe(saving);
            expect(typeof save.props.onClick).toBe("function");
        },
    );

    it("cancel and reset controls keep existing neutral classes (not primary Save)", () => {
        const editingEls = render([
            [0, true],
            [1, "42.5"],
            [2, false],
        ]);
        const cancel = editingEls.filter(
            el =>
                el.props.variant === "ghost" &&
                el.props.size === "sm" &&
                treeHasIcon(el, "X") &&
                typeof el.props.onClick === "function",
        );
        expect(cancel).toHaveLength(1);
        expect(cancel[0]!.props.className).toBe("h-7 px-2 text-slate-400 hover:text-white");

        const idleEls = render([[0, false], [1, "35"], [2, false]]);
        const reset = idleEls.filter(
            el =>
                el.props.variant === "ghost" &&
                el.props.size === "sm" &&
                treeHasIcon(el, "RotateCcw") &&
                typeof el.props.onClick === "function",
        );
        expect(reset).toHaveLength(1);
        expect(reset[0]!.props.className).toBe("h-7 px-2 text-slate-500 hover:text-slate-300 hover:bg-slate-700");
    });

    it("Save className template uses corePrimaryButton verbatim", () => {
        expect(corePrimaryButton).toBe("bg-[#c9efcf] hover:bg-[#e0f9e3] text-[#182c1b]");
        const save = saveCheckButton(render([[0, true], [1, "35"], [2, false]]));
        expect(save.props.className).toBe(`h-7 px-2 ${corePrimaryButton}`);
    });
});

