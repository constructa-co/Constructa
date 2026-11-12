import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { toast } from "sonner";
import RateOverrideItem from "./rate-override-client";
import { deleteRateOverrideAction, upsertRateOverrideAction } from "./actions";

type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...nodes(el.props.children)];
}

// useState slots: 0 editing, 1 rateInput, 2 saving.
const item = {
    id: "item-7", code: "GW-01", description: "Excavate trench", unit: "m3", base_rate: 30, is_featured: false,
    override: { custom_rate: 35 },
};

function render(seed: Array<[number, unknown]> = []) {
    current.slots = [];
    current.cursor = 0;
    current.seed = new Map(seed);
    return nodes((RateOverrideItem as (p: { item: typeof item }) => unknown)({ item }));
}

const saveButton = (els: Element[]) => els.find(e => e.props.disabled !== undefined && typeof e.props.onClick === "function")!;
const resetButton = (els: Element[]) => els.filter(e => typeof e.props.onClick === "function").at(-1)!;
const state = () => ({ editing: current.slots[0], rateInput: current.slots[1], saving: current.slots[2] });

beforeEach(() => {
    vi.mocked(upsertRateOverrideAction).mockReset();
    vi.mocked(deleteRateOverrideAction).mockReset();
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
});

describe("RateOverrideItem Save outcomes", () => {
    it("a thrown Save settles pending, keeps the entry and editor, shows no success and does not retry", async () => {
        vi.mocked(upsertRateOverrideAction).mockRejectedValue(new Error("network lost"));
        const els = render([[0, true], [1, "42.5"]]);
        await expect((saveButton(els).props.onClick as () => Promise<void>)()).resolves.toBeUndefined();
        expect(state()).toEqual({ editing: true, rateInput: "42.5", saving: false });
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(String(vi.mocked(toast.error).mock.calls[0][0])).toMatch(/couldn.t confirm/i);
        expect(upsertRateOverrideAction).toHaveBeenCalledTimes(1);
        const sent = vi.mocked(upsertRateOverrideAction).mock.calls[0][0] as FormData;
        expect([...sent.entries()]).toEqual([["mom_item_id", "item-7"], ["custom_rate", "42.5"]]);
    });

    it("an explicit refusal keeps the editor and entry and shows the server message (unchanged)", async () => {
        vi.mocked(upsertRateOverrideAction).mockResolvedValue({ error: "Invalid rate value." });
        const els = render([[0, true], [1, "-1"]]);
        await (saveButton(els).props.onClick as () => Promise<void>)();
        expect(state()).toEqual({ editing: true, rateInput: "-1", saving: false });
        expect(toast.error).toHaveBeenCalledWith("Invalid rate value.");
        expect(toast.success).not.toHaveBeenCalled();
    });

    it("a confirmed Save still closes the editor with the existing success message (unchanged)", async () => {
        vi.mocked(upsertRateOverrideAction).mockResolvedValue({ success: true });
        const els = render([[0, true], [1, "42.5"]]);
        await (saveButton(els).props.onClick as () => Promise<void>)();
        expect(state()).toEqual({ editing: false, rateInput: "42.5", saving: false });
        expect(toast.success).toHaveBeenCalledWith("Rate updated");
        expect(toast.error).not.toHaveBeenCalled();
    });
});

describe("RateOverrideItem Reset outcomes", () => {
    it("a thrown Reset shows no false success and keeps the current entry", async () => {
        vi.mocked(deleteRateOverrideAction).mockRejectedValue(new Error("revalidate failed"));
        const els = render();
        await expect((resetButton(els).props.onClick as () => Promise<void>)()).resolves.toBeUndefined();
        expect(current.slots[1]).toBe("35");
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(String(vi.mocked(toast.error).mock.calls[0][0])).toMatch(/couldn.t confirm/i);
        expect(deleteRateOverrideAction).toHaveBeenCalledTimes(1);
    });

    it("a refused Reset keeps the entry with the existing failure message (unchanged)", async () => {
        vi.mocked(deleteRateOverrideAction).mockResolvedValue({ error: "permission denied" } as never);
        const els = render();
        await (resetButton(els).props.onClick as () => Promise<void>)();
        expect(current.slots[1]).toBe("35");
        expect(toast.error).toHaveBeenCalledWith("Failed to reset rate");
        expect(toast.success).not.toHaveBeenCalled();
    });

    it("a confirmed Reset still shows success and returns the entry to the benchmark (unchanged)", async () => {
        vi.mocked(deleteRateOverrideAction).mockResolvedValue({ success: true });
        const els = render();
        await (resetButton(els).props.onClick as () => Promise<void>)();
        expect(current.slots[1]).toBe("30");
        expect(toast.success).toHaveBeenCalledWith("Rate reset to benchmark");
    });
});
