import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

const current = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, use: vi.fn() }));
vi.mock("react", async original => ({
    ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const slot = current.cursor++;
        if (!(slot in current.slots)) current.slots[slot] = initial;
        return [current.slots[slot], (value: unknown) => { current.slots[slot] = value; }];
    },
}));
import AreaQuantityAid, { AreaQuantityInputs } from "./area-quantity-aid";
type Element = ReactElement<Record<string, unknown>>;
function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function aid(unit = "m2", disabled = false) {
    current.cursor = 0;
    return nodes(AreaQuantityAid({ idPrefix: "line", unit, disabled, onUse: current.use }));
}
function fields(disabled = false) {
    current.cursor = 0;
    return nodes(AreaQuantityInputs({ idPrefix: "line", disabled, onUse: current.use }));
}
function change(id: string, value: string) {
    const input = fields().find(e => e.props.id === id)!;
    (input.props.onChange as (event: unknown) => void)({ target: { value } });
}
beforeEach(() => { current.slots = []; current.cursor = 0; current.use.mockReset(); });
describe("explicit area quantity aid", () => {
    it("starts closed with no measurements mounted and explains result-only retention", () => {
        const elements = aid();
        expect(elements.some(e => e.type === "details")).toBe(true);
        expect(elements.some(e => e.type === "input" || e.type === AreaQuantityInputs)).toBe(false);
        expect(JSON.stringify(elements)).toContain("not retained");
        expect(current.use).not.toHaveBeenCalled();
    });
    it("unmounts measurement inputs on closing so reopening begins blank", () => {
        const toggle = aid().find(e => e.type === "details")!.props.onToggle as (event: unknown) => void;
        toggle({ currentTarget: { open: true } });
        expect(aid().some(e => e.type === AreaQuantityInputs)).toBe(true);
        toggle({ currentTarget: { open: false } });
        expect(aid().some(e => e.type === AreaQuantityInputs)).toBe(false);
    });
    it.each(["item", "m", "m3", "nr", "sq m"])("does not guess conversions or change non-area unit %s", unit => {
        expect(aid(unit).some(e => e.type === "details" || e.type === "input")).toBe(false);
        expect(current.use).not.toHaveBeenCalled();
    });
    it("links both labels and never applies on typing or blur", () => {
        change("line-length", "0.1"); change("line-width", "0.2");
        const elements = fields();
        for (const input of elements.filter(e => e.type === "input")) {
            expect(elements.some(e => e.type === "label" && e.props.htmlFor === input.props.id)).toBe(true);
            expect(input.props.onBlur).toBeUndefined();
            expect(input.props.inputMode).toBe("decimal");
        }
        expect(current.use).not.toHaveBeenCalled();
        const button = elements.find(e => e.type === "button")!;
        expect(button.props.type).toBe("button");
        (button.props.onClick as () => void)();
        expect(current.use).toHaveBeenCalledExactlyOnceWith("0.02");
    });
    it.each([false, true])("refuses use when invalid or saving=%s, even if callback is invoked directly", saving => {
        change("line-length", saving ? "2" : "0.001"); change("line-width", saving ? "3" : "0.001");
        const button = fields(saving).find(e => e.type === "button")!;
        expect(button.props.disabled).toBe(true);
        (button.props.onClick as () => void)();
        expect(current.use).not.toHaveBeenCalled();
        if (saving) expect(fields(true).filter(e => e.type === "input").every(e => e.props.disabled)).toBe(true);
    });
    it("prevents Enter in measurement inputs from submitting the surrounding price form", () => {
        const event = { key: "Enter", preventDefault: vi.fn(), stopPropagation: vi.fn() };
        (fields().find(e => e.type === "input")!.props.onKeyDown as (event: unknown) => void)(event);
        expect(event.preventDefault).toHaveBeenCalledOnce();
        expect(event.stopPropagation).toHaveBeenCalledOnce();
        expect(current.use).not.toHaveBeenCalled();
    });
});
