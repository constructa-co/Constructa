import type { ComponentProps, ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PostcodeAddressPicker from "./postcode-address-picker";
import { POSTCODE_LOOKUP_NOT_AVAILABLE_MESSAGE } from "@/lib/postcode-address";

const hooks = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
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

function editPostcode(value: string, overrides: Partial<PickerProps> = {}) {
    nodes(renderPicker(overrides).node).find(n => n.props.id === "test-picker-postcode")!.props.onChange!({ target: { value } });
}

beforeEach(() => {
    hooks.slots = [];
    hooks.cursor = 0;
});

describe("PostcodeAddressPicker", () => {
    it("does not call lookup or onSelect when search is not configured", () => {
        const onSelect = vi.fn();
        editPostcode("AB1 2CD", { onSelect });
        nodes(renderPicker({ onSelect }).node).find(n => n.props.id === "test-picker-find")!.props.onClick!();
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
        nodes(renderPicker({ onSelect, lookup }).node).find(n => n.props.id === "test-picker-find")!.props.onClick!();
        await vi.waitFor(() => expect(lookup).toHaveBeenCalledWith("AB12CD"));
        expect(onSelect).not.toHaveBeenCalled();
        await vi.waitFor(() =>
            expect(nodes(renderPicker({ onSelect, lookup }).node).some(n => n.props.id === "test-picker-candidate-b")).toBe(true),
        );
        nodes(renderPicker({ onSelect, lookup }).node).find(n => n.props.id === "test-picker-candidate-b")!.props.onClick!();
        expect(onSelect).toHaveBeenCalledExactlyOnceWith("16 Example Street\nAB1 2CD");
    });
});
