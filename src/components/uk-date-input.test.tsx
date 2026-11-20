import type { ComponentProps, ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// State keeps its slot between renders, so a change handler taken from one
// render can be called and its effect read from the next.
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0 }));

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

import UkDateInput from "./uk-date-input";

type Props = ComponentProps<typeof UkDateInput>;
type Node = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

function nodes(value: ReactNode): Node[] {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    const node = value as Node;
    return [node, ...nodes(node.props.children)];
}

function render(props: Props) {
    hooks.cursor = 0;
    const tree = UkDateInput(props);
    const all = nodes(tree);
    return {
        tree,
        input: all.find(n => n.type === "input")!,
        preview: all.find(n => n.props["data-uk-date-preview"] !== undefined),
        help: all.find(n => typeof n.props.id === "string" && (n.props.id as string).endsWith("-uk-date-help")),
    };
}

const change = (input: Node, value: string) => {
    const event = { target: { value } };
    (input.props.onChange as (e: unknown) => void)(event);
    return event;
};

beforeEach(() => {
    hooks.slots = [];
    hooks.cursor = 0;
});

describe("CON-035 UK date presentation", () => {
    it("renders a written-out preview and en-GB lang on the date input", () => {
        const markup = renderToStaticMarkup(
            render({ id: "brief-start-date", value: "2026-11-06", className: "input", mutedClassName: "text-muted" }).tree,
        );
        expect(markup).toContain('type="date"');
        expect(markup).toContain('lang="en-GB"');
        expect(markup).toContain("6 November 2026");
        expect(markup).toContain('value="2026-11-06"');
        expect(markup).toContain("brief-start-date-uk-date-help");
    });

    it("shows the written preview for an uncontrolled field from defaultValue", () => {
        const markup = renderToStaticMarkup(
            render({ id: "settings-start-date", name: "start_date", defaultValue: "2026-12-01" }).tree,
        );
        expect(markup).toContain('value="2026-12-01"');
        expect(markup).toContain('name="start_date"');
        expect(markup).toContain("1 December 2026");
        expect(markup).toContain("data-uk-date-preview");
    });

    it("does not promise a browser field order or a proposal/PDF format in its help copy", () => {
        for (const props of [{ id: "d", value: "" }, { id: "d", value: "2026-11-06" }] as Props[]) {
            const { help, input } = render(props);
            const copy = String(help!.props.children);
            expect(copy).not.toMatch(/browser|calendar|UK order|UK format|proposal|PDF/i);
            expect(copy).toMatch(/day/i);
            expect(input.props["aria-describedby"]).toBe("d-uk-date-help");
        }
    });

    it("keeps a caller's describedby ahead of its own help text", () => {
        const { input } = render({ id: "d", value: "", "aria-describedby": "caller-help lock-note" });
        expect(input.props["aria-describedby"]).toBe("caller-help lock-note d-uk-date-help");
    });

    it("uncontrolled: a change updates the submitted value and the preview, and still calls onChange", () => {
        const onChange = vi.fn();
        const props: Props = { id: "start_date", name: "start_date", defaultValue: "2026-12-01", onChange };
        const first = render(props);
        expect(first.input.props).toMatchObject({ name: "start_date", value: "2026-12-01" });

        const event = change(first.input, "2027-01-03");
        expect(onChange).toHaveBeenCalledExactlyOnceWith(event);

        const second = render(props);
        expect(second.input.props).toMatchObject({ name: "start_date", value: "2027-01-03" });
        expect(second.preview!.props.children).toBe("3 January 2027");

        // Clearing the native field clears the value that would be submitted.
        change(second.input, "");
        const cleared = render(props);
        expect(cleared.input.props.value).toBe("");
        expect(cleared.preview).toBeUndefined();
    });

    it("uncontrolled: a saved timestamp is cut down to its date for the field and the preview", () => {
        const { input, preview } = render({ id: "start_date", name: "start_date", defaultValue: "2026-12-01T00:00:00+00:00" });
        expect(input.props.value).toBe("2026-12-01");
        expect(preview!.props.children).toBe("1 December 2026");
    });

    it("uncontrolled: starts empty with no preview when there is no saved date", () => {
        const { input, preview } = render({ id: "start_date", name: "start_date", defaultValue: "" });
        expect(input.props.value).toBe("");
        expect(preview).toBeUndefined();
    });

    it("controlled: the parent's value wins until the parent changes it", () => {
        const onChange = vi.fn();
        const first = render({ id: "d", value: "2026-11-06", onChange });
        change(first.input, "2026-11-09");
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(render({ id: "d", value: "2026-11-06", onChange }).input.props.value).toBe("2026-11-06");
        const moved = render({ id: "d", value: "2026-11-09", onChange });
        expect(moved.input.props.value).toBe("2026-11-09");
        expect(moved.preview!.props.children).toBe("9 November 2026");
    });

    it("passes readOnly and disabled through to the native input", () => {
        expect(render({ id: "d", value: "2026-11-06", readOnly: true }).input.props.readOnly).toBe(true);
        expect(render({ id: "d", value: "2026-11-06", disabled: true }).input.props.disabled).toBe(true);
        const plain = render({ id: "d", value: "2026-11-06" }).input.props;
        expect(plain.readOnly).toBeUndefined();
        expect(plain.disabled).toBeUndefined();
    });
});
