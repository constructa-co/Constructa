import type { ComponentProps, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PostcodeAddressPicker from "./postcode-address-picker";
import {
    POSTCODE_LOOKUP_FAILED_MESSAGE,
    POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE,
    type PostcodeLookupResult,
} from "@/lib/postcode-address";

const hooks = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
    effectCleanups: [] as Array<() => void>,
}));

vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.cursor++;
        if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        return [
            hooks.slots[index],
            (value: unknown) => {
                hooks.slots[index] = typeof value === "function" ? (value as (prev: unknown) => unknown)(hooks.slots[index]) : value;
            },
        ];
    },
    useRef: (initial: unknown) => {
        const index = hooks.cursor++;
        if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
        return hooks.slots[index];
    },
    useEffect: (fn: () => void | (() => void)) => {
        hooks.cursor++;
        const cleanup = fn();
        if (typeof cleanup === "function") hooks.effectCleanups.push(cleanup);
    },
}));

type Node = ReactElement<{
    children?: ReactNode;
    id?: string;
    disabled?: boolean;
    onClick?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
}>;

function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as ReactElement<{ children?: ReactNode }>;
    return [node as Node, ...nodes(node.props.children)];
}

type PickerProps = ComponentProps<typeof PostcodeAddressPicker>;

function renderPicker(overrides: Partial<PickerProps> = {}) {
    hooks.cursor = 0;
    const props: PickerProps = {
        idPrefix: "test-picker",
        onSelect: vi.fn(),
        isDark: true,
        inputCls: "input",
        muted: "muted",
        ...overrides,
    };
    return { node: PostcodeAddressPicker(props), props };
}

function renderTwoPickers(
    a: Partial<PickerProps>,
    b: Partial<PickerProps>,
): { node: ReactElement; propsA: PickerProps; propsB: PickerProps } {
    hooks.cursor = 0;
    const propsA: PickerProps = {
        idPrefix: "picker-a",
        onSelect: vi.fn(),
        isDark: true,
        inputCls: "input",
        muted: "muted",
        ...a,
    };
    const propsB: PickerProps = {
        idPrefix: "picker-b",
        onSelect: vi.fn(),
        isDark: true,
        inputCls: "input",
        muted: "muted",
        ...b,
    };
    return {
        node: (
            <>
                {PostcodeAddressPicker(propsA)}
                {PostcodeAddressPicker(propsB)}
            </>
        ) as ReactElement,
        propsA,
        propsB,
    };
}

function editPostcode(value: string, overrides: Partial<PickerProps> = {}) {
    nodes(renderPicker(overrides).node).find(n => n.props.id === "test-picker-postcode")!.props.onChange!({ target: { value } });
}

function clickFind(overrides: Partial<PickerProps> = {}, idPrefix = "test-picker") {
    nodes(renderPicker(overrides).node).find(n => n.props.id === `${idPrefix}-find`)!.props.onClick!();
}

function simulateUnmount() {
    hooks.effectCleanups.forEach(cleanup => cleanup());
    hooks.effectCleanups.length = 0;
}

beforeEach(() => {
    hooks.slots = [];
    hooks.cursor = 0;
    hooks.effectCleanups = [];
});

