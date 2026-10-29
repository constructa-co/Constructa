import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hook = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    refresh: vi.fn(),
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = hook.cursor++;
        if (!(i in hook.slots)) {
            hook.slots[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
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

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: hook.refresh }) }));
vi.mock("@/components/ui/button", () => ({
    Button: ({ children, onClick, disabled, ...rest }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) =>
        createElement("button", { type: "button", onClick, disabled, ...rest }, children),
}));
vi.mock("lucide-react", () => ({ Trash2: () => null }));
vi.mock("../../templates-actions", () => ({
    removeTemplateItemAction: vi.fn(async () => {}),
}));

import { TemplateKitItemRemove } from "./template-kit-item-remove";
import { removeTemplateItemAction } from "../../templates-actions";

type Element = ReactElement<Record<string, unknown>>;

const props = { itemId: "line-1", templateId: "tpl-1" };

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const e = value as Element;
    return [e, ...nodes(e.props.children)];
}

function mount() {
    hook.cursor = 0;
    const rendered = TemplateKitItemRemove(props);
    return { tree: nodes(rendered), markup: renderToStaticMarkup(rendered) };
}

function removeButton(tree: Element[]) {
    const clickable = tree.filter(e => typeof e.props.onClick === "function");
    return clickable[clickable.length - 1]!;
}

async function clickRemove(tree: Element[]) {
    await (removeButton(tree).props.onClick as () => Promise<void>)();
}

function remarkup() {
    hook.cursor = 0;
    return renderToStaticMarkup(TemplateKitItemRemove(props));
}

beforeEach(() => {
    hook.slots = [];
    hook.cursor = 0;
    hook.refresh.mockReset();
    vi.mocked(removeTemplateItemAction).mockReset();
    vi.mocked(removeTemplateItemAction).mockResolvedValue(undefined);
});

describe("TemplateKitItemRemove outcomes (ROB1510)", () => {
    it("shows an accessible failure when removeTemplateItemAction throws", async () => {
        vi.mocked(removeTemplateItemAction).mockRejectedValueOnce(new Error("revalidate failed"));
        const { tree } = mount();
        await clickRemove(tree);
        const markup = remarkup();
        expect(markup).toMatch(/role="alert"/);
        expect(markup).toMatch(/could not confirm this item was removed/i);
        expect(markup).toMatch(/check the kit list/i);
        expect(removeTemplateItemAction).toHaveBeenCalledTimes(1);
        expect(hook.slots[0]).toBe(false);
    });

    it("calls remove once, refreshes on success, and clears pending without refusal text", async () => {
        const { tree } = mount();
        await clickRemove(tree);
        expect(removeTemplateItemAction).toHaveBeenCalledWith("line-1", "tpl-1");
        expect(hook.refresh).toHaveBeenCalledTimes(1);
        expect(hook.slots[0]).toBe(false);
        expect(hook.slots[1]).toBeNull();
        expect(remarkup()).not.toMatch(/could not confirm/i);
    });

    it("does not start a second remove while pending", async () => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        vi.mocked(removeTemplateItemAction).mockImplementationOnce(() => gate.then(() => undefined));
        const { tree } = mount();
        const inFlight = clickRemove(tree);
        hook.cursor = 0;
        const { tree: mid } = mount();
        await clickRemove(mid);
        release();
        await inFlight;
        expect(removeTemplateItemAction).toHaveBeenCalledTimes(1);
    });

    it("treats a refresh failure after a resolved remove as stale list guidance, not a DB refusal", async () => {
        hook.refresh.mockImplementationOnce(() => { throw new Error("refresh blocked"); });
        const { tree } = mount();
        await clickRemove(tree);
        const markup = remarkup();
        expect(markup).toMatch(/kit list may be stale/i);
        expect(markup).not.toMatch(/could not confirm this item was removed/i);
        expect(removeTemplateItemAction).toHaveBeenCalledTimes(1);
        expect(hook.slots[0]).toBe(false);
    });
});
