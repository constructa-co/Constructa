import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { Estimate } from "@/app/dashboard/projects/costs/types";
import { workspaceStyles } from "@/lib/workspace-styles";
import { savedLineReuseContext } from "@/lib/saved-line-reuse";
const replay = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, cleanups: [] as Array<() => void>, open: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
    useState: (initial: unknown) => {
        const i = replay.cursor++; if (!(i in replay.slots)) replay.slots[i] = initial;
        return [replay.slots[i], (value: unknown) => { replay.slots[i] = value; }];
    },
    useRef: (initial: unknown) => { const i = replay.cursor++; return replay.slots[i] ??= { current: initial }; },
    useEffect: (effect: () => void | (() => void)) => { const cleanup = effect(); if (cleanup) replay.cleanups.push(cleanup); },
}));
import SavedLineReuse from "./saved-line-reuse";
type Element = ReactElement<Record<string, unknown>>;
const estimate = (): Estimate => ({ id: "estimate", project_id: "job", version_name: "Saved", is_active: true, overhead_pct: 0, profit_pct: 0, risk_pct: 0, prelims_pct: 0, discount_pct: 0, discount_reason: "", total_cost: 222,
    estimate_lines: [{ id: "source", estimate_id: "estimate", description: " Fit\n doors, excluding frames ", trade_section: "Carpentry", quantity: 2, unit: "nr", unit_rate: 111, line_total: 222, pricing_mode: "simple", line_type: "general", estimate_line_components: [] }] });
function view(patch: Partial<Parameters<typeof SavedLineReuse>[0]> = {}) {
    replay.cursor = 0; return SavedLineReuse({ context: savedLineReuseContext({ id: "job", brief_scope: "Saved work" }, estimate()), blocked: false, onOpen: replay.open, s: workspaceStyles(false), ...patch });
}
function nodes(value: unknown): Element[] { if (Array.isArray(value)) return value.flatMap(nodes); if (!value || typeof value !== "object" || !("props" in value)) return []; const node = value as Element; return [node, ...nodes(node.props.children)]; }
function button(name: string, patch: Partial<Parameters<typeof SavedLineReuse>[0]> = {}) { return nodes(view(patch)).find(n => n.type === "button" && n.props.children === name)!.props; }
function choose(patch: Partial<Parameters<typeof SavedLineReuse>[0]> = {}) { (nodes(view(patch)).find(n => n.type === "select")!.props.onChange as (event: unknown) => void)({ target: { value: "source" } }); }
beforeEach(() => { replay.slots = []; replay.cursor = 0; replay.cleanups = []; replay.open.mockReset().mockReturnValue({ ok: true }); });
describe("optional saved-line wording review", () => {
    it("starts closed and labels selection without opening any draft", () => {
        const tree = view(); expect(tree.props.open).toBeUndefined(); expect(replay.open).not.toHaveBeenCalled();
        expect(nodes(tree).find(n => n.type === "label")!.props.htmlFor).toBe(nodes(tree).find(n => n.type === "select")!.props.id);
        choose(); expect(replay.open).not.toHaveBeenCalled();
        const html = renderToStaticMarkup(view()); expect(html).toContain("excluding frames"); expect(html).toContain("Carpentry"); expect(html).toContain("joins whitespace");
    });
    it("opens only on explicit choice and fences repeat old handlers after consuming review", () => {
        choose(); const old = button("Open unpriced draft").onClick as () => void; old(); old();
        expect(replay.open).toHaveBeenCalledOnce(); expect(replay.open.mock.calls[0][0]).toMatchObject({ lineId: "source", description: " Fit\n doors, excluding frames ", activity: "Carpentry" });
        expect(renderToStaticMarkup(view())).toContain("Save it separately in the price row");
    });
    it("selection and Cancel never call the parent or claim a save", () => {
        choose(); (button("Cancel wording review").onClick as () => void)(); expect(replay.open).not.toHaveBeenCalled();
        expect(nodes(view()).some(n => n.props["data-saved-line-review"])).toBe(false);
    });
    it("retains review after a parent refusal,without false opened/saved feedback", () => {
        choose(); replay.open.mockReturnValueOnce({ ok: false, error: "Other draft now open" });
        (button("Open unpriced draft").onClick as () => void)(); const html = renderToStaticMarkup(view());
        expect(html).toContain("Other draft now open"); expect(html).not.toContain("Unpriced draft opened");
        expect(nodes(view()).some(n => n.props["data-saved-line-review"])).toBe(true);
    });
    it("fences blocked state,changed source and unmounted old handlers", () => {
        choose(); const old = button("Open unpriced draft").onClick as () => void;
        view({ blocked: true }); old(); expect(replay.open).not.toHaveBeenCalled();
        const changed = estimate(); changed.estimate_lines[0].description = "Changed source";
        const patch = { context: savedLineReuseContext({ id: "job", brief_scope: "Saved work" }, changed) };
        view(patch); old(); expect(replay.open).not.toHaveBeenCalled(); expect(button("Open unpriced draft", patch).disabled).toBe(true);
        for (const cleanup of replay.cleanups) cleanup(); old(); expect(replay.open).not.toHaveBeenCalled();
    });
    it("shows full overlong source and refusal without truncation", () => {
        const changed = estimate(); changed.estimate_lines[0].description = "x".repeat(501);
        const patch = { context: savedLineReuseContext({ id: "job", brief_scope: "Saved work" }, changed) };
        choose(patch); expect(renderToStaticMarkup(view(patch))).toContain("x".repeat(501)); expect(button("Open unpriced draft", patch).disabled).toBe(true);
        (button("Open unpriced draft", patch).onClick as () => void)(); expect(replay.open).not.toHaveBeenCalled();
    });
    it("keeps BoQ source selection readonly and displays current lock reason", () => {
        const boq = { ...estimate(), is_client_boq: true };
        const patch = { context: savedLineReuseContext({ id: "job", brief_scope: "" }, boq) };
        expect(nodes(view(patch)).find(n => n.type === "select")!.props.disabled).toBe(true); choose(patch); expect(replay.open).not.toHaveBeenCalled();
        expect(renderToStaticMarkup(view({ blocked: true, blockReason: "Accepted proposal is locked" }))).toContain("Accepted proposal is locked");
    });
    it("escapes source text and uses non-submitting buttons", () => {
        const changed = estimate(); changed.estimate_lines[0].description = "<script>literal</script>";
        const patch = { context: savedLineReuseContext({ id: "job", brief_scope: "" }, changed) }; choose(patch);
        const html = renderToStaticMarkup(view(patch)); expect(html).not.toContain("<script>"); expect(html).toContain("&lt;script&gt;");
        expect(nodes(view(patch)).filter(n => n.type === "button").every(n => n.props.type === "button")).toBe(true);
    });
});