describe("PostcodeAddressPicker", () => {
    it("Find addresses control uses core sage primary tokens, not brand blue", () => {
        editPostcode("AB1 2CD");
        const html = renderToStaticMarkup(renderPicker().node);
        expect(html).not.toMatch(/(?:bg|hover:bg|text|border|ring)-blue-/);
        expect(html).toContain("#c9efcf");
        expect(html).toContain("#182c1b");
        const find = nodes(renderPicker().node).find(n => n.props.id === "test-picker-find")!;
        expect(find.props.disabled).toBe(false);
    });

    it("does not call lookup or onSelect when search is not configured", () => {
        const onSelect = vi.fn();
        editPostcode("AB1 2CD", { onSelect });
        clickFind({ onSelect });
        expect(onSelect).not.toHaveBeenCalled();
        expect(nodes(renderPicker({ onSelect }).node).find(n => n.props.id === "test-picker-lookup-status")!.props.children).toBe(
            POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE,
        );
    });

    it("lists injected candidates and applies only on explicit pick", async () => {
        const onSelect = vi.fn();
        const lookup = vi.fn().mockResolvedValue({
            kind: "ok",
            candidates: [
                { id: "a", label: "14 Example Street\nAB1 2CD" },
                { id: "b", label: "16 Example Street\nAB1 2CD" },
            ],
        });
        editPostcode("AB1 2CD", { onSelect, lookup });
        clickFind({ onSelect, lookup });
        await vi.waitFor(() => expect(lookup).toHaveBeenCalledWith("AB12CD"));
        expect(onSelect).not.toHaveBeenCalled();
        await vi.waitFor(() =>
            expect(nodes(renderPicker({ onSelect, lookup }).node).some(n => n.props.id === "test-picker-candidate-b")).toBe(true),
        );
        nodes(renderPicker({ onSelect, lookup }).node).find(n => n.props.id === "test-picker-candidate-b")!.props.onClick!();
        expect(onSelect).toHaveBeenCalledExactlyOnceWith("16 Example Street\nAB1 2CD");
    });

    it("keeps the fast postcode B result when slow postcode A resolves later", async () => {
        let resolveSlow!: (result: PostcodeLookupResult) => void;
        let resolveFast!: (result: PostcodeLookupResult) => void;
        const lookup = vi
            .fn()
            .mockImplementationOnce(() => new Promise<PostcodeLookupResult>(resolve => { resolveSlow = resolve; }))
            .mockImplementationOnce(() => new Promise<PostcodeLookupResult>(resolve => { resolveFast = resolve; }));

        editPostcode("AA1 1AA", { lookup });
        clickFind({ lookup });
        editPostcode("BB2 2BB", { lookup });
        clickFind({ lookup });

        resolveFast({ kind: "ok", candidates: [{ id: "fast", label: "Fast Street\nBB2 2BB" }] });
        await vi.waitFor(() =>
            expect(nodes(renderPicker({ lookup }).node).some(n => n.props.id === "test-picker-candidate-fast")).toBe(true),
        );

        resolveSlow({ kind: "ok", candidates: [{ id: "slow", label: "Slow Street\nAA1 1AA" }] });
        await Promise.resolve();
        const tree = nodes(renderPicker({ lookup }).node);
        expect(tree.some(n => n.props.id === "test-picker-candidate-fast")).toBe(true);
        expect(tree.some(n => n.props.id === "test-picker-candidate-slow")).toBe(false);
    });

    it("does not apply a stale error after the postcode changes before the slow lookup settles", async () => {
        let rejectSlow!: (reason?: unknown) => void;
        const lookup = vi
            .fn()
            .mockImplementationOnce(
                () => new Promise<PostcodeLookupResult>((_, reject) => { rejectSlow = reject; }),
            )
            .mockImplementationOnce(() =>
                Promise.resolve({
                    kind: "ok",
                    candidates: [{ id: "fresh", label: "Fresh Street\nCC3 3CC" }],
                }),
            );

        editPostcode("AA1 1AA", { lookup });
        clickFind({ lookup });
        nodes(renderPicker({ lookup }).node).find(n => n.props.id === "test-picker-postcode")!.props.onChange!({ target: { value: "CC3 3CC" } });
        editPostcode("CC3 3CC", { lookup });
        clickFind({ lookup });

        await vi.waitFor(() =>
            expect(nodes(renderPicker({ lookup }).node).some(n => n.props.id === "test-picker-candidate-fresh")).toBe(true),
        );

        rejectSlow(new Error("stale failure"));
        await Promise.resolve();

        const status = nodes(renderPicker({ lookup }).node).find(n => n.props.id === "test-picker-lookup-status");
        expect(status?.props.children).not.toBe(POSTCODE_LOOKUP_FAILED_MESSAGE);
        expect(nodes(renderPicker({ lookup }).node).some(n => n.props.id === "test-picker-candidate-fresh")).toBe(true);
    });

    it("ignores in-flight lookup results after unmount cleanup", async () => {
        let resolveSlow!: (result: PostcodeLookupResult) => void;
        const lookup = vi.fn().mockImplementationOnce(
            () => new Promise<PostcodeLookupResult>(resolve => { resolveSlow = resolve; }),
        );

        editPostcode("AA1 1AA", { lookup });
        clickFind({ lookup });
        simulateUnmount();
        resolveSlow({ kind: "ok", candidates: [{ id: "late", label: "Late Street\nAA1 1AA" }] });
        await Promise.resolve();
        expect(nodes(renderPicker({ lookup }).node).some(n => n.props.id === "test-picker-candidate-late")).toBe(false);
    });

    it("isolates lookup results between two picker instances on the same form", async () => {
        let resolveA!: (result: PostcodeLookupResult) => void;
        const lookupA = vi.fn().mockImplementationOnce(
            () => new Promise<PostcodeLookupResult>(resolve => { resolveA = resolve; }),
        );
        const lookupB = vi.fn().mockResolvedValue({
            kind: "ok",
            candidates: [{ id: "b-only", label: "Client House\nNE2 2NE" }],
        });
        const onSelectA = vi.fn();
        const onSelectB = vi.fn();

        const tree = () => nodes(renderTwoPickers({ lookup: lookupA, onSelect: onSelectA }, { lookup: lookupB, onSelect: onSelectB }).node);

        tree().find(n => n.props.id === "picker-a-postcode")!.props.onChange!({ target: { value: "AA1 1AA" } });
        tree().find(n => n.props.id === "picker-a-find")!.props.onClick!();
        tree().find(n => n.props.id === "picker-b-postcode")!.props.onChange!({ target: { value: "NE2 2NE" } });
        tree().find(n => n.props.id === "picker-b-find")!.props.onClick!();

        await vi.waitFor(() => expect(lookupB).toHaveBeenCalledWith("NE22NE"));
        expect(tree().some(n => n.props.id === "picker-b-candidate-b-only")).toBe(true);
        expect(tree().some(n => n.props.id === "picker-a-candidate-late")).toBe(false);

        resolveA({ kind: "ok", candidates: [{ id: "late", label: "Site Plot\nAA1 1AA" }] });
        await vi.waitFor(() => expect(tree().some(n => n.props.id === "picker-a-candidate-late")).toBe(true));
        expect(tree().some(n => n.props.id === "picker-b-candidate-b-only")).toBe(true);
        expect(onSelectA).not.toHaveBeenCalled();
        expect(onSelectB).not.toHaveBeenCalled();
    });
});
