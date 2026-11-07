import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { workspaceStyles } from "@/lib/workspace-styles";
import BriefActivityEntry from "./brief-activity-entry";

const s = workspaceStyles(false);
type Element = ReactElement<Record<string, unknown>>;

function nodes(value: unknown): Element[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const element = value as Element;
    return [element, ...nodes(element.props.children)];
}
function textOf(value: unknown): string {
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(textOf).join("");
    return value && typeof value === "object" && "props" in value ? textOf((value as Element).props.children) : "";
}
function view(overrides: Partial<Parameters<typeof BriefActivityEntry>[0]> = {}) {
    return BriefActivityEntry({
        text: "",
        error: null,
        locked: false,
        onChange: () => undefined,
        onAdd: () => undefined,
        onClear: () => undefined,
        s,
        ...overrides,
    });
}
function control() {
    return nodes(view()).find(element => element.props.id === "brief-activity-entry");
}
function button(label: string, overrides: Partial<Parameters<typeof BriefActivityEntry>[0]> = {}) {
    return nodes(view(overrides)).find(element => element.type === "button" && textOf(element.props.children) === label)!;
}

describe("brief activity entry", () => {
    it("renders the controlled activity text for the server markup", () => {
        const html = renderToStaticMarkup(view({ text: "  Keep me  " }));
        expect(html).toContain("Activity to add");
        expect(html).toContain('id="brief-activity-entry"');
        expect(html).toContain('for="brief-activity-entry"');
        expect(html).toContain("rows=\"2\"");
        expect(html).toContain("  Keep me  ");
        expect(html).toContain(s.input);
        expect(html).toContain(s.label);
        expect(html).toContain(s.muted);
        expect(html).toContain("only when you choose Add activity");
        expect(html).toContain("existing Save");
        expect(html).toContain("Nothing is priced automatically.");
        expect(html).not.toMatch(/maxlength/i);
        expect(html).not.toContain("role=\"alert\"");
    });

    it("keeps a locked entry readable and both actions idle", () => {
        const html = renderToStaticMarkup(view({ text: "Roofing", locked: true, error: "Still unsaved" }));
        expect(html).toMatch(/readonly=""/i);
        expect(html).toContain("Roofing");
        expect(html).toContain("role=\"alert\"");
        expect(html).toContain("Still unsaved");
        expect(button("Add activity", { text: "Roofing", locked: true }).props.disabled).toBe(true);
        expect(button("Clear entry", { text: "Roofing", locked: true }).props.disabled).toBe(true);
        expect(button("Add activity", { text: "Roofing", locked: true }).props.className).toBe(s.primaryButton);
        expect(button("Clear entry", { text: "Roofing", locked: true }).props.className).toBe(s.quietButton);
    });

    it("leaves an empty entry editable and idle, and enables actions for exact non-empty text", () => {
        expect(nodes(view()).find(element => element.props.id === "brief-activity-entry")!.props.readOnly).toBe(false);
        expect(button("Add activity").props.disabled).toBe(true);
        expect(button("Clear entry").props.disabled).toBe(true);
        expect(button("Add activity", { text: " " }).props.disabled).toBe(false);
        expect(button("Clear entry", { text: " " }).props.disabled).toBe(false);
        expect(button("Add activity").props.type).toBe("button");
        expect(button("Clear entry").props.type).toBe("button");
    });

    it("passes the typed characters and the parent actions through unchanged", () => {
        const onChange = vi.fn();
        const onAdd = vi.fn();
        const onClear = vi.fn();
        const entry = nodes(view({ text: "A", onChange })).find(element => element.props.id === "brief-activity-entry")!;
        (entry.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "  A  " } });
        expect(onChange).toHaveBeenCalledExactlyOnceWith("  A  ");
        (button("Add activity", { text: "A", onAdd }).props.onClick as () => void)();
        (button("Clear entry", { text: "A", onClear }).props.onClick as () => void)();
        expect(onAdd).toHaveBeenCalledOnce();
        expect(onClear).toHaveBeenCalledOnce();
        expect(control()).toBeDefined();
    });

    it("shows an alert for an empty error string and hides it only when the error is null", () => {
        expect(renderToStaticMarkup(view({ error: "" }))).toContain("role=\"alert\"");
        expect(renderToStaticMarkup(view({ error: null }))).not.toContain("role=\"alert\"");
    });
});
