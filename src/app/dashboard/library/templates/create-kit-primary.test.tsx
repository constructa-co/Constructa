import type { ReactElement, ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { corePrimaryButton } from "@/lib/core-editing-palette";

const hook = vi.hoisted(() => ({
    slots: [] as unknown[],
    refs: [] as Array<{ current: unknown }>,
    cursor: 0,
    refCursor: 0,
}));

vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = hook.cursor++;
        if (!(i in hook.slots)) hook.slots[i] = initial;
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
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("../templates-actions", () => ({ createTemplateAction: vi.fn() }));

import CreateKitForm from "./create-kit-form";

type Element = ReactElement<Record<string, unknown>>;

function text(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(text).join("");
    if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
    return "";
}

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const el = value as Element;
    return [el, ...nodes(el.props.children)];
}

function renderKitForm() {
    hook.cursor = 0;
    hook.refCursor = 0;
    const element = createElement(CreateKitForm);
    return { element, markup: renderToStaticMarkup(element), tree: nodes(element) };
}

function initializeKitButton(tree: Element[]) {
    return tree.find(e => e.props.type === "submit" && text(e.props.children) === "Initialize Kit");
}

beforeEach(() => {
    hook.slots = [];
    hook.refs = [];
});

describe("CreateKitForm Initialize Kit primary control", () => {
    it("renders the submit control with corePrimaryButton, retained geometry, and pending disabled attribute", () => {
        const { markup, tree } = renderKitForm();
        const button = initializeKitButton(tree);
        expect(button, "Initialize Kit submit button").toBeDefined();
        const className = String(button!.props.className);
        for (const token of corePrimaryButton.split(/\s+/)) {
            expect(className).toContain(token);
        }
        expect(className).toContain("w-full");
        expect(className).toContain("rounded-lg");
        expect(className).not.toContain("bg-slate-900");
        expect(className).not.toContain("hover:bg-black");
        expect(className).not.toMatch(/(?:bg|text|hover:bg)-white\b/);
        expect(button!.props.type).toBe("submit");
        expect(button!.props.disabled).toBe(false);
        expect(markup).toContain("Initialize Kit");
        expect(markup).toContain('type="submit"');

        hook.slots[1] = true;
        const pending = renderKitForm();
        const pendingButton = initializeKitButton(pending.tree)!;
        expect(pendingButton.props.disabled).toBe(true);
        expect(pending.markup).toContain('disabled=""');
        expect(pending.markup).toContain("Initialize Kit");
    });
});
