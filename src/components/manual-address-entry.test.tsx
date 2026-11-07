import type { FormEvent, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MANUAL_ADDRESS_MAX_LENGTH } from "@/lib/manual-address";

const hooks = vi.hoisted(() => ({
    slots: [] as unknown[],
    cursor: 0,
}));

vi.mock("react", async importOriginal => ({
    ...await importOriginal<typeof import("react")>(),
    useState: (initial: unknown) => {
        const index = hooks.cursor++;
        if (!(index in hooks.slots)) hooks.slots[index] = typeof initial === "function" ? initial() : initial;
        return [
            hooks.slots[index],
            (value: unknown) => {
                hooks.slots[index] = typeof value === "function" ? value(hooks.slots[index]) : value;
            },
        ];
    },
    useRef: (initial: unknown) => {
        const index = hooks.cursor++;
        if (!(index in hooks.slots)) hooks.slots[index] = { current: initial };
        return hooks.slots[index];
    },
}));

import ManualAddressEntry from "./manual-address-entry";

type Node = ReactElement<{
    children?: ReactNode;
    id?: string;
    type?: string;
    disabled?: boolean;
    value?: string;
    onClick?: () => void;
    onChange?: (event: { target: { value: string } }) => void;
    onSubmit?: (event: FormEvent) => void;
}>;

function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}

type EntryProps = {
    idPrefix: string;
    disabled?: boolean;
    onApply: (preview: string) => void;
    onPendingChange: (pending: boolean) => void;
    isDark: boolean;
    labelCls: string;
    inputCls: string;
    muted: string;
};

const defaultProps = (): EntryProps => ({
    idPrefix: "test-manual",
    disabled: false,
    onApply: vi.fn(),
    onPendingChange: vi.fn(),
    isDark: true,
    labelCls: "label",
    inputCls: "input",
    muted: "muted",
});

function renderEntry(overrides: Partial<EntryProps> = {}) {
    hooks.cursor = 0;
    const props = { ...defaultProps(), ...overrides };
    return { node: ManualAddressEntry(props), props };
}

function editPart(id: string, value: string, overrides: Partial<EntryProps> = {}) {
    nodes(renderEntry(overrides).node).find(n => n.props.id === id)!.props.onChange!({ target: { value } });
}

beforeEach(() => {
    hooks.slots = [];
    hooks.cursor = 0;
});

describe("ManualAddressEntry", () => {
    it("Use this address control uses core sage primary tokens, not brand blue", () => {
        editPart("test-manual-line1", "Site");
        const html = renderToStaticMarkup(renderEntry().node);
        expect(html).not.toMatch(/(?:border|text|bg|ring)-blue-/);
        expect(html).toContain("#c9efcf");
        expect(html).toContain("#182c1b");
    });

    it("starts closed with no named fields and does not submit a form", () => {
        const html = renderToStaticMarkup(renderEntry().node);
        expect(html).toMatch(/<details[^>]*data-manual-address-entry="test-manual"/);
        expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
        expect(html).not.toMatch(/\bname="/);
        expect(nodes(renderEntry().node).find(n => n.type === "form")).toBeUndefined();
    });

    it("keeps parent address untouched until Use is pressed", () => {
        const onApply = vi.fn();
        const onPendingChange = vi.fn();
        editPart("test-manual-line1", "Warehouse", { onApply, onPendingChange });
        expect(onApply).not.toHaveBeenCalled();
        expect(onPendingChange).toHaveBeenLastCalledWith(true);
        nodes(renderEntry({ onApply, onPendingChange }).node)
            .find(n => n.props.id === "test-manual-use")!
            .props.onClick!();
        expect(onApply).toHaveBeenCalledWith("Warehouse");
        expect(onPendingChange).toHaveBeenLastCalledWith(false);
    });

    it("disables Use for empty preview and for previews over 500 characters", () => {
        editPart("test-manual-line1", "z".repeat(MANUAL_ADDRESS_MAX_LENGTH + 5));
        const use = nodes(renderEntry().node).find(n => n.props.id === "test-manual-use")!;
        expect(use.props.disabled).toBe(true);
        expect(renderToStaticMarkup(renderEntry().node)).toContain("over 500 characters");
    });

    it("disables controls while the parent create flow is pending", () => {
        editPart("test-manual-line1", "Site");
        expect(nodes(renderEntry({ disabled: true }).node).find(n => n.props.id === "test-manual-line1")!.props.disabled).toBe(true);
        expect(nodes(renderEntry({ disabled: true }).node).find(n => n.props.id === "test-manual-use")!.props.disabled).toBe(true);
    });

    it("retains draft values in markup without applying on re-render", () => {
        editPart("test-manual-line1", "Keep");
        editPart("test-manual-townCity", "Draft");
        const html = renderToStaticMarkup(renderEntry().node);
        expect(html).toContain('value="Keep"');
        expect(html).toContain('value="Draft"');
        expect(html).toContain("Keep\nDraft");
    });

    it("keeps an explicitly refused local Use draft pending until a deliberate successful retry", () => {
        const onApply = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
        const onPendingChange = vi.fn();
        editPart("test-manual-line1", "  Unapplied site!  ", { onApply, onPendingChange });
        nodes(renderEntry({ onApply, onPendingChange }).node).find(n => n.props.id === "test-manual-use")!.props.onClick!();
        expect(onApply).toHaveBeenCalledExactlyOnceWith("Unapplied site!");
        expect(onPendingChange).toHaveBeenLastCalledWith(true);
        editPart("test-manual-line1", "  Unapplied site!  ", { onApply, onPendingChange });
        expect(onPendingChange).toHaveBeenLastCalledWith(true);
        expect(nodes(renderEntry({ onApply, onPendingChange }).node).find(n => n.props.id === "test-manual-line1")!.props.value).toBe("  Unapplied site!  ");
        nodes(renderEntry({ onApply, onPendingChange }).node).find(n => n.props.id === "test-manual-use")!.props.onClick!();
        expect(onApply).toHaveBeenCalledTimes(2);
        expect(onPendingChange).toHaveBeenLastCalledWith(false);
    });

    it("refuses an already-captured Use callback after a disabled rerender, then a deliberate re-enabled Use applies the retained literal once", () => {
        const onApply = vi.fn();
        const onPendingChange = vi.fn();
        editPart("test-manual-line1", "  Warehouse, Unit 7!  ", { onApply, onPendingChange });
        const capturedUse = nodes(renderEntry({ onApply, onPendingChange }).node)
            .find(n => n.props.id === "test-manual-use")!
            .props.onClick!;
        onApply.mockClear();
        onPendingChange.mockClear();
        nodes(renderEntry({ disabled: true, onApply, onPendingChange }).node);
        capturedUse();
        expect(onApply).not.toHaveBeenCalled();
        expect(onPendingChange).not.toHaveBeenCalled();
        expect(nodes(renderEntry({ disabled: true, onApply, onPendingChange }).node)
            .find(n => n.props.id === "test-manual-line1")!.props.value).toBe("  Warehouse, Unit 7!  ");
        nodes(renderEntry({ onApply, onPendingChange }).node)
            .find(n => n.props.id === "test-manual-use")!
            .props.onClick!();
        expect(onApply).toHaveBeenCalledExactlyOnceWith("Warehouse, Unit 7!");
        expect(onPendingChange).toHaveBeenCalledTimes(1);
        expect(onPendingChange).toHaveBeenLastCalledWith(false);
    });

    it("postcode-first: retains the edge-whitespace literal, applies only the trimmed postcode preview on one explicit Use, and a later line1 edit turns pending again without another apply", () => {
        const onApply = vi.fn();
        const onPendingChange = vi.fn();
        editPart("test-manual-postcode", "  AB1 2CD  ", { onApply, onPendingChange });
        // Postcode alone (no street/town yet): exact literal retained, preview trims per current policy, no apply.
        expect(nodes(renderEntry({ onApply, onPendingChange }).node).find(n => n.props.id === "test-manual-postcode")!.props.value).toBe("  AB1 2CD  ");
        expect(nodes(renderEntry({ onApply, onPendingChange }).node).find(n => n.props.id === "test-manual-preview")!.props.children).toBe("AB1 2CD");
        expect(onApply).not.toHaveBeenCalled();
        expect(onPendingChange).toHaveBeenLastCalledWith(true);
        const use = nodes(renderEntry({ onApply, onPendingChange }).node).find(n => n.props.id === "test-manual-use")!;
        expect(use.props.disabled).toBe(false);
        // One explicit Use applies the current preview once and clears pending; the literal draft stays.
        use.props.onClick!();
        expect(onApply).toHaveBeenCalledExactlyOnceWith("AB1 2CD");
        expect(onPendingChange).toHaveBeenLastCalledWith(false);
        expect(nodes(renderEntry({ onApply, onPendingChange }).node).find(n => n.props.id === "test-manual-postcode")!.props.value).toBe("  AB1 2CD  ");
        // Adding line1 afterwards turns pending again with no automatic apply.
        editPart("test-manual-line1", "14 Example Street", { onApply, onPendingChange });
        expect(onApply).toHaveBeenCalledTimes(1);
        expect(onPendingChange).toHaveBeenLastCalledWith(true);
        expect(nodes(renderEntry({ onApply, onPendingChange }).node).find(n => n.props.id === "test-manual-preview")!.props.children).toBe("14 Example Street\nAB1 2CD");
    });
});
